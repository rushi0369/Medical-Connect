import mongoose from 'mongoose';
import {
  AUDIT_ACTION,
  CUSTOMER_CANCELLABLE_STATUSES,
  DELIVERY_STATUS,
  NOTIFICATION_TYPE,
  ORDER_STATUS,
  PAYMENT_STATUS,
  ROLES,
} from '../config/constants.js';
import { nextSequence } from '../models/Counter.js';
import { Delivery, DeliveryEvent, Invoice, Order, Payment, User } from '../models/index.js';
import { publishOrderChange } from '../sockets/index.js';
import { AppError } from '../utils/AppError.js';
import { afterCommit } from '../utils/afterCommit.js';
import { serializeOrderDetail, serializeOrderSummary } from '../utils/serializeOrder.js';
import { indiaDateStamp } from '../utils/time.js';
import { recordAudit } from './audit.service.js';
import { notify } from './notification.service.js';
import { cancelPaymentLink, isUpiConfigured } from './razorpay.service.js';
import { deleteImages, detectImageType, saveImage } from './storage.service.js';

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const orderNotFound = () => new AppError(404, 'NOT_FOUND', 'That order could not be found.');

export function conflict(message) {
  return new AppError(409, 'INVALID_STATE', message);
}

/** Records a status change on the order with who made it and when. */
export function recordStatus(order, status, actor, note) {
  order.status = status;
  order.statusHistory.push({ status, actor: actor._id, actorRole: actor.role, note, at: new Date() });
}

async function nextOrderNumber(session) {
  const day = indiaDateStamp();
  const sequence = await nextSequence(`order-${day}`, session);
  return `CK-${day}-${String(sequence).padStart(4, '0')}`;
}

function snapshotOf(address) {
  return {
    fullAddress: address.fullAddress,
    area: address.area,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    location: address.location?.lat != null ? { lat: address.location.lat, lng: address.location.lng } : undefined,
    deliveryInstructions: address.deliveryInstructions,
  };
}

/**
 * Finds an order the viewer is allowed to see. Anything else looks like it does not
 * exist, so nobody can discover other people's order IDs by trying them.
 */
export async function findOrderForViewer(id, viewer, session = null) {
  if (!mongoose.isValidObjectId(id)) throw orderNotFound();

  const filter = { _id: id };
  if (viewer.role === ROLES.CUSTOMER) filter.customer = viewer._id;
  if (viewer.role === ROLES.RIDER && !(await Delivery.exists({ order: id, rider: viewer._id }).session(session))) {
    throw orderNotFound();
  }

  const order = await Order.findOne(filter).session(session);
  if (!order) throw orderNotFound();
  return order;
}

export async function createOrder({ customer, data, files, req }) {
  const address = customer.addresses?.id(data.addressId);
  if (!address) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please choose one of your saved addresses.', {
      fieldErrors: { addressId: ['Please choose one of your saved addresses.'] },
    });
  }
  if (files.length === 0 && data.requestedItems.length === 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Add at least one photo or one medicine.');
  }

  const savedPhotoIds = [];
  try {
    const photos = [];
    for (const file of files) {
      const type = detectImageType(file.buffer);
      if (!type) throw new AppError(422, 'INVALID_IMAGE', `${file.originalname} is not a JPG, PNG or WEBP image.`);

      const id = await saveImage({ buffer: file.buffer, contentType: type, filename: file.originalname, ownerId: customer._id });
      savedPhotoIds.push(id);
      photos.push({ url: `/uploads/${id}`, storageKey: id, originalName: file.originalname.slice(0, 255) });
    }

    let order;
    await mongoose.connection.transaction(async (session) => {
      order = new Order({
        orderNumber: await nextOrderNumber(session),
        customer: customer._id,
        addressSnapshot: snapshotOf(address),
        requestPhotos: photos,
        requestedItems: data.requestedItems,
        customerInstructions: data.customerInstructions,
      });
      recordStatus(order, ORDER_STATUS.PENDING_ADMIN_REVIEW, customer, 'Request submitted');
      await order.save({ session });
      await recordAudit({
        actor: customer,
        action: AUDIT_ACTION.ORDER_CREATED,
        entityType: 'Order',
        entityId: order._id,
        metadata: { orderNumber: order.orderNumber, photos: photos.length, items: data.requestedItems.length },
        req,
        session,
      });
    });

    await afterCommit(
      () =>
        notify({
          to: 'admins',
          type: NOTIFICATION_TYPE.NEW_ORDER,
          title: 'New medicine request',
          message: `${customer.fullName} sent request ${order.orderNumber}.`,
          order,
        }),
      () => publishOrderChange(order),
    );
    return order;
  } catch (error) {
    await deleteImages(savedPhotoIds);
    throw error;
  }
}

