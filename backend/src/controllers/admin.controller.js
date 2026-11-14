import { Order } from '../models/Order.js';
import { StoreSettings } from '../models/StoreSettings.js';
import {
  deleteCustomerByAdmin,
  deleteCustomersByAdmin,
  getCustomerRecord,
  listCustomers,
  resetCustomerCredentials,
  updateCustomerByAdmin,
} from '../services/customer.service.js';
import { getAdminSummary } from '../services/dashboard.service.js';
import {
  assignRider,
  deleteDelivery as deleteDeliveryService,
  deleteDeliveries as deleteDeliveriesService,
  listAvailableRiders as listAvailableRidersService,
  listDeliveries as listDeliveriesService,
} from '../services/delivery.service.js';
import {
  approveInvoiceByAdmin as approveInvoiceByAdminService,
  buildInvoicePdf,
  deleteInvoice as deleteInvoiceService,
  deleteInvoices as deleteInvoicesService,
  getInvoiceForViewer,
  listInvoices as listInvoicesService,
  saveDraft,
  sendInvoice as sendInvoiceService,
  withdrawInvoice as withdrawInvoiceService,
} from '../services/invoice.service.js';
import {
  estimateRoute,
  getRoadRoute,
  isRoutingConfigured,
} from '../services/maps.service.js';
import {
  cancelOrder as cancelOrderService,
  deleteOrder as deleteOrderService,
  deleteOrders as deleteOrdersService,
  getOrderDetail,
  listOrders as listOrdersService,
  purgeOldOrders as purgeOldOrdersService,
  saveReviewNotes,
  startReview,
} from '../services/order.service.js';
import {
  deletePayment as deletePaymentService,
  deletePayments as deletePaymentsService,
  listPayments as listPaymentsService,
  paymentSummary as getPaymentSummaryService,
  recordRefund as recordRefundService,
  settleCash as settleCashService,
  settleRiderCash as settleRiderCashService,
  updatePayment as updatePaymentService,
} from '../services/payment.service.js';
import { buildReport } from '../services/report.service.js';
import {
  chargeForDistance,
  getDeliveryPricing as getDeliveryPricingService,
  getStoreSettings,
  saveDeliveryPricing as saveDeliveryPricingService,
  saveStoreSettings,
} from '../services/settings.service.js';
import { detectImageType, saveImage } from '../services/storage.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { serializeInvoice } from '../utils/serializeOrder.js';
import { serializeUser } from '../utils/serializeUser.js';

export async function getDashboardSummary(_req, res) {
  return sendSuccess(res, { message: 'Dashboard summary loaded.', data: await getAdminSummary() });
}

// Order Management
export async function listOrders(req, res) {
  const { page, pageSize, status, search } = req.validated.query;
  const { orders, totalItems } = await listOrdersService({
    viewer: req.user,
    page,
    pageSize,
    statuses: status ? [status] : undefined,
    search,
  });

  return sendSuccess(res, {
    data: orders,
    meta: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize) || 1,
    },
  });
}

export async function getOrder(req, res) {
  const order = await getOrderDetail(req.params.id, req.user);
  return sendSuccess(res, { data: { order } });
}

export async function startOrderReview(req, res) {
  const order = await startReview(req.params.id, req.user, req);
  return sendSuccess(res, {
    message: 'Order review started.',
    data: { orderId: order.id, status: order.status },
  });
}

export async function saveOrderReviewNotes(req, res) {
  const order = await saveReviewNotes(req.params.id, req.validated.body, req.user, req);
  return sendSuccess(res, {
    message: 'Review notes saved.',
    data: { orderId: order.id, status: order.status },
  });
}

export async function cancelOrder(req, res) {
  const order = await cancelOrderService(req.params.id, req.validated.body, req.user, req);
  return sendSuccess(res, {
    message: 'Order cancelled.',
    data: { orderId: order.id, status: order.status },
  });
}

