import mongoose from 'mongoose';
import { AUDIT_ACTION, ROLES } from '../config/constants.js';
import { nextSequence } from '../models/Counter.js';
import { Delivery } from '../models/Delivery.js';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { disconnectUser } from '../sockets/index.js';
import { recordAudit } from './audit.service.js';
import { generateTemporaryPassword, hashPassword } from './auth.service.js';

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const formatRiderId = (sequence) => `RDR-${String(sequence).padStart(4, '0')}`;

async function findRiderOrThrow(id) {
  const rider = await User.findOne({ _id: id, role: ROLES.RIDER }).select('+tokenVersion');
  if (!rider) throw new AppError(404, 'NOT_FOUND', 'That rider could not be found.');
  return rider;
}

export async function listRiders({ page, pageSize, search, status }) {
  const filter = { role: ROLES.RIDER };

  if (status === 'active') filter.isActive = true;
  if (status === 'inactive') filter.isActive = false;

  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ fullName: pattern }, { phone: pattern }, { email: pattern }, { 'riderProfile.riderId': pattern }];
  }

  const [riders, totalItems] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    User.countDocuments(filter),
  ]);

  return { riders, totalItems };
}

export const getRider = (id) => findRiderOrThrow(id);

export async function createRider(input, admin, req) {
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  let rider;

  await mongoose.connection.transaction(async (session) => {
    const sequence = await nextSequence('rider', session);
    [rider] = await User.create(
      [
        {
          fullName: input.fullName,
          phone: input.phone,
          email: input.email,
          passwordHash,
          role: ROLES.RIDER,
          mustChangePassword: true,
          createdBy: admin._id,
          riderProfile: {
            riderId: formatRiderId(sequence),
            vehicleNumber: input.vehicleNumber,
            notes: input.notes,
          },
        },
      ],
      { session },
    );
    await recordAudit({
      actor: admin,
      action: AUDIT_ACTION.RIDER_CREATED,
      entityType: 'User',
      entityId: rider._id,
      metadata: { riderId: rider.riderProfile.riderId },
      req,
      session,
    });
  });

  return { rider, temporaryPassword };
}

export async function updateRider(id, changes, admin, req) {
  const rider = await findRiderOrThrow(id);
  const changedFields = Object.keys(changes).filter((field) => changes[field] !== undefined);

  await mongoose.connection.transaction(async (session) => {
    if (changes.fullName !== undefined) rider.fullName = changes.fullName;
    if (changes.phone !== undefined) rider.phone = changes.phone;
    if (changes.email !== undefined) rider.email = changes.email ?? undefined;
    if (changes.vehicleNumber !== undefined) rider.riderProfile.vehicleNumber = changes.vehicleNumber ?? undefined;
    if (changes.notes !== undefined) rider.riderProfile.notes = changes.notes ?? undefined;

    await rider.save({ session });
    await recordAudit({
      actor: admin,
      action: AUDIT_ACTION.RIDER_UPDATED,
      entityType: 'User',
      entityId: rider._id,
      metadata: { changedFields },
      req,
      session,
    });
  });

  return rider;
}

export async function setRiderActive(id, isActive, admin, req) {
  const rider = await findRiderOrThrow(id);
  if (rider.isActive === isActive) return rider;

  await mongoose.connection.transaction(async (session) => {
    rider.isActive = isActive;
    // Ends every open login, so a deactivated rider is signed out immediately.
    if (!isActive) rider.tokenVersion += 1;

    await rider.save({ session });
    await recordAudit({
      actor: admin,
      action: isActive ? AUDIT_ACTION.RIDER_ACTIVATED : AUDIT_ACTION.RIDER_DEACTIVATED,
      entityType: 'User',
      entityId: rider._id,
      req,
      session,
    });
  });

  // Ends any live connection straight away, not just the next request.
  if (!isActive) disconnectUser(rider._id);

  return rider;
}

export async function resetRiderCredentials(id, admin, req) {
  const rider = await findRiderOrThrow(id);
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  await mongoose.connection.transaction(async (session) => {
    rider.passwordHash = passwordHash;
    rider.mustChangePassword = true;
    rider.tokenVersion += 1;
    rider.passwordReset = { tokenHash: undefined, expiresAt: undefined };

    await rider.save({ session });
    await recordAudit({
      actor: admin,
      action: AUDIT_ACTION.RIDER_CREDENTIALS_RESET,
      entityType: 'User',
      entityId: rider._id,
      req,
      session,
    });
  });

  disconnectUser(rider._id);

  return { rider, temporaryPassword };
}

export async function deleteRider(id, admin, req) {
  const rider = await findRiderOrThrow(id);

  await mongoose.connection.transaction(async (session) => {
    await Delivery.deleteMany({ rider: rider._id }).session(session);
    await Order.updateMany({ currentRider: rider._id }, { $unset: { currentRider: 1 } }).session(session);
    await User.findByIdAndDelete(rider._id).session(session);

    await recordAudit({
      actor: admin,
      action: AUDIT_ACTION.RIDER_DELETED,
      entityType: 'User',
      entityId: rider._id,
      metadata: { riderName: rider.fullName, riderId: rider.riderProfile?.riderId, phone: rider.phone },
      req,
      session,
    });
  });

  disconnectUser(rider._id);
  return { id: rider._id, riderName: rider.fullName, deleted: true };
}

export async function deleteRiders(ids, admin, req) {
  if (!Array.isArray(ids) || ids.length === 0) return { deletedCount: 0 };
  const validIds = ids.filter((id) => mongoose.isValidObjectId(id));
  const riders = await User.find({ _id: { $in: validIds }, role: ROLES.RIDER });
  if (riders.length === 0) return { deletedCount: 0 };

  const targetIds = riders.map((r) => r._id);
  await mongoose.connection.transaction(async (session) => {
    await Delivery.deleteMany({ rider: { $in: targetIds } }).session(session);
    await Order.updateMany({ currentRider: { $in: targetIds } }, { $unset: { currentRider: 1 } }).session(session);
    await User.deleteMany({ _id: { $in: targetIds } }).session(session);

    for (const rider of riders) {
      await recordAudit({
        actor: admin,
        action: AUDIT_ACTION.RIDER_DELETED,
        entityType: 'User',
        entityId: rider._id,
        metadata: { riderName: rider.fullName, riderId: rider.riderProfile?.riderId, phone: rider.phone, bulk: true },
        req,
        session,
      });
    }
  });

  riders.forEach((r) => disconnectUser(r._id));
  return { deletedCount: riders.length };
}
