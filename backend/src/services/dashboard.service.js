import {
  ACTIVE_DELIVERY_STATUSES,
  COLLECTED_PAYMENT_STATUSES,
  DELIVERY_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  ROLES,
  SETTLEMENT_STATUS,
} from '../config/constants.js';
import { Delivery } from '../models/Delivery.js';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { User } from '../models/User.js';
import { startOfTodayInIndia } from '../utils/time.js';

export { startOfTodayInIndia };

const ORDER_FINISHED_STATUSES = [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED];

async function countOrdersByStatus(match = {}) {
  const groups = await Order.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
  return Object.fromEntries(groups.map((group) => [group._id, group.count]));
}

async function sumPaise(match, field) {
  const [result] = await Payment.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: `$${field}` } } },
  ]);
  return result?.total ?? 0;
}

const total = (counts) => Object.values(counts).reduce((sum, count) => sum + count, 0);

export async function getAdminSummary() {
  const today = startOfTodayInIndia();

  const [
    orderCounts,
    totalCustomers,
    activeRiders,
    inactiveRiders,
    busyRiderIds,
    assignedDeliveries,
    todayRevenuePaise,
    pendingPayments,
    cashSettlementPendingPaise,
    recentOrders,
  ] = await Promise.all([
    countOrdersByStatus(),
    User.countDocuments({ role: ROLES.CUSTOMER }),
    User.countDocuments({ role: ROLES.RIDER, isActive: true }),
    User.countDocuments({ role: ROLES.RIDER, isActive: false }),
    Delivery.distinct('rider', { isCurrent: true, status: { $in: ACTIVE_DELIVERY_STATUSES } }),
    Delivery.countDocuments({ isCurrent: true, status: DELIVERY_STATUS.RIDER_ASSIGNED }),
    sumPaise(
      {
        status: { $in: COLLECTED_PAYMENT_STATUSES },
        $or: [{ paidAt: { $gte: today } }, { collectedAt: { $gte: today } }],
      },
      'amountPaise',
    ),
    Payment.countDocuments({ status: { $in: [PAYMENT_STATUS.UNPAID, PAYMENT_STATUS.PENDING] } }),
    sumPaise({ settlementStatus: SETTLEMENT_STATUS.PENDING }, 'collectedAmountPaise'),
    Order.find()
      .sort({ updatedAt: -1 })
      .limit(6)
      .select('orderNumber status updatedAt customer')
      .populate('customer', 'fullName'),
  ]);

  const busyActiveRiders = await User.countDocuments({ _id: { $in: busyRiderIds }, isActive: true });

  return {
    totalCustomers,
    totalOrders: total(orderCounts),
    newRequests: orderCounts[ORDER_STATUS.PENDING_ADMIN_REVIEW] ?? 0,
    underReview: orderCounts[ORDER_STATUS.UNDER_REVIEW] ?? 0,
    awaitingApproval: orderCounts[ORDER_STATUS.WAITING_FOR_CUSTOMER_APPROVAL] ?? 0,
    confirmedOrders: orderCounts[ORDER_STATUS.CONFIRMED] ?? 0,
    activeRiders,
    availableRiders: activeRiders - busyActiveRiders,
    inactiveRiders,
    assignedDeliveries,
    outForDelivery:
      (orderCounts[ORDER_STATUS.OUT_FOR_DELIVERY] ?? 0) + (orderCounts[ORDER_STATUS.REACHED_CUSTOMER] ?? 0),
    deliveredOrders: orderCounts[ORDER_STATUS.DELIVERED] ?? 0,
    failedDeliveries: orderCounts[ORDER_STATUS.DELIVERY_FAILED] ?? 0,
    todayRevenuePaise,
    pendingPayments,
    cashSettlementPendingPaise,
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      updatedAt: order.updatedAt,
      customerName: order.customer?.fullName ?? null,
    })),
  };
}

/** Always limited to the logged-in customer's own orders. */
export async function getCustomerSummary(customerId) {
  const [orderCounts, recentOrders] = await Promise.all([
    countOrdersByStatus({ customer: customerId }),
    Order.find({ customer: customerId }).sort({ createdAt: -1 }).limit(5).select('orderNumber status createdAt'),
  ]);

  const finished = ORDER_FINISHED_STATUSES.reduce((sum, status) => sum + (orderCounts[status] ?? 0), 0);

  return {
    totalOrders: total(orderCounts),
    activeOrders: total(orderCounts) - finished,
    pendingApprovals: orderCounts[ORDER_STATUS.WAITING_FOR_CUSTOMER_APPROVAL] ?? 0,
    completedDeliveries: orderCounts[ORDER_STATUS.DELIVERED] ?? 0,
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt,
    })),
  };
}

/** Always limited to the logged-in rider's own deliveries and collections. */
export async function getRiderSummary(riderId) {
  const [groups, cashCollectedPaise, cashSettlementPendingPaise] = await Promise.all([
    Delivery.aggregate([
      { $match: { rider: riderId } },
      { $group: { _id: { status: '$status', isCurrent: '$isCurrent' }, count: { $sum: 1 } } },
    ]),
    sumPaise({ collectedBy: riderId }, 'collectedAmountPaise'),
    sumPaise({ collectedBy: riderId, settlementStatus: SETTLEMENT_STATUS.PENDING }, 'collectedAmountPaise'),
  ]);

  const count = (status, { currentOnly = false } = {}) =>
    groups
      .filter((group) => group._id.status === status && (!currentOnly || group._id.isCurrent))
      .reduce((sum, group) => sum + group.count, 0);

  const pending = count(DELIVERY_STATUS.RIDER_ASSIGNED, { currentOnly: true });
  const outForDelivery =
    count(DELIVERY_STATUS.OUT_FOR_DELIVERY, { currentOnly: true }) +
    count(DELIVERY_STATUS.REACHED_CUSTOMER, { currentOnly: true });

  return {
    assignedDeliveries: pending + outForDelivery,
    pendingDeliveries: pending,
    outForDelivery,
    completedDeliveries: count(DELIVERY_STATUS.DELIVERED),
    failedDeliveries: count(DELIVERY_STATUS.DELIVERY_FAILED),
    cashCollectedPaise,
    cashSettlementPendingPaise,
  };
}

/** Assignment counts for the rider management table. */
export async function getRiderDeliveryStats(riderIds) {
  const stats = await Delivery.aggregate([
    { $match: { rider: { $in: riderIds } } },
    {
      $group: {
        _id: '$rider',
        assigned: {
          $sum: { $cond: [{ $and: ['$isCurrent', { $in: ['$status', ACTIVE_DELIVERY_STATUSES] }] }, 1, 0] },
        },
        completed: { $sum: { $cond: [{ $eq: ['$status', DELIVERY_STATUS.DELIVERED] }, 1, 0] } },
      },
    },
  ]);

  return new Map(stats.map((entry) => [entry._id.toString(), { assigned: entry.assigned, completed: entry.completed }]));
}