export async function deleteOrder(req, res) {
  const { id } = req.params;
  const result = await deleteOrderService(id, req.user, req);
  return sendSuccess(res, {
    message: `Order #${result.orderNumber} deleted permanently from the database.`,
    data: result,
  });
}

export async function purgeOldOrders(req, res) {
  const { days, scope } = req.body || {};
  const result = await purgeOldOrdersService({ days, scope }, req.user, req);
  return sendSuccess(res, {
    message: `Successfully purged ${result.deletedOrdersCount} old order(s) and freed ${result.freedPhotosCount} image(s).`,
    data: result,
  });
}

export async function bulkDeleteOrders(req, res) {
  const { orderIds } = req.body || {};
  const result = await deleteOrdersService(orderIds, req.user, req);
  return sendSuccess(res, {
    message: `Successfully deleted ${result.deletedCount} order(s) permanently from the database.`,
    data: result,
  });
}

// Invoices & Billing
export async function saveInvoiceDraft(req, res) {
  const invoice = await saveDraft(req.params.id, req.validated.body, req.user, req);
  return sendSuccess(res, {
    message: 'Invoice draft saved.',
    data: { invoice: serializeInvoice(invoice) },
  });
}

export async function sendInvoice(req, res) {
  const invoice = await sendInvoiceService(req.params.id, req.user, req);
  return sendSuccess(res, {
    message: 'Invoice sent to customer for approval.',
    data: { invoice: serializeInvoice(invoice) },
  });
}

export async function withdrawInvoice(req, res) {
  const order = await withdrawInvoiceService(req.params.id, req.user, req);
  return sendSuccess(res, {
    message: 'Invoice withdrawn for changes.',
    data: { orderId: order.id, status: order.status },
  });
}

export async function approveInvoiceByAdmin(req, res) {
  const { id } = req.params;
  const { paymentMethod } = req.body || {};
  const result = await approveInvoiceByAdminService(
    id,
    { paymentMethod: paymentMethod === 'CASH' ? 'CASH' : 'UPI' },
    req.user,
    req,
  );
  return sendSuccess(res, {
    message: 'Bill approved and order confirmed for dispatch.',
    data: { orderId: result.order.id, invoiceId: result.invoice.id, orderStatus: result.order.status },
  });
}

export async function listInvoices(req, res) {
  const { page, pageSize, status } = req.query;
  const { invoices, totalItems } = await listInvoicesService({
    viewer: req.user,
    page: parseInt(page) || 1,
    pageSize: parseInt(pageSize) || 20,
    status,
  });

  return sendSuccess(res, {
    data: invoices,
    meta: {
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20,
      totalItems,
      totalPages: Math.ceil(totalItems / (parseInt(pageSize) || 20)) || 1,
    },
  });
}

export async function getInvoice(req, res) {
  const invoice = await getInvoiceForViewer(req.params.id, req.user);
  return sendSuccess(res, { data: { invoice: serializeInvoice(invoice) } });
}

export async function downloadInvoicePdf(req, res) {
  const invoice = await getInvoiceForViewer(req.params.id, req.user);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Invoice-${invoice.order.orderNumber}.pdf"`);
  const doc = await buildInvoicePdf(invoice);
  doc.pipe(res);
}

export async function deleteInvoice(req, res) {
  await deleteInvoiceService(req.params.id, req.user, req);
  return sendSuccess(res, { message: 'Invoice permanently deleted from database.' });
}

export async function bulkDeleteInvoices(req, res) {
  const { invoiceIds } = req.body;
  const result = await deleteInvoicesService(invoiceIds, req.user, req);
  return sendSuccess(res, { message: `${result.count} invoice(s) permanently deleted from database.` });
}

// Customer Management
export async function listAllCustomers(req, res) {
  const { page, pageSize, search } = req.validated.query;
  const { customers, totalItems } = await listCustomers({ page, pageSize, search });
  return sendSuccess(res, {
    data: customers,
    meta: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize) || 1,
    },
  });
}

export async function getCustomer(req, res) {
  const record = await getCustomerRecord(req.params.id);
  return sendSuccess(res, { data: record });
}

