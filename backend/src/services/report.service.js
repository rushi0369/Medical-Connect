import { COLLECTED_PAYMENT_STATUSES, DELIVERY_STATUS, ORDER_STATUS, SETTLEMENT_STATUS } from '../config/constants.js';
import { Delivery, Order, Payment, User } from '../models/index.js';
import { INDIA_TIMEZONE } from '../utils/time.js';

const bucketOf = (field, unit) => ({ $dateTrunc: { date: field, unit, timezone: INDIA_TIMEZONE, startOfWeek: 'monday' } });

/** All reports read live from the database for the chosen period, using dates in India. */
export async function buildReport({ from, to, groupBy }) {
  const range = { $gte: from, $lt: to };
  const paidAt = { $ifNull: ['$paidAt', '$collectedAt'] };

  const [orders, revenue, methods, riderStats, riderCash, customers, pendingSettlements] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: range } },
      {
        $group: {
          _id: bucketOf('$createdAt', groupBy),
          orders: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $eq: ['$status', ORDER_STATUS.DELIVERED] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', ORDER_STATUS.DELIVERY_FAILED] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', ORDER_STATUS.CANCELLED] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Payment.aggregate([
      { $match: { status: { $in: COLLECTED_PAYMENT_STATUSES } } },
      { $addFields: { receivedAt: paidAt } },
      { $match: { receivedAt: range } },
      { $group: { _id: bucketOf('$receivedAt', groupBy), amountPaise: { $sum: '$amountPaise' }, payments: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Payment.aggregate([
      { $match: { status: { $in: COLLECTED_PAYMENT_STATUSES } } },
      { $addFields: { receivedAt: paidAt } },
      { $match: { receivedAt: range } },
      { $group: { _id: '$method', amountPaise: { $sum: '$amountPaise' }, payments: { $sum: 1 } } },
    ]),
    Delivery.aggregate([
      { $match: { createdAt: range } },
      {
        $group: {
          _id: '$rider',
          assigned: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $eq: ['$status', DELIVERY_STATUS.DELIVERED] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', DELIVERY_STATUS.DELIVERY_FAILED] }, 1, 0] } },
        },
      },
    ]),
    Payment.aggregate([
      { $match: { collectedAt: range } },
      { $group: { _id: '$collectedBy', cashCollectedPaise: { $sum: '$collectedAmountPaise' } } },
    ]),
    Order.aggregate([
      { $match: { createdAt: range } },
      {
        $group: {
          _id: '$customer',
          orders: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $eq: ['$status', ORDER_STATUS.DELIVERED] }, 1, 0] } },
          lastOrderAt: { $max: '$createdAt' },
        },
      },
      { $sort: { orders: -1, lastOrderAt: -1 } },
      { $limit: 20 },
    ]),
    Payment.aggregate([
      { $match: { settlementStatus: SETTLEMENT_STATUS.PENDING } },
      { $group: { _id: '$collectedBy', amountPaise: { $sum: '$collectedAmountPaise' }, payments: { $sum: 1 }, oldest: { $min: '$collectedAt' } } },
    ]),
  ]);

  const userIds = [...riderStats, ...riderCash, ...customers, ...pendingSettlements].map((entry) => entry._id).filter(Boolean);
  const users = await User.find({ _id: { $in: userIds } }).select('fullName phone riderProfile');
  const userById = new Map(users.map((user) => [user.id, user]));
  const nameOf = (id) => userById.get(String(id))?.fullName ?? 'Unknown';

  const cashByRider = new Map(riderCash.map((entry) => [String(entry._id), entry.cashCollectedPaise]));
  const revenueByPeriod = new Map(revenue.map((entry) => [entry._id.toISOString(), entry]));
  const periods = [...new Set([...orders.map((entry) => entry._id.toISOString()), ...revenueByPeriod.keys()])].sort();
  const ordersByPeriod = new Map(orders.map((entry) => [entry._id.toISOString(), entry]));

  return {
    period: { from, to, groupBy },
    timeline: periods.map((period) => ({
      period,
      orders: ordersByPeriod.get(period)?.orders ?? 0,
      delivered: ordersByPeriod.get(period)?.delivered ?? 0,
      failed: ordersByPeriod.get(period)?.failed ?? 0,
      cancelled: ordersByPeriod.get(period)?.cancelled ?? 0,
      revenuePaise: revenueByPeriod.get(period)?.amountPaise ?? 0,
    })),
    totals: {
      orders: orders.reduce((sum, entry) => sum + entry.orders, 0),
      delivered: orders.reduce((sum, entry) => sum + entry.delivered, 0),
      failed: orders.reduce((sum, entry) => sum + entry.failed, 0),
      cancelled: orders.reduce((sum, entry) => sum + entry.cancelled, 0),
      revenuePaise: revenue.reduce((sum, entry) => sum + entry.amountPaise, 0),
    },
    paymentMethods: methods.map((entry) => ({ method: entry._id, amountPaise: entry.amountPaise, payments: entry.payments })),
    riders: riderStats
      .map((entry) => ({
        riderId: String(entry._id),
        riderName: nameOf(entry._id),
        riderCode: userById.get(String(entry._id))?.riderProfile?.riderId ?? null,
        assigned: entry.assigned,
        delivered: entry.delivered,
        failed: entry.failed,
        cashCollectedPaise: cashByRider.get(String(entry._id)) ?? 0,
      }))
      .sort((a, b) => b.delivered - a.delivered),
    customers: customers.map((entry) => ({
      customerId: String(entry._id),
      customerName: nameOf(entry._id),
      phone: userById.get(String(entry._id))?.phone ?? null,
      orders: entry.orders,
      delivered: entry.delivered,
      lastOrderAt: entry.lastOrderAt,
    })),
    pendingSettlements: pendingSettlements.map((entry) => ({
      riderId: String(entry._id),
      riderName: nameOf(entry._id),
      amountPaise: entry.amountPaise,
      payments: entry.payments,
      oldestCollectedAt: entry.oldest,
    })),
  };
}
