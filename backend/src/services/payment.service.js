import mongoose from 'mongoose';
import {
  AUDIT_ACTION,
  NOTIFICATION_TYPE,
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  ROLES,
  SETTLEMENT_STATUS,
} from '../config/constants.js';
import { Delivery, Order, Payment, User } from '../models/index.js';
import { emitToAdmins, emitToUsers } from '../sockets/index.js';
import { AppError } from '../utils/AppError.js';
import { afterCommit } from '../utils/afterCommit.js';
import { formatRupees } from '../utils/money.js';
import { serializePayment } from '../utils/serializeOrder.js';
import { recordAudit } from './audit.service.js';
import { notify } from './notification.service.js';
import { conflict } from './order.service.js';
import {
  cancelPaymentLink,
  createPaymentLink,
  fetchPaidPayment,
  isUpiConfigured,
  verifyWebhookSignature,
} from './razorpay.service.js';

const paymentNotFound = () => new AppError(404, 'NOT_FOUND', 'That payment could not be found.');
const OPEN_STATUSES = [PAYMENT_STATUS.UNPAID, PAYMENT_STATUS.PENDING];

function publishPaymentChange(payment, order) {
  const payload = { paymentId: payment.id, orderId: String(order._id), status: payment.status };
  emitToUsers([order.customer, order.currentRider], 'payment:updated', payload);
  emitToAdmins('payment:updated', payload);
}

/** Finds a payment the viewer may act on: the customer's own, the assigned rider's, or any for an admin. */
async function findPaymentForViewer(id, viewer, session = null) {
  if (!mongoose.isValidObjectId(id)) throw paymentNotFound();
  const payment = await Payment.findById(id).session(session);
  if (!payment) throw paymentNotFound();

  if (viewer.role === ROLES.CUSTOMER && !payment.customer.equals(viewer._id)) throw paymentNotFound();
  if (viewer.role === ROLES.RIDER) {
    const assigned = await Delivery.exists({ order: payment.order, rider: viewer._id, isCurrent: true }).session(session);
    if (!assigned) throw paymentNotFound();
  }
  return payment;
}

/** The customer may switch between UPI and cash until the payment is made or the rider leaves. */
export async function changeMethod(paymentId, method, customer, req) {
  if (method === PAYMENT_METHOD.UPI && !isUpiConfigured()) {
    throw new AppError(422, 'UPI_NOT_CONFIGURED', 'UPI payments are not available yet. Please choose cash on delivery.');
  }

  let payment;
  let order;
  let linkToCancel = null;
  await mongoose.connection.transaction(async (session) => {
    payment = await findPaymentForViewer(paymentId, customer, session);
    order = await Order.findById(payment.order).session(session);
    linkToCancel = null;

    if (!OPEN_STATUSES.includes(payment.status)) throw conflict('This payment is already complete.');
    if (![ORDER_STATUS.CONFIRMED, ORDER_STATUS.RIDER_ASSIGNED].includes(order.status)) {
      throw conflict('The payment method can no longer be changed for this order.');
    }
    if (payment.method === method) return;

    if (payment.gatewayLinkId) {
      linkToCancel = payment.gatewayLinkId;
      payment.gatewayLinkId = undefined;
      payment.gatewayLinkUrl = undefined;
    }
    payment.method = method;
    payment.status = PAYMENT_STATUS.UNPAID;
    await payment.save({ session });
    await recordAudit({
      actor: customer,
      action: AUDIT_ACTION.PAYMENT_METHOD_CHOSEN,
      entityType: 'Payment',
      entityId: payment._id,
      metadata: { method },
      req,
      session,
    });
  });

  await afterCommit(
    async () => {
      if (linkToCancel) await cancelPaymentLink(linkToCancel);
    },
    () => publishPaymentChange(payment, order),
  );
  return payment;
}

