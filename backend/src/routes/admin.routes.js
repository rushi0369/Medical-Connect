import { Router } from 'express';
import multer from 'multer';
import { ROLES } from '../config/constants.js';
import * as admin from '../controllers/admin.controller.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  adminCustomerListQuerySchema,
  adminOrderListQuerySchema,
  adminPaymentListQuerySchema,
  refundPaymentSchema,
  saveDeliveryPricingSchema,
  saveInvoiceDraftSchema,
  saveReviewNotesSchema,
  saveStoreSettingsSchema,
  settleCashSchema,
  updateCustomerSchema,
} from '../validators/admin.validators.js';
import { idParamsSchema } from '../validators/common.js';
import { cancelOrderSchema } from '../validators/customer.validators.js';
import {
  adminListDeliveriesQuerySchema,
  assignRiderSchema,
} from '../validators/rider.validators.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const handleUpload = (req, res, next) => {
  if (req.is('multipart/form-data')) {
    return upload.single('upiQr')(req, res, next);
  }
  return next();
};

const router = Router();

router.use(requireRole(ROLES.ADMIN));

// Summary
router.get('/summary', admin.getDashboardSummary);

// Order Review & Management
router.get('/orders', validate({ query: adminOrderListQuerySchema }), admin.listOrders);
router.get('/orders/:id', validate({ params: idParamsSchema }), admin.getOrder);
router.post('/orders/:id/start-review', validate({ params: idParamsSchema }), admin.startOrderReview);
router.patch('/orders/:id/review-notes', validate({ params: idParamsSchema, body: saveReviewNotesSchema }), admin.saveOrderReviewNotes);
router.post('/orders/:id/cancel', validate({ params: idParamsSchema, body: cancelOrderSchema }), admin.cancelOrder);
router.delete('/orders/:id', validate({ params: idParamsSchema }), admin.deleteOrder);
router.post('/orders/bulk-delete', admin.bulkDeleteOrders);
router.post('/orders/purge', admin.purgeOldOrders);

// Billing & Invoices
router.post('/orders/:id/invoices/draft', validate({ params: idParamsSchema, body: saveInvoiceDraftSchema }), admin.saveInvoiceDraft);
router.post('/orders/:id/invoices/send', validate({ params: idParamsSchema }), admin.sendInvoice);
router.post('/orders/:id/invoices/withdraw', validate({ params: idParamsSchema }), admin.withdrawInvoice);
router.get('/invoices', admin.listInvoices);
router.get('/invoices/:id', validate({ params: idParamsSchema }), admin.getInvoice);
router.post('/invoices/:id/approve', validate({ params: idParamsSchema }), admin.approveInvoiceByAdmin);
router.get('/invoices/:id/pdf', validate({ params: idParamsSchema }), admin.downloadInvoicePdf);
router.delete('/invoices/:id', validate({ params: idParamsSchema }), admin.deleteInvoice);
router.post('/invoices/bulk-delete', admin.bulkDeleteInvoices);

// Customers
router.get('/customers', validate({ query: adminCustomerListQuerySchema }), admin.listAllCustomers);
router.get('/customers/:id', validate({ params: idParamsSchema }), admin.getCustomer);
router.patch('/customers/:id', validate({ params: idParamsSchema, body: updateCustomerSchema }), admin.updateCustomer);
router.post('/customers/:id/reset-password', validate({ params: idParamsSchema }), admin.resetCustomerPassword);
router.delete('/customers/:id', validate({ params: idParamsSchema }), admin.deleteCustomer);
router.post('/customers/bulk-delete', admin.bulkDeleteCustomers);

// Store Settings & UPI QR
router.get('/settings', admin.getSettings);
router.post('/settings', handleUpload, validate({ body: saveStoreSettingsSchema }), admin.saveSettings);

// Delivery Pricing & Distance Calculation
router.get('/delivery-pricing', admin.getDeliveryPricing);
router.post('/delivery-pricing', validate({ body: saveDeliveryPricingSchema }), admin.saveDeliveryPricing);
router.post('/orders/:id/calculate-distance', validate({ params: idParamsSchema }), admin.calculateOrderDistance);

// Delivery Management & Rider Assignment
router.get('/deliveries', validate({ query: adminListDeliveriesQuerySchema }), admin.listAdminDeliveries);
router.get('/deliveries/available-riders', admin.getAvailableRiders);
router.post('/orders/:id/assign-rider', validate({ params: idParamsSchema, body: assignRiderSchema }), admin.assignOrderRider);
router.delete('/deliveries/:id', validate({ params: idParamsSchema }), admin.deleteDelivery);
router.post('/deliveries/bulk-delete', admin.bulkDeleteDeliveries);

// Payments & Cash Settlements
router.get('/payments', validate({ query: adminPaymentListQuerySchema }), admin.listPayments);
router.get('/payments/summary', admin.getPaymentSummary);
router.post('/payments/settle-cash', validate({ body: settleCashSchema }), admin.settleCashPayments);
router.post('/payments/settle-rider/:riderId', admin.settleRiderCash);
router.patch('/payments/:id', validate({ params: idParamsSchema }), admin.updatePayment);
router.delete('/payments/:id', validate({ params: idParamsSchema }), admin.deletePayment);
router.post('/payments/bulk-delete', admin.bulkDeletePayments);
router.post('/payments/:id/refund', validate({ params: idParamsSchema, body: refundPaymentSchema }), admin.recordRefund);

// Reports & Analytics
router.get('/reports', admin.getReports);

export default router;