export async function updateCustomer(req, res) {
  const { id } = req.params;
  const customer = await updateCustomerByAdmin(id, req.validated.body, req.user, req);
  return sendSuccess(res, {
    message: 'Customer details updated successfully.',
    data: { customer: serializeUser(customer) },
  });
}

export async function deleteCustomer(req, res) {
  const { id } = req.params;
  const result = await deleteCustomerByAdmin(id, req.user, req);
  return sendSuccess(res, {
    message: `Customer ${result.customerName} and their records were deleted from the database.`,
    data: result,
  });
}

export async function bulkDeleteCustomers(req, res) {
  const { customerIds } = req.body || {};
  const result = await deleteCustomersByAdmin(customerIds, req.user, req);
  return sendSuccess(res, {
    message: `Successfully deleted ${result.deletedCount} customer(s) and their records permanently from the database.`,
    data: result,
  });
}

export async function resetCustomerPassword(req, res) {
  const { id } = req.params;
  const result = await resetCustomerCredentials(id, req.user, req);
  return sendSuccess(res, {
    message: 'Customer credentials reset successfully.',
    data: {
      customer: serializeUser(result.customer),
      temporaryPassword: result.temporaryPassword,
    },
  });
}

// Store Settings & UPI QR
export async function getSettings(_req, res) {
  return sendSuccess(res, { data: await getStoreSettings() });
}

export async function saveSettings(req, res) {
  const input = { ...req.validated.body };

  if (req.file) {
    const type = detectImageType(req.file.buffer);
    if (!type) throw new AppError(422, 'INVALID_IMAGE', 'The QR image must be a JPG, PNG, or WEBP file.');
    const id = await saveImage({
      buffer: req.file.buffer,
      contentType: type,
      filename: req.file.originalname,
      ownerId: req.user._id,
    });
    input.upiQrUrl = `/uploads/${id}`;
  }

  const updated = await saveStoreSettings(input, req.user, req);
  return sendSuccess(res, {
    message: 'Store settings saved successfully.',
    data: updated,
  });
}

// Delivery Pricing & Distance Calculation
export async function getDeliveryPricing(_req, res) {
  return sendSuccess(res, { data: await getDeliveryPricingService() });
}

export async function saveDeliveryPricing(req, res) {
  const updated = await saveDeliveryPricingService(req.validated.body, req.user, req);
  return sendSuccess(res, {
    message: 'Delivery pricing saved successfully.',
    data: updated,
  });
}

export async function calculateOrderDistance(req, res) {
  const { id } = req.params;
  const order = await Order.findById(id);
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found.');

  const storeSettings = await StoreSettings.findOne();
  const storeLocation = storeSettings?.address?.location;
  const customerLocation = order.addressSnapshot?.location;

  if (!storeLocation || !customerLocation) {
    const pricing = await getDeliveryPricingService();
    return sendSuccess(res, {
      data: {
        hasLocations: false,
        distanceKm: null,
        durationMinutes: null,
        chargePaise: null,
        tiers: pricing.tiers,
        message: 'Map pins not set for store or customer. Please set pins or enter charge manually.',
      },
    });
  }

  let routeResult;
  let isEstimated = false;

  if (isRoutingConfigured()) {
    try {
      routeResult = await getRoadRoute(storeLocation, customerLocation);
    } catch {
      routeResult = estimateRoute(storeLocation, customerLocation);
      isEstimated = true;
    }
  } else {
    routeResult = estimateRoute(storeLocation, customerLocation);
    isEstimated = true;
  }

  const pricing = await getDeliveryPricingService();
  const { chargePaise, tier } = chargeForDistance(pricing.tiers, routeResult.distanceKm);

  return sendSuccess(res, {
    data: {
      hasLocations: true,
      distanceKm: routeResult.distanceKm,
      durationMinutes: routeResult.durationMinutes,
      chargePaise,
      matchedTier: tier,
      isEstimated,
      isRoutingConfigured: isRoutingConfigured(),
    },
  });
}

