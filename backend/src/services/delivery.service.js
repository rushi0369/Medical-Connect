import mongoose from 'mongoose';
import {
  ACTIVE_DELIVERY_STATUSES,
  AUDIT_ACTION,
  DELIVERY_FAILURE_REASON,
  DELIVERY_STATUS,
  NOTIFICATION_TYPE,
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  ROLES,
  SETTLEMENT_STATUS,
} from '../config/constants.js';
import { Delivery, DeliveryEvent, Invoice, Order, Payment, User } from '../models/index.js';
import { emitToAdmins, emitToUsers, publishOrderChange } from '../sockets/index.js';
import { AppError } from '../utils/AppError.js';
import { afterCommit } from '../utils/afterCommit.js';
import { formatRupees } from '../utils/money.js';
import { serializeAddress, serializeDelivery, serializePayment } from '../utils/serializeOrder.js';
import { recordAudit } from './audit.service.js';
import { notify } from './notification.service.js';
import { conflict, findOrderForViewer, recordStatus } from './order.service.js';

const deliveryNotFound = () => new AppError(404, 'NOT_FOUND', 'That delivery could not be found.');

const REASSIGNABLE_ORDER_STATUSES = [
  ORDER_STATUS.RIDER_ASSIGNED,
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.REACHED_CUSTOMER,
  ORDER_STATUS.DELIVERY_FAILED,
];

const FAILURE_LABELS = {
  [DELIVERY_FAILURE_REASON.CUSTOMER_UNAVAILABLE]: 'Customer unavailable',
  [DELIVERY_FAILURE_REASON.INCORRECT_ADDRESS]: 'Incorrect address',
  [DELIVERY_FAILURE_REASON.CUSTOMER_REFUSED]: 'Customer refused delivery',
  [DELIVERY_FAILURE_REASON.UNABLE_TO_CONTACT]: 'Unable to contact customer',
  [DELIVERY_FAILURE_REASON.OTHER]: 'Other',
};

function addEvent({ delivery, order, status, actor, note }, session) {
  return DeliveryEvent.create(
    [
      {
        delivery: delivery._id,
        order: order._id,
        customer: order.customer,
        rider: delivery.rider,
        status,
        actor: actor._id,
        actorRole: actor.role,
        note,
      },
    ],
    { session },
  );
}

function publishDeliveryChange(delivery, order) {
  const payload = { deliveryId: delivery.id, orderId: String(order._id), status: delivery.status };
  emitToUsers([order.customer, delivery.rider], 'delivery:updated', payload);
  emitToAdmins('delivery:updated', payload);
}

/** Active riders with how many deliveries each is already carrying. */
export async function listAvailableRiders() {
  const riders = await User.find({ role: ROLES.RIDER, isActive: true }).sort({ fullName: 1 });
  const workload = await Delivery.aggregate([
    { $match: { isCurrent: true, status: { $in: ACTIVE_DELIVERY_STATUSES } } },
    { $group: { _id: '$rider', count: { $sum: 1 } } },
  ]);
  const counts = new Map(workload.map((entry) => [String(entry._id), entry.count]));

  return riders.map((rider) => ({
    id: rider.id,
    fullName: rider.fullName,
    phone: rider.phone,
    riderId: rider.riderProfile.riderId,
    activeDeliveries: counts.get(rider.id) ?? 0,
  }));
}

/**
 * Assigns a rider, or replaces the current one. The old assignment is kept, marked
 * as reassigned, so the history shows both riders.
 */