/** Creates (or reuses) the order-specific UPI payment link for the customer. */
export async function createUpiLink(paymentId, customer, req) {
  const payment = await findPaymentForViewer(paymentId, customer);
  const order = await Order.findById(payment.order);

  if (payment.method !== PAYMENT_METHOD.UPI) throw conflict('Choose UPI as the payment method first.');
  if (!OPEN_STATUSES.includes(payment.status)) throw conflict('This payment is already complete.');
  if ([ORDER_STATUS.CANCELLED, ORDER_STATUS.DELIVERED].includes(order.status)) throw conflict('This order is closed.');
  if (payment.gatewayLinkUrl) return payment;

  const link = await createPaymentLink({
    amountPaise: payment.amountPaise,
    referenceId: payment.id,
    description: `CK Medical order ${order.orderNumber}`,
    customerName: customer.fullName,
    customerPhone: customer.phone,
  });

  // Saved only if nothing else claimed this payment in the meantime.
  const updated = await Payment.findOneAndUpdate(
    { _id: payment._id, gatewayLinkId: { $exists: false }, status: { $in: OPEN_STATUSES } },
    { $set: { gatewayLinkId: link.id, gatewayLinkUrl: link.url, status: PAYMENT_STATUS.PENDING } },
    { returnDocument: 'after' },
  );
  if (!updated) {
    await afterCommit(() => cancelPaymentLink(link.id));
    return Payment.findById(payment._id);
  }

  await recordAudit({ actor: customer, action: AUDIT_ACTION.UPI_LINK_CREATED, entityType: 'Payment', entityId: payment._id, req });
  await afterCommit(() => publishPaymentChange(updated, order));
  return updated;
}

/**
 * Marks a UPI payment as paid. Only reached after the gateway itself confirmed it,
 * by a signed webhook or a direct check. Safe to call twice for the same payment.
 */
async function markUpiPaid(payment, { gatewayPaymentId, amountPaise }) {
  if (amountPaise !== payment.amountPaise) {
    console.error(`Payment ${payment.id}: gateway amount ${amountPaise} does not match ${payment.amountPaise}. Not marked paid.`);
    return { changed: false };
  }

  let order;
  let changed = false;
  await mongoose.connection.transaction(async (session) => {
    const fresh = await Payment.findById(payment._id).session(session);
    changed = false;
    if (fresh.status === PAYMENT_STATUS.PAID) return;
    if (!OPEN_STATUSES.includes(fresh.status)) return;

    fresh.status = PAYMENT_STATUS.PAID;
    fresh.paymentReference = gatewayPaymentId;
    fresh.paidAt = new Date();
    await fresh.save({ session });
    order = await Order.findById(fresh.order).session(session);
    await recordAudit({
      action: AUDIT_ACTION.PAYMENT_VERIFIED,
      entityType: 'Payment',
      entityId: fresh._id,
      metadata: { orderNumber: order.orderNumber, gatewayPaymentId, amountPaise },
      session,
    });
    payment = fresh;
    changed = true;
  });

  if (changed) {
    await afterCommit(
      () =>
        notify({
          to: [order.customer, order.currentRider],
          type: NOTIFICATION_TYPE.PAYMENT_UPDATE,
          title: 'UPI payment received',
          message: `${formatRupees(payment.amountPaise)} for ${order.orderNumber} has been verified.`,
          order,
        }),
      () =>
        notify({
          to: 'admins',
          type: NOTIFICATION_TYPE.PAYMENT_UPDATE,
          title: 'UPI payment verified',
          message: `${formatRupees(payment.amountPaise)} received for ${order.orderNumber}.`,
          order,
        }),
      () => publishPaymentChange(payment, order),
    );
  }
  return { changed };
}

/** Asks the gateway directly. Used when a webhook was missed, and by the "Check payment" button. */
export async function refreshPayment(paymentId, viewer) {
  const payment = await findPaymentForViewer(paymentId, viewer);
  if (payment.status === PAYMENT_STATUS.PENDING && payment.gatewayLinkId) {
    const paid = await fetchPaidPayment(payment.gatewayLinkId);
    if (paid) await markUpiPaid(payment, { gatewayPaymentId: paid.paymentId, amountPaise: paid.amountPaise });
  }
  return Payment.findById(payment._id);
}

/** Checks every open UPI link with the gateway. Run on a timer as a safety net. */
export async function reconcilePendingUpiPayments() {
  if (!isUpiConfigured()) return;
  const pending = await Payment.find({ status: PAYMENT_STATUS.PENDING, gatewayLinkId: { $exists: true } }).limit(50);
  for (const payment of pending) {
    try {
      const paid = await fetchPaidPayment(payment.gatewayLinkId);
      if (paid) await markUpiPaid(payment, { gatewayPaymentId: paid.paymentId, amountPaise: paid.amountPaise });
    } catch (error) {
      console.error(`Could not check payment ${payment.id}: ${error.message}`);
    }
  }
}

/** Razorpay calls this when a link is paid. Anything not signed with our secret is refused. */
export async function handleRazorpayWebhook(rawBody, signature) {
  if (!verifyWebhookSignature(rawBody, signature)) {
    throw new AppError(400, 'INVALID_SIGNATURE', 'The webhook signature is not valid.');
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new AppError(400, 'INVALID_JSON', 'The webhook body is not valid JSON.');
  }
  if (event.event !== 'payment_link.paid') return { handled: false };

  const linkId = event.payload?.payment_link?.entity?.id;
  const gatewayPayment = event.payload?.payment?.entity;
  if (!linkId || !gatewayPayment?.id || gatewayPayment.status !== 'captured') return { handled: false };

  const payment = await Payment.findOne({ gatewayLinkId: linkId });
  if (!payment) return { handled: false };

  const { changed } = await markUpiPaid(payment, { gatewayPaymentId: gatewayPayment.id, amountPaise: gatewayPayment.amount });
  return { handled: true, changed };
}

