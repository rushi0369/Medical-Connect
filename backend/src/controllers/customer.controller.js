import {
  addAddress,
  deleteAddress,
  setDefaultAddress,
  updateAddress,
  updateProfile,
} from '../services/customer.service.js';
import { getCustomerSummary } from '../services/dashboard.service.js';
import {
  cancelOrder as cancelOrderService,
  createOrder as createOrderService,
  getOrderDetail,
  listOrders as listOrdersService,
} from '../services/order.service.js';
import {
  approveInvoice,
  buildInvoicePdf,
  getInvoiceForViewer,
  listInvoices as listInvoicesService,
  rejectInvoice,
} from '../services/invoice.service.js';
import { serializeInvoice } from '../utils/serializeOrder.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { serializeUser } from '../utils/serializeUser.js';

export async function getMySummary(req, res) {
  return sendSuccess(res, {
    message: 'Dashboard summary loaded.',
    data: await getCustomerSummary(req.user._id),
  });
}

export async function getProfile(req, res) {
  return sendSuccess(res, {
    data: { user: serializeUser(req.user) },
  });
}

export async function updateCustomerProfile(req, res) {
  const updatedUser = await updateProfile(req.user, req.validated.body, req);
  return sendSuccess(res, {
    message: 'Profile updated successfully.',
    data: { user: serializeUser(updatedUser) },
  });
}

export async function listAddresses(req, res) {
  const serialized = serializeUser(req.user);
  return sendSuccess(res, {
    data: { addresses: serialized.addresses ?? [] },
  });
}

export async function addCustomerAddress(req, res) {
  const updatedUser = await addAddress(req.user, req.validated.body, req);
  const serialized = serializeUser(updatedUser);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Address saved successfully.',
    data: { addresses: serialized.addresses, user: serialized },
  });
}

export async function updateCustomerAddress(req, res) {
  const updatedUser = await updateAddress(req.user, req.params.id, req.validated.body, req);
  const serialized = serializeUser(updatedUser);
  return sendSuccess(res, {
    message: 'Address updated successfully.',
    data: { addresses: serialized.addresses, user: serialized },
  });
}

export async function deleteCustomerAddress(req, res) {
  const updatedUser = await deleteAddress(req.user, req.params.id, req);
  const serialized = serializeUser(updatedUser);
  return sendSuccess(res, {
    message: 'Address deleted.',
    data: { addresses: serialized.addresses, user: serialized },
  });
}

export async function setDefaultCustomerAddress(req, res) {
  const updatedUser = await setDefaultAddress(req.user, req.params.id, req);
  const serialized = serializeUser(updatedUser);
  return sendSuccess(res, {
    message: 'Default address updated.',
    data: { addresses: serialized.addresses, user: serialized },
  });
}

export async function createOrder(req, res) {
  const order = await createOrderService({
    customer: req.user,
    data: req.validated.body,
    files: req.files ?? [],
    req,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Medicine request submitted successfully.',
    data: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
    },
  });
}

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
  return sendSuccess(res, {
    data: { order },
  });
}

export async function cancelOrder(req, res) {
  const order = await cancelOrderService(req.params.id, req.validated.body, req.user, req);
  return sendSuccess(res, {
    message: 'Order cancelled successfully.',
    data: { orderId: order.id, status: order.status },
  });
}

// Invoices & Bill Response
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

export async function approveCustomerInvoice(req, res) {
  const result = await approveInvoice(req.params.id, req.validated.body, req.user, req);
  return sendSuccess(res, {
    message: 'Bill approved successfully. Order is confirmed!',
    data: { orderId: result.order.id, invoiceId: result.invoice.id },
  });
}

export async function rejectCustomerInvoice(req, res) {
  const order = await rejectInvoice(req.params.id, req.validated.body, req.user, req);
  return sendSuccess(res, {
    message: 'Bill rejected and sent back to store for changes.',
    data: { orderId: order.id },
  });
}