export async function listOrders({ viewer, page, pageSize, statuses, search }) {
  const filter = {};
  if (viewer.role === ROLES.CUSTOMER) filter.customer = viewer._id;
  if (statuses?.length) filter.status = { $in: statuses };

  if (search && viewer.role === ROLES.ADMIN) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    const customers = await User.find({ role: ROLES.CUSTOMER, $or: [{ fullName: pattern }, { phone: pattern }] })
      .select('_id')
      .limit(200);
    filter.$or = [{ orderNumber: pattern }, { customer: { $in: customers.map((customer) => customer._id) } }];
  } else if (search) {
    filter.orderNumber = new RegExp(escapeRegex(search), 'i');
  }

  const [orders, totalItems] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate('customer', 'fullName phone')
      .populate('invoice', 'status grandTotalPaise')
      .populate('payment', 'method status')
      .populate({ path: 'delivery', select: 'rider', populate: { path: 'rider', select: 'fullName' } }),
    Order.countDocuments(filter),
  ]);

  return {
    orders: orders.map((order) =>
      serializeOrderSummary(order, {
        viewerRole: viewer.role,
        invoice: order.invoice,
        payment: order.payment,
        delivery: order.delivery,
      }),
    ),
    totalItems,
  };
}

/** Everything the order page needs, limited to what this viewer may see. */
export async function getOrderDetail(id, viewer) {
  await findOrderForViewer(id, viewer);

  const [order, invoices, payment, deliveries] = await Promise.all([
    Order.findById(id).populate('customer', 'fullName phone email'),
    Invoice.find({ order: id }).sort({ version: -1 }),
    Payment.findOne({ order: id }).sort({ createdAt: -1 }).populate('collectedBy', 'fullName'),
    Delivery.find({ order: id }).sort({ createdAt: -1 }).populate('rider', 'fullName phone riderProfile'),
  ]);

  let eventsByDelivery;
  if (viewer.role === ROLES.ADMIN && deliveries.length) {
    const events = await DeliveryEvent.find({ order: id }).sort({ createdAt: 1 });
    eventsByDelivery = new Map();
    for (const event of events) {
      const key = event.delivery.toString();
      eventsByDelivery.set(key, [...(eventsByDelivery.get(key) ?? []), event]);
    }
  }

  return serializeOrderDetail(order, {
    viewerRole: viewer.role,
    invoices,
    payment,
    deliveries,
    eventsByDelivery,
    upiAvailable: isUpiConfigured(),
  });
}

export async function startReview(id, admin, req) {
  let order;
  await mongoose.connection.transaction(async (session) => {
    order = await findOrderForViewer(id, admin, session);
    if (order.status !== ORDER_STATUS.PENDING_ADMIN_REVIEW) throw conflict('This request is already being handled.');

    recordStatus(order, ORDER_STATUS.UNDER_REVIEW, admin, 'Store is checking availability');
    await order.save({ session });
    await recordAudit({ actor: admin, action: AUDIT_ACTION.ORDER_REVIEW_STARTED, entityType: 'Order', entityId: order._id, req, session });
  });

  await afterCommit(
    () =>
      notify({
        to: order.customer,
        type: NOTIFICATION_TYPE.ORDER_UNDER_REVIEW,
        title: 'Your request is being reviewed',
        message: `The store is checking the medicines for ${order.orderNumber}.`,
        order,
      }),
    () => publishOrderChange(order),
  );
  return order;
}

/** The admin's notes from checking the shelves: unavailable items and suggested alternatives. */
export async function saveReviewNotes(id, changes, admin, req) {
  let order;
  await mongoose.connection.transaction(async (session) => {
    order = await findOrderForViewer(id, admin, session);
    if (order.status !== ORDER_STATUS.UNDER_REVIEW) throw conflict('Review notes can only be changed while the order is under review.');

    if (changes.adminRemarks !== undefined) order.adminRemarks = changes.adminRemarks ?? undefined;
    for (const change of changes.requestedItems ?? []) {
      const item = order.requestedItems.id(change.id);
      if (!item) throw new AppError(422, 'VALIDATION_ERROR', 'One of the requested items no longer exists.');
      item.isUnavailable = change.isUnavailable;
      item.alternativeNote = change.alternativeNote ?? undefined;
    }

    await order.save({ session });
    await recordAudit({ actor: admin, action: AUDIT_ACTION.ORDER_REVIEW_UPDATED, entityType: 'Order', entityId: order._id, req, session });
  });

  await afterCommit(() => publishOrderChange(order));
  return order;
}