export async function assignRider(orderId, riderId, admin, req) {
  let order;
  let delivery;
  let previousRider = null;

  await mongoose.connection.transaction(async (session) => {
    order = await findOrderForViewer(orderId, admin, session);
    previousRider = null;

    const isFirstAssignment = order.status === ORDER_STATUS.CONFIRMED;
    if (!isFirstAssignment && !REASSIGNABLE_ORDER_STATUSES.includes(order.status)) {
      throw conflict('A rider can only be assigned once the customer has approved the bill.');
    }

    const rider = mongoose.isValidObjectId(riderId)
      ? await User.findOne({ _id: riderId, role: ROLES.RIDER }).session(session)
      : null;
    if (!rider) throw new AppError(422, 'VALIDATION_ERROR', 'Choose a rider from the list.');
    if (!rider.isActive) throw conflict(`${rider.fullName} is deactivated and cannot be given deliveries.`);

    const current = await Delivery.findOne({ order: order._id, isCurrent: true }).session(session);
    if (current) {
      if (current.rider.equals(rider._id) && ACTIVE_DELIVERY_STATUSES.includes(current.status)) {
        throw conflict(`${rider.fullName} is already assigned to this order.`);
      }
      previousRider = current.rider;
      if (ACTIVE_DELIVERY_STATUSES.includes(current.status)) {
        current.status = DELIVERY_STATUS.REASSIGNED;
        await addEvent({ delivery: current, order, status: DELIVERY_STATUS.REASSIGNED, actor: admin, note: `Reassigned to ${rider.fullName}` }, session);
      }
      current.isCurrent = false;
      await current.save({ session });
    }

    [delivery] = await Delivery.create(
      [{ order: order._id, customer: order.customer, rider: rider._id, assignedBy: admin._id }],
      { session },
    );
    await addEvent({ delivery, order, status: DELIVERY_STATUS.RIDER_ASSIGNED, actor: admin, note: `Assigned to ${rider.fullName}` }, session);

    order.currentRider = rider._id;
    order.delivery = delivery._id;
    recordStatus(order, ORDER_STATUS.RIDER_ASSIGNED, admin, `${isFirstAssignment ? 'Assigned' : 'Reassigned'} to ${rider.fullName}`);
    await order.save({ session });
    await recordAudit({
      actor: admin,
      action: AUDIT_ACTION.RIDER_ASSIGNED,
      entityType: 'Order',
      entityId: order._id,
      metadata: { orderNumber: order.orderNumber, rider: rider.id, previousRider: previousRider ? String(previousRider) : null },
      req,
      session,
    });
    delivery.rider = rider;
  });

  await afterCommit(
    () =>
      notify({
        to: delivery.rider._id,
        type: NOTIFICATION_TYPE.NEW_ASSIGNMENT,
        title: 'New delivery assigned',
        message: `Order ${order.orderNumber} to ${order.addressSnapshot.area}, ${order.addressSnapshot.city}.`,
        order,
      }),
    () =>
      notify({
        to: order.customer,
        type: NOTIFICATION_TYPE.RIDER_ASSIGNED,
        title: 'A rider has been assigned',
        message: `${delivery.rider.fullName} will deliver ${order.orderNumber}.`,
        order,
      }),
    () =>
      previousRider &&
      !previousRider.equals(delivery.rider._id) &&
      notify({
        to: previousRider,
        type: NOTIFICATION_TYPE.ASSIGNMENT_REMOVED,
        title: 'Delivery reassigned',
        message: `Order ${order.orderNumber} was given to another rider.`,
        order,
      }),
    () => publishOrderChange(order),
    () => previousRider && emitToUsers([previousRider], 'delivery:updated', { orderId: order.id, status: DELIVERY_STATUS.REASSIGNED }),
  );
  return { order, delivery };
}

async function findRiderDelivery(deliveryId, rider, session = null) {
  if (!mongoose.isValidObjectId(deliveryId)) throw deliveryNotFound();
  const delivery = await Delivery.findOne({ _id: deliveryId, rider: rider._id }).session(session);
  if (!delivery) throw deliveryNotFound();
  return delivery;
}

