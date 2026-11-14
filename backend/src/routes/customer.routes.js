import { Router } from 'express';
import multer from 'multer';
import { ROLES } from '../config/constants.js';
import * as customer from '../controllers/customer.controller.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParamsSchema } from '../validators/common.js';
import {
  approveInvoiceSchema,
  rejectInvoiceSchema,
} from '../validators/admin.validators.js';
import {
  cancelOrderSchema,
  createOrderSchema,
  listCustomerOrdersQuerySchema,
  saveAddressSchema,
  updateProfileSchema,
} from '../validators/customer.validators.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10,
  },
});

const handleUpload = (req, res, next) => {
  if (req.is('multipart/form-data')) {
    return upload.array('photos', 10)(req, res, next);
  }
  return next();
};

const router = Router();

// All customer routes require CUSTOMER role
router.use(requireRole(ROLES.CUSTOMER));

router.get('/me/summary', customer.getMySummary);
router.get('/me/profile', customer.getProfile);
router.patch('/me/profile', validate({ body: updateProfileSchema }), customer.updateCustomerProfile);

// Address Management
router.get('/me/addresses', customer.listAddresses);
router.post('/me/addresses', validate({ body: saveAddressSchema }), customer.addCustomerAddress);
router.patch('/me/addresses/:id', validate({ params: idParamsSchema, body: saveAddressSchema }), customer.updateCustomerAddress);
router.delete('/me/addresses/:id', validate({ params: idParamsSchema }), customer.deleteCustomerAddress);
router.post('/me/addresses/:id/default', validate({ params: idParamsSchema }), customer.setDefaultCustomerAddress);

// Orders / Medicine Requests
router.post('/me/orders', handleUpload, validate({ body: createOrderSchema }), customer.createOrder);
router.get('/me/orders', validate({ query: listCustomerOrdersQuerySchema }), customer.listOrders);
router.get('/me/orders/:id', validate({ params: idParamsSchema }), customer.getOrder);
router.post('/me/orders/:id/cancel', validate({ params: idParamsSchema, body: cancelOrderSchema }), customer.cancelOrder);

// Invoices / Bills
router.get('/me/invoices', customer.listInvoices);
router.get('/me/invoices/:id', validate({ params: idParamsSchema }), customer.getInvoice);
router.get('/me/invoices/:id/pdf', validate({ params: idParamsSchema }), customer.downloadInvoicePdf);
router.post('/me/invoices/:id/approve', validate({ params: idParamsSchema, body: approveInvoiceSchema }), customer.approveCustomerInvoice);
router.post('/me/invoices/:id/reject', validate({ params: idParamsSchema, body: rejectInvoiceSchema }), customer.rejectCustomerInvoice);

export default router;