export async function cancelOrder(id, { reason }, viewer, req) {
  let order;
  let cancelledLinkId = null;
  let affectedRider = null;

  await mongoose.connection.transaction(async (session) => {
    order = await findOrderForViewer(id, viewer, session);
    cancelledLinkId = null;
    affectedRider = null;

    const allowed =
      viewer.role === ROLES.CUSTOMER
        ? CUSTOMER_CANCELLABLE_STATUSES.includes(order.status)
        : ![ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED].includes(order.status);
    if (!allowed) {
      throw conflict(
        viewer.role === ROLES.CUSTOMER
          ? 'This order can no longer be cancelled here. Please contact the store.'
          : 'This order can no longer be cancelled.',
      );
    }

    const delivery = await Delivery.findOne({ order: order._id, isCurrent: true }).session(session);
    if (delivery && [DELIVERY_STATUS.RIDER_ASSIGNED, DELIVERY_STATUS.OUT_FOR_DELIVERY, DELIVERY_STATUS.REACHED_CUSTOMER].includes(delivery.status)) {
      delivery.status = DELIVERY_STATUS.CANCELLED;
      delivery.isCurrent = false;
      await delivery.save({ session });
      await DeliveryEvent.create(
        [
          {
            delivery: delivery._id,
            order: order._id,
            customer: order.customer,
            rider: delivery.rider,
            status: DELIVERY_STATUS.CANCELLED,
            actor: viewer._id,
            actorRole: viewer.role,
            note: reason,
          },
        ],
        { session },
      );
      affectedRider = delivery.rider;
    }

    const payment = await Payment.findOne({ order: order._id }).session(session);
    if (payment?.status === PAYMENT_STATUS.PAID) {
      payment.status = PAYMENT_STATUS.REFUND_PENDING;
      await payment.save({ session });
    } else if (payment?.status === PAYMENT_STATUS.PENDING && payment.gatewayLinkId) {
      cancelledLinkId = payment.gatewayLinkId;
    }

    order.cancellation = { reason, by: viewer._id, byRole: viewer.role, at: new Date() };
    order.currentRider = undefined;
    recordStatus(order, ORDER_STATUS.CANCELLED, viewer, reason);
    await order.save({ session });
    await recordAudit({
      actor: viewer,
      action: AUDIT_ACTION.ORDER_CANCELLED,
      entityType: 'Order',
      entityId: order._id,
      metadata: { reason },
      req,
      session,
    });
  });

  await afterCommit(
    async () => {
      if (cancelledLinkId) await cancelPaymentLink(cancelledLinkId);
    },
    () =>
      notify({
        to: viewer.role === ROLES.CUSTOMER ? 'admins' : order.customer,
        type: NOTIFICATION_TYPE.ORDER_CANCELLED,
        title: `Order ${order.orderNumber} was cancelled`,
        message: reason ? `Reason: ${reason}` : 'The order was cancelled.',
        order,
      }),
    () =>
      affectedRider &&
      notify({
        to: affectedRider,
        type: NOTIFICATION_TYPE.ASSIGNMENT_REMOVED,
        title: 'Delivery cancelled',
        message: `Order ${order.orderNumber} was cancelled. You no longer need to deliver it.`,
        order,
      }),
    () => publishOrderChange(order),
  );
  return order;
}

/** Starts a new request with the same photos, medicines and address as an earlier order. */
export async function reorder(id, customer, req) {
  const original = await findOrderForViewer(id, customer);
  if (![ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED].includes(original.status)) {
    throw conflict('You can reorder once this order is delivered or cancelled.');
  }

  let order;
  await mongoose.connection.transaction(async (session) => {
    order = new Order({
      orderNumber: await nextOrderNumber(session),
      customer: customer._id,
      addressSnapshot: original.addressSnapshot.toObject(),
      requestPhotos: original.requestPhotos.map(({ url, storageKey, originalName }) => ({ url, storageKey, originalName })),
      requestedItems: original.requestedItems.map(({ description, quantity, notes }) => ({ description, quantity, notes })),
      customerInstructions: original.customerInstructions,
    });
    recordStatus(order, ORDER_STATUS.PENDING_ADMIN_REVIEW, customer, `Reorder of ${original.orderNumber}`);
    await order.save({ session });
    await recordAudit({
      actor: customer,
      action: AUDIT_ACTION.ORDER_CREATED,
      entityType: 'Order',
      entityId: order._id,
      metadata: { orderNumber: order.orderNumber, reorderOf: original.orderNumber },
      req,
      session,
    });
  });

  await afterCommit(
    () =>
      notify({
        to: 'admins',
        type: NOTIFICATION_TYPE.NEW_ORDER,
        title: 'New medicine request',
        message: `${customer.fullName} reordered ${original.orderNumber} as ${order.orderNumber}.`,
        order,
      }),
    () => publishOrderChange(order),
  );
  return order;
}