const RIDER_ACTIONS = {
  start: {
    from: [DELIVERY_STATUS.RIDER_ASSIGNED],
    to: DELIVERY_STATUS.OUT_FOR_DELIVERY,
    orderStatus: ORDER_STATUS.OUT_FOR_DELIVERY,
    stamp: 'outForDeliveryAt',
    customerMessage: (order, rider) => ({ title: 'Out for delivery', message: `${rider.fullName} is on the way with ${order.orderNumber}.` }),
  },
  reach: {
    from: [DELIVERY_STATUS.OUT_FOR_DELIVERY],
    to: DELIVERY_STATUS.REACHED_CUSTOMER,
    orderStatus: ORDER_STATUS.REACHED_CUSTOMER,
    stamp: 'reachedAt',
    customerMessage: (order, rider) => ({ title: 'Your rider has arrived', message: `${rider.fullName} has reached you with ${order.orderNumber}.` }),
  },
  deliver: {
    from: [DELIVERY_STATUS.OUT_FOR_DELIVERY, DELIVERY_STATUS.REACHED_CUSTOMER],
    to: DELIVERY_STATUS.DELIVERED,
    orderStatus: ORDER_STATUS.DELIVERED,
    stamp: 'deliveredAt',
    customerMessage: (order) => ({ title: 'Delivered', message: `Order ${order.orderNumber} has been delivered. Get well soon.` }),
  },
  fail: {
    from: [DELIVERY_STATUS.RIDER_ASSIGNED, DELIVERY_STATUS.OUT_FOR_DELIVERY, DELIVERY_STATUS.REACHED_CUSTOMER],
    to: DELIVERY_STATUS.DELIVERY_FAILED,
    orderStatus: ORDER_STATUS.DELIVERY_FAILED,
    stamp: 'failedAt',
    customerMessage: (order) => ({ title: 'Delivery was not completed', message: `We could not deliver ${order.orderNumber}. The store will contact you.` }),
  },
};

/** A rider moves their own delivery forward. Each step is checked, saved and logged. */
export async function riderUpdate(deliveryId, action, input, rider, req) {
  const step = RIDER_ACTIONS[action];
  let delivery;
  let order;

  await mongoose.connection.transaction(async (session) => {
    delivery = await findRiderDelivery(deliveryId, rider, session);
    if (!delivery.isCurrent) throw conflict('This delivery is no longer assigned to you.');
    if (!step.from.includes(delivery.status)) throw conflict('This step does not fit the delivery\'s current status.');

    order = await Order.findById(delivery.order).session(session);

    if (action === 'deliver') {
      // Medicines are handed over only once payment is confirmed: verified UPI, or cash in hand.
      const payment = await Payment.findOne({ order: order._id }).session(session);
      const isPaid = [PAYMENT_STATUS.PAID, PAYMENT_STATUS.CASH_COLLECTED, PAYMENT_STATUS.SETTLED].includes(payment?.status);
      if (!isPaid) {
        throw conflict(
          payment?.method === PAYMENT_METHOD.CASH
            ? 'Record the cash you collected before marking this delivered.'
            : 'The UPI payment is not verified yet. Ask the customer to pay, then check again.',
        );
      }
    }

    delivery.status = step.to;
    delivery[step.stamp] = new Date();
    if (action === 'fail') {
      delivery.failureReason = input.reason;
      delivery.failureNotes = input.notes ?? undefined;
    }
    await delivery.save({ session });

    const note = action === 'fail' ? `${FAILURE_LABELS[input.reason]}${input.notes ? `: ${input.notes}` : ''}` : undefined;
    await addEvent({ delivery, order, status: step.to, actor: rider, note }, session);

    recordStatus(order, step.orderStatus, rider, note);
    await order.save({ session });
    await recordAudit({
      actor: rider,
      action: AUDIT_ACTION.DELIVERY_STATUS_CHANGED,
      entityType: 'Delivery',
      entityId: delivery._id,
      metadata: { orderNumber: order.orderNumber, status: step.to, reason: input.reason },
      req,
      session,
    });
  });

  const customerNote = step.customerMessage(order, rider);
  await afterCommit(
    () => notify({ to: order.customer, type: NOTIFICATION_TYPE.DELIVERY_UPDATE, ...customerNote, order }),
    () =>
      notify({
        to: 'admins',
        type: NOTIFICATION_TYPE.DELIVERY_UPDATE,
        title: `${order.orderNumber}: ${step.to.replaceAll('_', ' ').toLowerCase()}`,
        message: `${rider.fullName}${action === 'fail' ? ` could not deliver. Reason: ${FAILURE_LABELS[input.reason]}` : ' updated the delivery.'}`,
        order,
      }),
    () => publishOrderChange(order),
    () => publishDeliveryChange(delivery, order),
  );
  return delivery;
}