// Delivery Management & Rider Assignment
export async function listAdminDeliveries(req, res) {
  const { page, pageSize, scope, status, riderId } = req.validated.query;
  const { deliveries, totalItems } = await listDeliveriesService({
    viewer: req.user,
    scope: scope === 'all' ? undefined : scope,
    status,
    riderId,
    page,
    pageSize,
  });

  return sendSuccess(res, {
    data: deliveries,
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) || 1 },
  });
}

export async function getAvailableRiders(_req, res) {
  const riders = await listAvailableRidersService();
  return sendSuccess(res, { data: riders });
}

export async function assignOrderRider(req, res) {
  const { id } = req.params;
  const { riderId } = req.validated.body;
  const { order, delivery } = await assignRider(id, riderId, req.user, req);

  return sendSuccess(res, {
    message: 'Rider assigned to order successfully.',
    data: { orderId: order.id, deliveryId: delivery.id, status: order.status },
  });
}

export async function deleteDelivery(req, res) {
  const { id } = req.params;
  const result = await deleteDeliveryService(id, req.user, req);
  return sendSuccess(res, {
    message: 'Delivery record deleted permanently from database.',
    data: result,
  });
}

export async function bulkDeleteDeliveries(req, res) {
  const { deliveryIds } = req.body || {};
  const result = await deleteDeliveriesService(deliveryIds, req.user, req);
  return sendSuccess(res, {
    message: `Successfully deleted ${result.deletedCount} delivery record(s) from database.`,
    data: result,
  });
}

// Payment Management
export async function listPayments(req, res) {
  const { page, pageSize, status, method, settlement, riderId } = req.validated.query;
  const { payments, totalItems } = await listPaymentsService({
    viewer: req.user,
    page,
    pageSize,
    status,
    method,
    settlement,
    riderId,
  });

  return sendSuccess(res, {
    data: payments,
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) || 1 },
  });
}

export async function getPaymentSummary(_req, res) {
  const summary = await getPaymentSummaryService();
  return sendSuccess(res, { data: summary });
}

export async function settleCashPayments(req, res) {
  const { paymentIds } = req.validated.body;
  const settled = await settleCashService(paymentIds, req.user, req);
  return sendSuccess(res, {
    message: `Successfully settled ${settled.length} payment(s).`,
    data: settled,
  });
}

export async function settleRiderCash(req, res) {
  const { riderId } = req.params;
  const settled = await settleRiderCashService(riderId, req.user, req);
  return sendSuccess(res, {
    message: `All pending cash collections for rider settled successfully (${settled.length} payments).`,
    data: settled,
  });
}

export async function recordRefund(req, res) {
  const { id } = req.params;
  const payment = await recordRefundService(id, req.validated.body, req.user, req);
  return sendSuccess(res, {
    message: 'Refund recorded successfully.',
    data: payment,
  });
}

export async function updatePayment(req, res) {
  const { id } = req.params;
  const payment = await updatePaymentService(id, req.body || {}, req.user, req);
  return sendSuccess(res, {
    message: 'Payment details updated successfully.',
    data: payment,
  });
}

export async function deletePayment(req, res) {
  const { id } = req.params;
  const result = await deletePaymentService(id, req.user, req);
  return sendSuccess(res, {
    message: 'Payment record deleted permanently from database.',
    data: result,
  });
}

export async function bulkDeletePayments(req, res) {
  const { paymentIds } = req.body || {};
  const result = await deletePaymentsService(paymentIds, req.user, req);
  return sendSuccess(res, {
    message: `Successfully deleted ${result.deletedCount} payment record(s) from database.`,
    data: result,
  });
}

// Reports & Analytics
export async function getReports(req, res) {
  const { from, to, groupBy = 'day' } = req.query;
  const toDate = to ? new Date(to) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const report = await buildReport({ from: fromDate, to: toDate, groupBy });
  return sendSuccess(res, { data: report });
}