/** Admin permanently deletes an individual order and its related records & photos. */
export async function deleteOrder(id, admin, req) {
  if (!mongoose.isValidObjectId(id)) throw orderNotFound();
  const order = await Order.findById(id);
  if (!order) throw orderNotFound();

  const photoKeys = order.requestPhotos?.map((p) => p.storageKey).filter(Boolean) ?? [];

  await mongoose.connection.transaction(async (session) => {
    await Invoice.deleteMany({ order: order._id }).session(session);
    await Delivery.deleteMany({ order: order._id }).session(session);
    await Payment.deleteMany({ order: order._id }).session(session);
    await Order.findByIdAndDelete(order._id).session(session);

    await recordAudit({
      actor: admin,
      action: AUDIT_ACTION.ORDER_DELETED,
      entityType: 'Order',
      entityId: order._id,
      metadata: { orderNumber: order.orderNumber, status: order.status },
      req,
      session,
    });
  });

  if (photoKeys.length > 0) {
    await deleteImages(photoKeys);
  }

  return { orderNumber: order.orderNumber, deleted: true };
}

/** Admin deletes multiple selected orders permanently. */
export async function deleteOrders(ids, admin, req) {
  if (!Array.isArray(ids) || ids.length === 0) return { deletedCount: 0 };
  const validIds = ids.filter((id) => mongoose.isValidObjectId(id));
  const orders = await Order.find({ _id: { $in: validIds } });
  if (orders.length === 0) return { deletedCount: 0 };

  const photoKeys = [];
  orders.forEach((o) => {
    (o.requestPhotos || []).forEach((p) => {
      if (p.storageKey) photoKeys.push(p.storageKey);
    });
  });

  const orderIds = orders.map((o) => o._id);
  await mongoose.connection.transaction(async (session) => {
    await Invoice.deleteMany({ order: { $in: orderIds } }).session(session);
    await Delivery.deleteMany({ order: { $in: orderIds } }).session(session);
    await Payment.deleteMany({ order: { $in: orderIds } }).session(session);
    await Order.deleteMany({ _id: { $in: orderIds } }).session(session);

    for (const order of orders) {
      await recordAudit({
        actor: admin,
        action: AUDIT_ACTION.ORDER_DELETED,
        entityType: 'Order',
        entityId: order._id,
        metadata: { orderNumber: order.orderNumber, status: order.status, bulk: true },
        req,
        session,
      });
    }
  });

  if (photoKeys.length > 0) {
    await deleteImages(photoKeys);
  }

  return { deletedCount: orders.length };
}

/** Admin deletes old orders older than X days to prevent database from getting full. */
export async function purgeOldOrders({ days = 30, scope = 'ALL' }, admin, req) {
  const daysNum = Math.max(1, parseInt(days) || 30);
  const cutoff = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

  const filter = { createdAt: { $lte: cutoff } };
  if (scope === 'COMPLETED') {
    filter.status = { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED, ORDER_STATUS.DELIVERY_FAILED] };
  } else if (scope === 'CANCELLED') {
    filter.status = ORDER_STATUS.CANCELLED;
  } else if (scope === 'DELIVERED') {
    filter.status = ORDER_STATUS.DELIVERED;
  }

  const matchingOrders = await Order.find(filter).select('_id requestPhotos orderNumber');
  if (matchingOrders.length === 0) {
    return { deletedOrdersCount: 0, freedPhotosCount: 0, days: daysNum };
  }

  const orderIds = matchingOrders.map((o) => o._id);
  const photoKeys = matchingOrders.flatMap((o) => o.requestPhotos?.map((p) => p.storageKey) || []).filter(Boolean);

  await mongoose.connection.transaction(async (session) => {
    await Invoice.deleteMany({ order: { $in: orderIds } }).session(session);
    await Delivery.deleteMany({ order: { $in: orderIds } }).session(session);
    await Payment.deleteMany({ order: { $in: orderIds } }).session(session);
    await Order.deleteMany({ _id: { $in: orderIds } }).session(session);

    await recordAudit({
      actor: admin,
      action: AUDIT_ACTION.ORDERS_PURGED,
      entityType: 'Order',
      metadata: { days: daysNum, scope, count: orderIds.length },
      req,
      session,
    });
  });

  if (photoKeys.length > 0) {
    await deleteImages(photoKeys);
  }

  return {
    deletedOrdersCount: orderIds.length,
    freedPhotosCount: photoKeys.length,
    days: daysNum,
  };
}