/** The rider records cash taken from the customer. It must match the approved bill. */
export async function collectCash(deliveryId, { amountPaise }, rider, req) {
  let payment;
  let order;
  await mongoose.connection.transaction(async (session) => {
    const delivery = await findRiderDelivery(deliveryId, rider, session);
    if (!delivery.isCurrent || ![DELIVERY_STATUS.OUT_FOR_DELIVERY, DELIVERY_STATUS.REACHED_CUSTOMER].includes(delivery.status)) {
      throw conflict('Cash can be recorded only while you are delivering this order.');
    }

    order = await Order.findById(delivery.order).session(session);
    payment = await Payment.findOne({ order: order._id }).session(session);
    if (payment?.method !== PAYMENT_METHOD.CASH) throw conflict('This order is not being paid in cash.');
    if (![PAYMENT_STATUS.UNPAID, PAYMENT_STATUS.PENDING].includes(payment.status)) throw conflict('Payment for this order is already recorded.');
    if (amountPaise !== payment.amountPaise) {
      throw new AppError(422, 'VALIDATION_ERROR', `The amount must be exactly ${formatRupees(payment.amountPaise)}.`, {
        fieldErrors: { amountPaise: [`The amount must be exactly ${formatRupees(payment.amountPaise)}.`] },
      });
    }

    payment.status = PAYMENT_STATUS.CASH_COLLECTED;
    payment.collectedBy = rider._id;
    payment.collectedAmountPaise = amountPaise;
    payment.collectedAt = new Date();
    payment.settlementStatus = SETTLEMENT_STATUS.PENDING;
    payment.paymentReference = `CASH-${order.orderNumber}`;
    await payment.save({ session });
    await recordAudit({
      actor: rider,
      action: AUDIT_ACTION.CASH_COLLECTED,
      entityType: 'Payment',
      entityId: payment._id,
      metadata: { orderNumber: order.orderNumber, amountPaise },
      req,
      session,
    });
  });

  await afterCommit(
    () =>
      notify({
        to: 'admins',
        type: NOTIFICATION_TYPE.PAYMENT_UPDATE,
        title: 'Cash collected',
        message: `${rider.fullName} collected ${formatRupees(amountPaise)} for ${order.orderNumber}. Waiting for settlement.`,
        order,
      }),
    () =>
      notify({
        to: order.customer,
        type: NOTIFICATION_TYPE.PAYMENT_UPDATE,
        title: 'Payment received',
        message: `Your cash payment of ${formatRupees(amountPaise)} for ${order.orderNumber} was recorded.`,
        order,
      }),
    () => {
      const payload = { paymentId: payment.id, orderId: order.id, status: payment.status };
      emitToUsers([order.customer, rider._id], 'payment:updated', payload);
      emitToAdmins('payment:updated', payload);
    },
  );
  return payment;
}

/** The rider verifies that the customer completed the online UPI payment at doorstep. */
export async function confirmOnlinePayment(deliveryId, rider, req) {
  let payment;
  let order;
  await mongoose.connection.transaction(async (session) => {
    const delivery = await findRiderDelivery(deliveryId, rider, session);
    if (!delivery.isCurrent || ![DELIVERY_STATUS.OUT_FOR_DELIVERY, DELIVERY_STATUS.REACHED_CUSTOMER].includes(delivery.status)) {
      throw conflict('Online payment can be confirmed only while you are delivering this order.');
    }

    order = await Order.findById(delivery.order).session(session);
    payment = await Payment.findOne({ order: order._id }).session(session);
    if (!payment) throw notFound('Payment record not found.');
    if ([PAYMENT_STATUS.PAID, PAYMENT_STATUS.CASH_COLLECTED, PAYMENT_STATUS.SETTLED].includes(payment.status)) {
      throw conflict('Payment for this order is already confirmed.');
    }

    payment.status = PAYMENT_STATUS.PAID;
    payment.method = PAYMENT_METHOD.UPI;
    payment.collectedBy = rider._id;
    payment.collectedAmountPaise = payment.amountPaise;
    payment.collectedAt = new Date();
    payment.paidAt = new Date();
    payment.settlementStatus = SETTLEMENT_STATUS.SETTLED;
    payment.paymentReference = payment.paymentReference || `UPI-${order.orderNumber}`;
    await payment.save({ session });

    await recordAudit({
      actor: rider,
      action: AUDIT_ACTION.PAYMENT_VERIFIED,
      entityType: 'Payment',
      entityId: payment._id,
      metadata: { orderNumber: order.orderNumber, amountPaise: payment.amountPaise, method: 'UPI', verifiedByRider: rider.fullName },
      req,
      session,
    });
  });

  await afterCommit(
    () =>
      notify({
        to: 'admins',
        type: NOTIFICATION_TYPE.PAYMENT_UPDATE,
        title: 'Online Payment Confirmed',
        message: `${rider.fullName} verified online UPI payment of ${formatRupees(payment.amountPaise)} for ${order.orderNumber}.`,
        order,
      }),
    () =>
      notify({
        to: order.customer,
        type: NOTIFICATION_TYPE.PAYMENT_UPDATE,
        title: 'Payment Confirmed',
        message: `Your online payment of ${formatRupees(payment.amountPaise)} for ${order.orderNumber} was verified by ${rider.fullName}.`,
        order,
      }),
    () => {
      const payload = { paymentId: payment.id, orderId: order.id, status: payment.status };
      emitToUsers([order.customer, rider._id], 'payment:updated', payload);
      emitToAdmins('payment:updated', payload);
    },
  );
  return payment;
}

