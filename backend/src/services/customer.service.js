import mongoose from 'mongoose';
import { AUDIT_ACTION, ROLES } from '../config/constants.js';
import { Delivery, Invoice, Order, Payment, User } from '../models/index.js';
import { disconnectUser } from '../sockets/index.js';
import { AppError } from '../utils/AppError.js';
import { serializeDelivery, serializeInvoice, serializeOrderSummary, serializePayment } from '../utils/serializeOrder.js';
import { recordAudit } from './audit.service.js';
import { generateTemporaryPassword, hashPassword } from './auth.service.js';
import { deleteImages } from './storage.service.js';

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MAX_ADDRESSES = 10;

export async function updateProfile(user, changes, req) {
  if (changes.fullName !== undefined) user.fullName = changes.fullName;
  if (changes.email !== undefined) user.email = changes.email ?? undefined;
  await user.save();
  await recordAudit({ actor: user, action: AUDIT_ACTION.PROFILE_UPDATED, entityType: 'User', entityId: user._id, metadata: { fields: Object.keys(changes) }, req });
  return user;
}

/** Keeps exactly one default address, whichever was last chosen. */
function makeDefault(user, addressId) {
  for (const address of user.addresses) address.isDefault = address.id === addressId;
}

export async function addAddress(user, input, req) {
  user.addresses ??= [];
  if (user.addresses.length >= MAX_ADDRESSES) {
    throw new AppError(422, 'VALIDATION_ERROR', `You can save up to ${MAX_ADDRESSES} addresses.`);
  }
  user.addresses.push({ ...input, isDefault: false });
  const added = user.addresses[user.addresses.length - 1];
  if (input.isDefault || user.addresses.length === 1) makeDefault(user, added.id);

  await user.save();
  await recordAudit({ actor: user, action: AUDIT_ACTION.ADDRESS_SAVED, entityType: 'User', entityId: user._id, req });
  return user;
}

function findAddress(user, addressId) {
  const address = user.addresses?.id(addressId);
  if (!address) throw new AppError(404, 'NOT_FOUND', 'That address could not be found.');
  return address;
}

export async function updateAddress(user, addressId, input, req) {
  const address = findAddress(user, addressId);
  const { isDefault, ...fields } = input;
  address.set({ ...fields, location: fields.location ?? undefined });
  if (isDefault) makeDefault(user, address.id);

  await user.save();
  await recordAudit({ actor: user, action: AUDIT_ACTION.ADDRESS_SAVED, entityType: 'User', entityId: user._id, req });
  return user;
}

export async function deleteAddress(user, addressId, req) {
  const address = findAddress(user, addressId);
  if (user.addresses.length === 1) {
    throw new AppError(409, 'INVALID_STATE', 'Keep at least one address so the store knows where to deliver.');
  }
  const wasDefault = address.isDefault;
  address.deleteOne();
  if (wasDefault) makeDefault(user, user.addresses[0].id);

  await user.save();
  await recordAudit({ actor: user, action: AUDIT_ACTION.ADDRESS_DELETED, entityType: 'User', entityId: user._id, req });
  return user;
}

export async function setDefaultAddress(user, addressId, req) {
  findAddress(user, addressId);
  makeDefault(user, addressId);
  await user.save();
  await recordAudit({ actor: user, action: AUDIT_ACTION.ADDRESS_SAVED, entityType: 'User', entityId: user._id, req });
  return user;
}

/** Customer list for the admin, with how many orders each has placed. */
export async function listCustomers({ page, pageSize, search }) {
  const filter = { role: ROLES.CUSTOMER };
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ fullName: pattern }, { phone: pattern }, { email: pattern }];
  }

  const [customers, totalItems] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
    User.countDocuments(filter),
  ]);

  const counts = await Order.aggregate([
    { $match: { customer: { $in: customers.map((customer) => customer._id) } } },
    { $group: { _id: '$customer', orders: { $sum: 1 }, lastOrderAt: { $max: '$createdAt' } } },
  ]);
  const byCustomer = new Map(counts.map((entry) => [String(entry._id), entry]));

  return {
    customers: customers.map((customer) => ({
      id: customer.id,
      fullName: customer.fullName,
      phone: customer.phone,
      email: customer.email ?? null,
      isActive: customer.isActive,
      createdAt: customer.createdAt,
      orderCount: byCustomer.get(customer.id)?.orders ?? 0,
      lastOrderAt: byCustomer.get(customer.id)?.lastOrderAt ?? null,
    })),
    totalItems,
  };
}