/** The admin confirms they received a rider's cash. Collected and settled are separate steps. */
export async function settleCash(paymentIds, admin, req) {
  const settled = [];
  await mongoose.connection.transaction(async (session) => {
    settled.length = 0;
    for (const id of paymentIds) {
      const payment = await Payment.findOne({ _id: id, settlementStatus: SETTLEMENT_STATUS.PENDING }).session(session);
      if (!payment) throw conflict('That cash collection is not waiting for settlement.');

      payment.status = PAYMENT_STATUS.SETTLED;
      payment.settlementStatus = SETTLEMENT_STATUS.SETTLED;
      payment.settledAt = new Date();
      payment.settledBy = admin._id;
      await payment.save({ session });
      await recordAudit({
        actor: admin,
        action: AUDIT_ACTION.CASH_SETTLED,
        entityType: 'Payment',
        entityId: payment._id,
        metadata: { amountPaise: payment.collectedAmountPaise, rider: String(payment.collectedBy) },
        req,
        session,
      });
      settled.push(payment);
    }
  });

  await afterCommit(() => emitToAdmins('payment:updated', { settled: settled.map((payment) => payment.id) }));
  return settled;
}

export async function settleRiderCash(riderId, admin, req) {
  if (!mongoose.isValidObjectId(riderId)) throw new AppError(404, 'NOT_FOUND', 'That rider could not be found.');
  const pending = await Payment.find({ collectedBy: riderId, settlementStatus: SETTLEMENT_STATUS.PENDING }).select('_id');
  if (pending.length === 0) throw conflict('This rider has no cash waiting for settlement.');
  return settleCash(pending.map((payment) => payment._id), admin, req);
}

/** Records that a refund for a cancelled, already-paid order was made outside the app. */
export async function recordRefund(paymentId, { reference }, admin, req) {
  const payment = await findPaymentForViewer(paymentId, admin);
  if (payment.status !== PAYMENT_STATUS.REFUND_PENDING) throw conflict('This payment is not waiting for a refund.');

  payment.status = PAYMENT_STATUS.REFUNDED;
  payment.refundReference = reference ?? undefined;
  payment.refundedAt = new Date();
  await payment.save();
  await recordAudit({ actor: admin, action: AUDIT_ACTION.REFUND_RECORDED, entityType: 'Payment', entityId: payment._id, metadata: { reference }, req });
  return payment;
}

export async function listPayments({ viewer, page, pageSize, status, method, settlement, riderId }) {
  const filter = {};
  if (viewer.role === ROLES.CUSTOMER) filter.customer = viewer._id;
  if (viewer.role === ROLES.RIDER) filter.collectedBy = viewer._id;
  if (status) filter.status = status;
  if (method) filter.method = method;
  if (settlement) filter.settlementStatus = settlement;
  if (riderId && viewer.role === ROLES.ADMIN) filter.collectedBy = riderId;

  const [payments, totalItems] = await Promise.all([
    Payment.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate('order', 'orderNumber status')
      .populate('customer', 'fullName phone')
      .populate('collectedBy', 'fullName'),
    Payment.countDocuments(filter),
  ]);

  return {
    payments: payments.map((payment) => ({
      ...serializePayment(payment, { viewerRole: viewer.role }),
      orderId: payment.order ? String(payment.order._id) : null,
      orderNumber: payment.order?.orderNumber ?? null,
      customerName: viewer.role === ROLES.CUSTOMER ? null : (payment.customer?.fullName ?? null),
      collectedByName: payment.collectedBy?.fullName ?? null,
    })),
    totalItems,
  };
}