const deliveryPopulate = [
  { path: 'rider', select: 'fullName phone riderProfile' },
  { path: 'customer', select: 'fullName phone' },
  { path: 'order', select: 'orderNumber status addressSnapshot customerInstructions invoice payment' },
];

/**
 * Lists deliveries. Riders only ever get their own. Admins can filter by rider.
 * "active" means still on the road. "history" means finished, failed or handed over.
 */
export async function listDeliveries({ viewer, scope, status, riderId, page, pageSize }) {
  const filter = {};
  if (viewer.role === ROLES.RIDER) filter.rider = viewer._id;
  else if (riderId) filter.rider = riderId;

  if (scope === 'active') {
    filter.isCurrent = true;
    filter.status = { $in: ACTIVE_DELIVERY_STATUSES };
  } else if (scope === 'history') {
    filter.status = { $nin: ACTIVE_DELIVERY_STATUSES };
  }
  if (status) filter.status = status;

  const [deliveries, totalItems] = await Promise.all([
    Delivery.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate(deliveryPopulate),
    Delivery.countDocuments(filter),
  ]);

  const orderIds = deliveries.map((delivery) => delivery.order?._id).filter(Boolean);
  const [invoices, payments] = await Promise.all([
    Invoice.find({ order: { $in: orderIds }, status: 'APPROVED' }).select('order grandTotalPaise'),
    Payment.find({ order: { $in: orderIds } }).select('order method status amountPaise collectedAmountPaise settlementStatus'),
  ]);
  const totals = new Map(invoices.map((invoice) => [String(invoice.order), invoice.grandTotalPaise]));
  const paymentByOrder = new Map(payments.map((payment) => [String(payment.order), payment]));

  return {
    deliveries: deliveries.map((delivery) => {
      const orderKey = String(delivery.order?._id);
      const payment = paymentByOrder.get(orderKey);
      return {
        ...serializeDelivery(delivery),
        orderNumber: delivery.order?.orderNumber ?? null,
        orderStatus: delivery.order?.status ?? null,
        customer: delivery.customer ? { fullName: delivery.customer.fullName, phone: delivery.customer.phone } : null,
        address: serializeAddress(delivery.order?.addressSnapshot),
        amountPaise: totals.get(orderKey) ?? null,
        paymentMethod: payment?.method ?? null,
        paymentStatus: payment?.status ?? null,
        settlementStatus: payment?.settlementStatus ?? null,
        updatedAt: delivery.updatedAt,
      };
    }),
    totalItems,
  };
}