/** A customer's full record for the admin: profile, addresses and every kind of history. */
export async function getCustomerRecord(customerId) {
  if (!mongoose.isValidObjectId(customerId)) throw new AppError(404, 'NOT_FOUND', 'That customer could not be found.');
  const customer = await User.findOne({ _id: customerId, role: ROLES.CUSTOMER });
  if (!customer) throw new AppError(404, 'NOT_FOUND', 'That customer could not be found.');

  const [orders, invoices, payments, deliveries] = await Promise.all([
    Order.find({ customer: customer._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('invoice', 'status grandTotalPaise lineItems')
      .populate('payment', 'method status')
      .populate({ path: 'delivery', select: 'rider', populate: { path: 'rider', select: 'fullName' } }),
    Invoice.find({ customer: customer._id, status: { $ne: 'DRAFT' } }).sort({ createdAt: -1 }).limit(100).populate('order', 'orderNumber'),
    Payment.find({ customer: customer._id }).sort({ createdAt: -1 }).limit(100).populate('order', 'orderNumber').populate('collectedBy', 'fullName'),
    Delivery.find({ customer: customer._id }).sort({ createdAt: -1 }).limit(100).populate('order', 'orderNumber').populate('rider', 'fullName phone riderProfile'),
  ]);

  return {
    customer: {
      id: customer.id,
      fullName: customer.fullName,
      phone: customer.phone,
      email: customer.email ?? null,
      isActive: customer.isActive,
      createdAt: customer.createdAt,
      lastLoginAt: customer.lastLoginAt ?? null,
      addresses: (customer.addresses ?? []).map((address) => ({
        id: address.id,
        label: address.label,
        isDefault: address.isDefault,
        fullAddress: address.fullAddress,
        area: address.area,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        location: address.location?.lat != null ? { lat: address.location.lat, lng: address.location.lng } : null,
        deliveryInstructions: address.deliveryInstructions ?? null,
      })),
    },
    orders: orders.map((order) => ({
      ...serializeOrderSummary(order, { viewerRole: ROLES.CUSTOMER, invoice: order.invoice, payment: order.payment, delivery: order.delivery }),
      requestedItems: order.requestedItems?.map((item) => ({
        description: item.description,
        quantity: item.quantity,
      })) ?? [],
      lineItems: order.invoice?.lineItems?.map((item) => ({
        description: item.description,
        quantity: item.quantity,
      })) ?? [],
    })),
    invoices: invoices.map((invoice) => ({ ...serializeInvoice(invoice), orderNumber: invoice.order?.orderNumber ?? null })),
    payments: payments.map((payment) => ({ ...serializePayment(payment, { viewerRole: ROLES.ADMIN }), orderNumber: payment.order?.orderNumber ?? null })),
    deliveries: deliveries.map((delivery) => ({ ...serializeDelivery(delivery), orderNumber: delivery.order?.orderNumber ?? null })),
  };
}

/** For customers with no email, who cannot use "Forgot password". */
export async function resetCustomerCredentials(customerId, admin, req) {
  if (!mongoose.isValidObjectId(customerId)) throw new AppError(404, 'NOT_FOUND', 'That customer could not be found.');
  const customer = await User.findOne({ _id: customerId, role: ROLES.CUSTOMER }).select('+tokenVersion');
  if (!customer) throw new AppError(404, 'NOT_FOUND', 'That customer could not be found.');

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  await mongoose.connection.transaction(async (session) => {
    customer.passwordHash = passwordHash;
    customer.mustChangePassword = true;
    customer.tokenVersion += 1;
    customer.passwordReset = { tokenHash: undefined, expiresAt: undefined };
    await customer.save({ session });
    await recordAudit({ actor: admin, action: AUDIT_ACTION.CUSTOMER_CREDENTIALS_RESET, entityType: 'User', entityId: customer._id, req, session });
  });

  disconnectUser(customer._id);
  return { customer, temporaryPassword };
}

export async function updateCustomerByAdmin(customerId, input, admin, req) {
  if (!mongoose.isValidObjectId(customerId)) throw new AppError(404, 'NOT_FOUND', 'Customer not found.');
  const customer = await User.findOne({ _id: customerId, role: ROLES.CUSTOMER });
  if (!customer) throw new AppError(404, 'NOT_FOUND', 'Customer not found.');

  if (input.phone && input.phone !== customer.phone) {
    const existing = await User.findOne({ phone: input.phone, _id: { $ne: customer._id } });
    if (existing) throw new AppError(409, 'CONFLICT', 'This phone number is already registered to another account.');
    customer.phone = input.phone;
  }

  if (input.email !== undefined && input.email !== customer.email) {
    if (input.email) {
      const existing = await User.findOne({ email: input.email.toLowerCase(), _id: { $ne: customer._id } });
      if (existing) throw new AppError(409, 'CONFLICT', 'This email address is already in use.');
      customer.email = input.email.toLowerCase();
    } else {
      customer.email = undefined;
    }
  }

  if (input.fullName !== undefined) {
    customer.fullName = input.fullName.trim();
  }

  if (input.isActive !== undefined) {
    customer.isActive = Boolean(input.isActive);
    if (!customer.isActive) {
      customer.tokenVersion += 1;
      disconnectUser(customer._id);
    }
  }

  await customer.save();
  await recordAudit({
    actor: admin,
    action: AUDIT_ACTION.PROFILE_UPDATED,
    entityType: 'User',
    entityId: customer._id,
    metadata: { updatedBy: 'ADMIN', fields: Object.keys(input) },
    req,
  });

  return customer;
}

export async function deleteCustomerByAdmin(customerId, admin, req) {
  if (!mongoose.isValidObjectId(customerId)) throw new AppError(404, 'NOT_FOUND', 'Customer not found.');
  const customer = await User.findOne({ _id: customerId, role: ROLES.CUSTOMER });
  if (!customer) throw new AppError(404, 'NOT_FOUND', 'Customer not found.');

  const customerOrders = await Order.find({ customer: customer._id }).select('_id requestPhotos');
  const orderIds = customerOrders.map((o) => o._id);
  const photoKeys = customerOrders.flatMap((o) => o.requestPhotos?.map((p) => p.storageKey) || []).filter(Boolean);

  await mongoose.connection.transaction(async (session) => {
    if (orderIds.length > 0) {
      await Invoice.deleteMany({ order: { $in: orderIds } }).session(session);
      await Delivery.deleteMany({ order: { $in: orderIds } }).session(session);
      await Payment.deleteMany({ order: { $in: orderIds } }).session(session);
      await Order.deleteMany({ _id: { $in: orderIds } }).session(session);
    }
    await User.findByIdAndDelete(customer._id).session(session);
    await recordAudit({
      actor: admin,
      action: AUDIT_ACTION.CUSTOMER_DELETED,
      entityType: 'User',
      entityId: customer._id,
      metadata: { customerName: customer.fullName, phone: customer.phone, deletedOrdersCount: orderIds.length },
      req,
      session,
    });
  });

  disconnectUser(customer._id);

  if (photoKeys.length > 0) {
    await deleteImages(photoKeys);
  }

  return { customerId: customer.id, customerName: customer.fullName, deleted: true };
}

export async function deleteCustomersByAdmin(customerIds, admin, req) {
  if (!Array.isArray(customerIds) || customerIds.length === 0) return { deletedCount: 0 };
  const validIds = customerIds.filter((id) => mongoose.isValidObjectId(id));
  const customers = await User.find({ _id: { $in: validIds }, role: ROLES.CUSTOMER });
  if (customers.length === 0) return { deletedCount: 0 };

  const targetIds = customers.map((c) => c._id);
  const customerOrders = await Order.find({ customer: { $in: targetIds } }).select('_id requestPhotos');
  const orderIds = customerOrders.map((o) => o._id);
  const photoKeys = customerOrders.flatMap((o) => o.requestPhotos?.map((p) => p.storageKey) || []).filter(Boolean);

  await mongoose.connection.transaction(async (session) => {
    if (orderIds.length > 0) {
      await Invoice.deleteMany({ order: { $in: orderIds } }).session(session);
      await Delivery.deleteMany({ order: { $in: orderIds } }).session(session);
      await Payment.deleteMany({ order: { $in: orderIds } }).session(session);
      await Order.deleteMany({ _id: { $in: orderIds } }).session(session);
    }
    await User.deleteMany({ _id: { $in: targetIds } }).session(session);

    for (const customer of customers) {
      await recordAudit({
        actor: admin,
        action: AUDIT_ACTION.CUSTOMER_DELETED,
        entityType: 'User',
        entityId: customer._id,
        metadata: { customerName: customer.fullName, phone: customer.phone, bulk: true },
        req,
        session,
      });
    }
  });

  customers.forEach((c) => disconnectUser(c._id));

  if (photoKeys.length > 0) {
    await deleteImages(photoKeys);
  }

  return { deletedCount: customers.length };
}