/** Totals for the admin payments page. */
export async function paymentSummary() {
  const groups = await Payment.aggregate([
    { $group: { _id: { status: '$status', settlement: '$settlementStatus', method: '$method' }, count: { $sum: 1 }, amount: { $sum: '$amountPaise' } } },
  ]);
  const add = (predicate) =>
    groups.filter((group) => predicate(group._id)).reduce((sum, group) => ({ count: sum.count + group.count, amountPaise: sum.amountPaise + group.amount }), { count: 0, amountPaise: 0 });

  const ridersWithCash = await Payment.aggregate([
    { $match: { settlementStatus: SETTLEMENT_STATUS.PENDING } },
    { $group: { _id: '$collectedBy', amountPaise: { $sum: '$collectedAmountPaise' }, count: { $sum: 1 } } },
  ]);
  const riders = await User.find({ _id: { $in: ridersWithCash.map((entry) => entry._id) } }).select('fullName riderProfile');
  const names = new Map(riders.map((rider) => [rider.id, rider]));

  return {
    upiVerified: add((key) => key.method === PAYMENT_METHOD.UPI && key.status === PAYMENT_STATUS.PAID),
    upiPending: add((key) => key.method === PAYMENT_METHOD.UPI && OPEN_STATUSES.includes(key.status)),
    cashAwaitingCollection: add((key) => key.method === PAYMENT_METHOD.CASH && OPEN_STATUSES.includes(key.status)),
    cashPendingSettlement: add((key) => key.settlement === SETTLEMENT_STATUS.PENDING),
    cashSettled: add((key) => key.settlement === SETTLEMENT_STATUS.SETTLED),
    refundPending: add((key) => key.status === PAYMENT_STATUS.REFUND_PENDING),
    ridersHoldingCash: ridersWithCash.map((entry) => ({
      riderId: String(entry._id),
      riderName: names.get(String(entry._id))?.fullName ?? 'Unknown rider',
      riderCode: names.get(String(entry._id))?.riderProfile?.riderId ?? null,
      amountPaise: entry.amountPaise,
      count: entry.count,
    })),
    upiAvailable: isUpiConfigured(),
  };
}

export async function deletePayment(id, admin, req) {
  if (!mongoose.isValidObjectId(id)) throw paymentNotFound();
  const payment = await Payment.findById(id);
  if (!payment) throw paymentNotFound();

  await Payment.findByIdAndDelete(payment._id);
  await recordAudit({
    actor: admin,
    action: AUDIT_ACTION.PAYMENT_DELETED,
    entityType: 'Payment',
    entityId: payment._id,
    metadata: { amountPaise: payment.amountPaise, method: payment.method, status: payment.status },
    req,
  });
  return { id: payment._id, deleted: true };
}

export async function deletePayments(ids, admin, req) {
  if (!Array.isArray(ids) || ids.length === 0) return { deletedCount: 0 };
  const validIds = ids.filter((id) => mongoose.isValidObjectId(id));
  const payments = await Payment.find({ _id: { $in: validIds } });
  if (payments.length === 0) return { deletedCount: 0 };

  await Payment.deleteMany({ _id: { $in: validIds } });
  for (const payment of payments) {
    await recordAudit({
      actor: admin,
      action: AUDIT_ACTION.PAYMENT_DELETED,
      entityType: 'Payment',
      entityId: payment._id,
      metadata: { amountPaise: payment.amountPaise, method: payment.method, status: payment.status, bulk: true },
      req,
    });
  }
  return { deletedCount: payments.length };
}

export async function updatePayment(id, data, admin, req) {
  if (!mongoose.isValidObjectId(id)) throw paymentNotFound();
  const payment = await Payment.findById(id);
  if (!payment) throw paymentNotFound();

  const { status, method, amountPaise, paymentReference, settlementStatus } = data;
  if (status) payment.status = status;
  if (method) payment.method = method;
  if (amountPaise != null && Number.isInteger(Number(amountPaise))) {
    payment.amountPaise = Number(amountPaise);
  }
  if (paymentReference !== undefined) payment.paymentReference = paymentReference || undefined;
  if (settlementStatus) {
    payment.settlementStatus = settlementStatus;
    if (settlementStatus === SETTLEMENT_STATUS.SETTLED) {
      payment.settledAt = new Date();
      payment.settledBy = admin._id;
    }
  }

  if (payment.status === PAYMENT_STATUS.PAID && !payment.paymentReference) {
    payment.paymentReference = `MANUAL-${Date.now().toString().slice(-6)}`;
  }
  if (payment.status === PAYMENT_STATUS.PAID && !payment.paidAt) {
    payment.paidAt = new Date();
  }
  if (payment.status === PAYMENT_STATUS.SETTLED && !payment.settledBy) {
    payment.settledBy = admin._id;
    payment.settledAt = new Date();
  }

  await payment.save();
  await recordAudit({
    actor: admin,
    action: AUDIT_ACTION.PAYMENT_UPDATED,
    entityType: 'Payment',
    entityId: payment._id,
    metadata: { status: payment.status, method: payment.method, amountPaise: payment.amountPaise },
    req,
  });
  return payment;
}

export { findPaymentForViewer };