/** Everything a rider needs at the door. A rider can only open their own deliveries. */
export async function getDeliveryDetail(deliveryId, viewer) {
  if (!mongoose.isValidObjectId(deliveryId)) throw deliveryNotFound();
  const filter = { _id: deliveryId };
  if (viewer.role === ROLES.RIDER) filter.rider = viewer._id;
  else if (viewer.role !== ROLES.ADMIN) throw deliveryNotFound();

  const delivery = await Delivery.findOne(filter).populate(deliveryPopulate);
  if (!delivery) throw deliveryNotFound();

  const [invoice, payment, events] = await Promise.all([
    Invoice.findOne({ order: delivery.order._id, status: 'APPROVED' }),
    Payment.findOne({ order: delivery.order._id }).populate('collectedBy', 'fullName'),
    DeliveryEvent.find({ delivery: delivery._id }).sort({ createdAt: 1 }),
  ]);

  const isMine = delivery.isCurrent;
  const status = delivery.status;
  const onTheRoad = [DELIVERY_STATUS.OUT_FOR_DELIVERY, DELIVERY_STATUS.REACHED_CUSTOMER].includes(status);
  const paymentDone = [PAYMENT_STATUS.PAID, PAYMENT_STATUS.CASH_COLLECTED, PAYMENT_STATUS.SETTLED].includes(payment?.status);

  return {
    delivery: serializeDelivery(delivery, { events }),
    order: {
      id: delivery.order.id,
      orderNumber: delivery.order.orderNumber,
      status: delivery.order.status,
      address: serializeAddress(delivery.order.addressSnapshot),
      customerInstructions: delivery.order.customerInstructions ?? null,
    },
    customer: { fullName: delivery.customer.fullName, phone: delivery.customer.phone },
    items: (invoice?.lineItems ?? []).map((item) => ({ id: item.id, description: item.description, quantity: item.quantity })),
    grandTotalPaise: invoice?.grandTotalPaise ?? null,
    payment: serializePayment(payment, { viewerRole: viewer.role }),
    allowedActions:
      viewer.role === ROLES.RIDER
        ? {
            canStart: isMine && status === DELIVERY_STATUS.RIDER_ASSIGNED,
            canReach: isMine && status === DELIVERY_STATUS.OUT_FOR_DELIVERY,
            canDeliver: isMine && onTheRoad && paymentDone,
            canFail: isMine && ACTIVE_DELIVERY_STATUSES.includes(status),
            canCollectCash:
              isMine && onTheRoad && payment?.method === PAYMENT_METHOD.CASH && [PAYMENT_STATUS.UNPAID, PAYMENT_STATUS.PENDING].includes(payment?.status),
            canConfirmOnline: isMine && onTheRoad && !paymentDone,
            canCheckPayment: isMine && payment?.method === PAYMENT_METHOD.UPI && payment?.status === PAYMENT_STATUS.PENDING,
          }
        : {},
  };
}

export async function deleteDelivery(id, admin, req) {
  if (!mongoose.isValidObjectId(id)) throw deliveryNotFound();
  const delivery = await Delivery.findById(id);
  if (!delivery) throw deliveryNotFound();

  await Delivery.findByIdAndDelete(delivery._id);
  await Order.findByIdAndUpdate(delivery.order, { $unset: { currentRider: 1 } });
  await recordAudit({
    actor: admin,
    action: AUDIT_ACTION.DELIVERY_DELETED,
    entityType: 'Delivery',
    entityId: delivery._id,
    metadata: { order: delivery.order, status: delivery.status },
    req,
  });
  return { id: delivery._id, deleted: true };
}

export async function deleteDeliveries(ids, admin, req) {
  if (!Array.isArray(ids) || ids.length === 0) return { deletedCount: 0 };
  const validIds = ids.filter((id) => mongoose.isValidObjectId(id));
  const deliveries = await Delivery.find({ _id: { $in: validIds } });
  if (deliveries.length === 0) return { deletedCount: 0 };

  const orderIds = deliveries.map((d) => d.order);
  await Delivery.deleteMany({ _id: { $in: validIds } });
  await Order.updateMany({ _id: { $in: orderIds } }, { $unset: { currentRider: 1 } });

  for (const del of deliveries) {
    await recordAudit({
      actor: admin,
      action: AUDIT_ACTION.DELIVERY_DELETED,
      entityType: 'Delivery',
      entityId: del._id,
      metadata: { order: del.order, status: del.status, bulk: true },
      req,
    });
  }
  return { deletedCount: deliveries.length };
}

export { FAILURE_LABELS };
