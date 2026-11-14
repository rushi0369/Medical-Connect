import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import {
  AUDIT_ACTION,
  INVOICE_STATUS,
  NOTIFICATION_TYPE,
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  ROLES,
} from '../config/constants.js';
import { Invoice, Order, Payment, StoreSettings } from '../models/index.js';
import { publishOrderChange } from '../sockets/index.js';
import { AppError } from '../utils/AppError.js';
import { afterCommit } from '../utils/afterCommit.js';
import { calculateBill, formatRupees } from '../utils/money.js';
import { serializeInvoice } from '../utils/serializeOrder.js';
import { recordAudit } from './audit.service.js';
import { notify } from './notification.service.js';
import { conflict, findOrderForViewer, recordStatus } from './order.service.js';
import { isUpiConfigured } from './razorpay.service.js';

const invoiceNotFound = () => new AppError(404, 'NOT_FOUND', 'That invoice could not be found.');

const latestInvoiceOf = (orderId, session) => Invoice.findOne({ order: orderId }).sort({ version: -1 }).session(session);

/**
 * Saves the bill the admin is preparing. Totals are always recalculated here. A new
 * version is started when the last one was rejected or withdrawn, so history is kept.
 */
export async function saveDraft(orderId, input, admin, req) {
  let invoice;
  await mongoose.connection.transaction(async (session) => {
    const order = await findOrderForViewer(orderId, admin, session);
    if (order.status !== ORDER_STATUS.UNDER_REVIEW) throw conflict('Start the review before preparing the bill.');

    const latest = await latestInvoiceOf(order._id, session);
    if (latest && [INVOICE_STATUS.SENT, INVOICE_STATUS.APPROVED].includes(latest.status)) {
      throw conflict('This bill has already been sent. Withdraw it first to make changes.');
    }

    const bill = calculateBill(input);
    const fields = {
      ...bill,
      deliveryDistanceKm: input.deliveryDistanceKm ?? undefined,
      deliveryDurationMinutes: input.deliveryDurationMinutes ?? undefined,
      isDeliveryChargeOverridden: input.isDeliveryChargeOverridden,
      remarks: input.remarks ?? undefined,
    };

    if (latest?.status === INVOICE_STATUS.DRAFT) {
      invoice = latest;
      invoice.set(fields);
    } else {
      invoice = new Invoice({
        ...fields,
        order: order._id,
        customer: order.customer,
        version: (latest?.version ?? 0) + 1,
        createdBy: admin._id,
      });
    }

    await invoice.save({ session });
    await recordAudit({
      actor: admin,
      action: AUDIT_ACTION.INVOICE_SAVED,
      entityType: 'Invoice',
      entityId: invoice._id,
      metadata: { orderNumber: order.orderNumber, version: invoice.version, grandTotalPaise: invoice.grandTotalPaise },
      req,
      session,
    });
  });
  return invoice;
}

export async function sendInvoice(orderId, admin, req) {
  let order;
  let invoice;
  await mongoose.connection.transaction(async (session) => {
    order = await findOrderForViewer(orderId, admin, session);
    if (order.status !== ORDER_STATUS.UNDER_REVIEW) throw conflict('Only an order under review can have its bill sent.');

    invoice = await latestInvoiceOf(order._id, session);
    if (invoice?.status !== INVOICE_STATUS.DRAFT) throw conflict('Save the bill before sending it.');

    invoice.status = INVOICE_STATUS.SENT;
    invoice.sentAt = new Date();
    await invoice.save({ session });

    order.invoice = invoice._id;
    order.invoiceVersion = invoice.version;
    order.lineItems = invoice.lineItems.map((item) => item.toObject());
    recordStatus(order, ORDER_STATUS.WAITING_FOR_CUSTOMER_APPROVAL, admin, `Bill version ${invoice.version} sent`);
    await order.save({ session });
    await recordAudit({
      actor: admin,
      action: AUDIT_ACTION.INVOICE_SENT,
      entityType: 'Invoice',
      entityId: invoice._id,
      metadata: { orderNumber: order.orderNumber, version: invoice.version, grandTotalPaise: invoice.grandTotalPaise },
      req,
      session,
    });
  });

  const isRevision = invoice.version > 1;
  await afterCommit(
    () =>
      notify({
        to: order.customer,
        type: isRevision ? NOTIFICATION_TYPE.INVOICE_REVISED : NOTIFICATION_TYPE.INVOICE_SENT,
        title: isRevision ? 'Your revised bill is ready' : 'Your bill is ready',
        message: `Please review and approve the ${formatRupees(invoice.grandTotalPaise)} bill for ${order.orderNumber}.`,
        order,
      }),
    () => publishOrderChange(order),
  );
  return invoice;
}

/** Takes back a sent bill before the customer answers, so it can be corrected. */
export async function withdrawInvoice(orderId, admin, req) {
  let order;
  await mongoose.connection.transaction(async (session) => {
    order = await findOrderForViewer(orderId, admin, session);
    const invoice = await latestInvoiceOf(order._id, session);
    if (order.status !== ORDER_STATUS.WAITING_FOR_CUSTOMER_APPROVAL || invoice?.status !== INVOICE_STATUS.SENT) {
      throw conflict('There is no sent bill to withdraw.');
    }

    invoice.status = INVOICE_STATUS.REVISED;
    await invoice.save({ session });
    recordStatus(order, ORDER_STATUS.UNDER_REVIEW, admin, `Bill version ${invoice.version} withdrawn for changes`);
    await order.save({ session });
    await recordAudit({ actor: admin, action: AUDIT_ACTION.INVOICE_WITHDRAWN, entityType: 'Invoice', entityId: invoice._id, req, session });
  });

  await afterCommit(() => publishOrderChange(order));
  return order;
}

async function findCustomerInvoice(invoiceId, customer, session) {
  if (!mongoose.isValidObjectId(invoiceId)) throw invoiceNotFound();
  const invoice = await Invoice.findOne({ _id: invoiceId, customer: customer._id, status: { $ne: INVOICE_STATUS.DRAFT } }).session(session);
  if (!invoice) throw invoiceNotFound();
  return invoice;
}

/** The customer accepts the bill and chooses how to pay. This confirms the order. */
export async function approveInvoice(invoiceId, { paymentMethod, acceptSubstitutes }, customer, req) {
  if (paymentMethod === PAYMENT_METHOD.UPI && !isUpiConfigured()) {
    throw new AppError(422, 'UPI_NOT_CONFIGURED', 'UPI payments are not available yet. Please choose cash on delivery.');
  }

  let order;
  let invoice;
  await mongoose.connection.transaction(async (session) => {
    invoice = await findCustomerInvoice(invoiceId, customer, session);
    order = await Order.findById(invoice.order).session(session);

    if (invoice.status !== INVOICE_STATUS.SENT || order.status !== ORDER_STATUS.WAITING_FOR_CUSTOMER_APPROVAL) {
      throw conflict('This bill is no longer waiting for your answer.');
    }
    if (invoice.lineItems.some((item) => item.isSubstitute) && acceptSubstitutes !== true) {
      throw new AppError(422, 'SUBSTITUTES_NOT_ACCEPTED', 'Please confirm that you accept the suggested alternative medicines.');
    }

    invoice.status = INVOICE_STATUS.APPROVED;
    invoice.approvedAt = new Date();
    await invoice.save({ session });

    const [payment] = await Payment.create(
      [
        {
          order: order._id,
          customer: customer._id,
          invoice: invoice._id,
          amountPaise: invoice.grandTotalPaise,
          method: paymentMethod,
          status: PAYMENT_STATUS.UNPAID,
        },
      ],
      { session },
    );

    order.payment = payment._id;
    recordStatus(order, ORDER_STATUS.CONFIRMED, customer, `Bill approved, paying by ${paymentMethod === PAYMENT_METHOD.UPI ? 'UPI' : 'cash'}`);
    await order.save({ session });
    await recordAudit({
      actor: customer,
      action: AUDIT_ACTION.INVOICE_APPROVED,
      entityType: 'Invoice',
      entityId: invoice._id,
      metadata: { orderNumber: order.orderNumber, version: invoice.version, grandTotalPaise: invoice.grandTotalPaise, paymentMethod },
      req,
      session,
    });
  });

  await afterCommit(
    () =>
      notify({
        to: 'admins',
        type: NOTIFICATION_TYPE.INVOICE_APPROVED,
        title: 'Bill approved',
        message: `${customer.fullName} approved the bill for ${order.orderNumber}. It is ready for a rider.`,
        order,
      }),
    () => publishOrderChange(order),
  );
  return { order, invoice };
}

/** Admin approves invoice on customer's behalf (e.g. customer approved on WhatsApp). */
export async function approveInvoiceByAdmin(invoiceId, { paymentMethod = PAYMENT_METHOD.UPI }, admin, req) {
  let order;
  let invoice;
  await mongoose.connection.transaction(async (session) => {
    if (!mongoose.isValidObjectId(invoiceId)) throw invoiceNotFound();
    invoice = await Invoice.findById(invoiceId).session(session);
    if (!invoice) throw invoiceNotFound();

    order = await Order.findById(invoice.order).session(session);
    if (!order) throw invoiceNotFound();

    if (invoice.status !== INVOICE_STATUS.SENT || order.status !== ORDER_STATUS.WAITING_FOR_CUSTOMER_APPROVAL) {
      throw conflict('This bill is no longer waiting for approval.');
    }

    invoice.status = INVOICE_STATUS.APPROVED;
    invoice.approvedAt = new Date();
    await invoice.save({ session });

    const [payment] = await Payment.create(
      [
        {
          order: order._id,
          customer: invoice.customer,
          invoice: invoice._id,
          amountPaise: invoice.grandTotalPaise,
          method: paymentMethod,
          status: PAYMENT_STATUS.UNPAID,
        },
      ],
      { session },
    );

    order.payment = payment._id;
    recordStatus(
      order,
      ORDER_STATUS.CONFIRMED,
      admin,
      `Bill approved (customer confirmed via WhatsApp, paying by ${paymentMethod === PAYMENT_METHOD.UPI ? 'UPI' : 'cash'})`,
    );
    await order.save({ session });
    await recordAudit({
      actor: admin,
      action: AUDIT_ACTION.INVOICE_APPROVED,
      entityType: 'Invoice',
      entityId: invoice._id,
      metadata: {
        orderNumber: order.orderNumber,
        version: invoice.version,
        grandTotalPaise: invoice.grandTotalPaise,
        paymentMethod,
        confirmedVia: 'WHATSAPP',
      },
      req,
      session,
    });
  });

  await afterCommit(
    () =>
      notify({
        to: order.customer,
        type: NOTIFICATION_TYPE.INVOICE_APPROVED,
        title: 'Order Confirmed',
        message: `Your approval for ${order.orderNumber} via WhatsApp was recorded. We are assigning a rider for delivery.`,
        order,
      }),
    () => publishOrderChange(order),
  );
  return { order, invoice };
}

export async function rejectInvoice(invoiceId, { reason }, customer, req) {
  let order;
  await mongoose.connection.transaction(async (session) => {
    const invoice = await findCustomerInvoice(invoiceId, customer, session);
    order = await Order.findById(invoice.order).session(session);

    if (invoice.status !== INVOICE_STATUS.SENT || order.status !== ORDER_STATUS.WAITING_FOR_CUSTOMER_APPROVAL) {
      throw conflict('This bill is no longer waiting for your answer.');
    }

    invoice.status = INVOICE_STATUS.REJECTED;
    invoice.rejectionReason = reason;
    invoice.rejectedAt = new Date();
    await invoice.save({ session });

    recordStatus(order, ORDER_STATUS.UNDER_REVIEW, customer, `Bill rejected: ${reason}`);
    await order.save({ session });
    await recordAudit({
      actor: customer,
      action: AUDIT_ACTION.INVOICE_REJECTED,
      entityType: 'Invoice',
      entityId: invoice._id,
      metadata: { orderNumber: order.orderNumber, version: invoice.version, reason },
      req,
      session,
    });
  });

  await afterCommit(
    () =>
      notify({
        to: 'admins',
        type: NOTIFICATION_TYPE.INVOICE_REJECTED,
        title: 'Bill rejected',
        message: `${customer.fullName} rejected the bill for ${order.orderNumber}: ${reason}`,
        order,
      }),
    () => publishOrderChange(order),
  );
  return order;
}

export async function listInvoices({ viewer, page, pageSize, status }) {
  const filter = {};
  if (viewer.role === ROLES.CUSTOMER) {
    filter.customer = viewer._id;
    filter.status = status && status !== INVOICE_STATUS.DRAFT ? status : { $ne: INVOICE_STATUS.DRAFT };
  } else if (status) {
    filter.status = status;
  }

  const [invoices, totalItems] = await Promise.all([
    Invoice.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate('order', 'orderNumber status currentRider')
      .populate('customer', 'fullName phone'),
    Invoice.countDocuments(filter),
  ]);

  return {
    invoices: invoices.map((invoice) => ({
      ...serializeInvoice(invoice),
      orderNumber: invoice.order?.orderNumber ?? null,
      orderStatus: invoice.order?.status ?? null,
      currentRider: invoice.order?.currentRider ?? null,
      customerName: viewer.role === ROLES.ADMIN ? (invoice.customer?.fullName ?? null) : undefined,
      customerPhone: viewer.role === ROLES.ADMIN ? (invoice.customer?.phone ?? null) : undefined,
    })),
    totalItems,
  };
}

export async function getInvoiceForViewer(invoiceId, viewer) {
  if (!mongoose.isValidObjectId(invoiceId)) throw invoiceNotFound();

  const filter = { _id: invoiceId };
  if (viewer.role === ROLES.CUSTOMER) {
    filter.customer = viewer._id;
    filter.status = { $ne: INVOICE_STATUS.DRAFT };
  } else if (viewer.role !== ROLES.ADMIN) {
    throw invoiceNotFound();
  }

  const invoice = await Invoice.findOne(filter).populate('order').populate('customer', 'fullName phone email');
  if (!invoice) throw invoiceNotFound();
  return invoice;
}

/** Draws a printable A4 invoice. Uses "Rs." because the PDF's built-in fonts have no rupee sign. */
export async function buildInvoicePdf(invoice) {
  const store = await StoreSettings.findOne();
  const order = invoice.order;
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Invoice ${order.orderNumber}` } });

  const green = '#354D40';
  const muted = '#4A5A4F';
  doc.fillColor(green).font('Helvetica-Bold').fontSize(20).text(store?.storeName ?? 'CK Medical');
  doc.fillColor(muted).font('Helvetica').fontSize(9);
  if (store?.address) {
    doc.text(`${store.address.fullAddress}, ${store.address.area}, ${store.address.city}, ${store.address.state} ${store.address.pincode}`);
  }
  if (store?.contactPhone) doc.text(`Phone: ${store.contactPhone}`);

  doc.moveDown(1.2).fillColor('#26352B').font('Helvetica-Bold').fontSize(14).text('Invoice');
  doc.font('Helvetica').fontSize(10);
  doc.text(`Invoice number: INV-${order.orderNumber}-V${invoice.version}`);
  doc.text(`Order: ${order.orderNumber}`);
  doc.text(`Date: ${(invoice.sentAt ?? invoice.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
  doc.text(`Status: ${invoice.status}${invoice.approvedAt ? ` (approved ${invoice.approvedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })})` : ''}`);

  doc.moveDown().font('Helvetica-Bold').text('Bill to');
  doc.font('Helvetica').text(invoice.customer.fullName).text(`Phone: ${invoice.customer.phone}`);
  const address = order.addressSnapshot;
  doc.text(`${address.fullAddress}, ${address.area}, ${address.city}, ${address.state} ${address.pincode}`);

  const columns = { item: 50, qty: 320, price: 370, total: 460 };
  const drawRow = (y, cells, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
    doc.text(cells[0], columns.item, y, { width: 260 });
    doc.text(cells[1], columns.qty, y, { width: 40, align: 'right' });
    doc.text(cells[2], columns.price, y, { width: 80, align: 'right' });
    doc.text(cells[3], columns.total, y, { width: 85, align: 'right' });
  };

  doc.moveDown(1.5);
  let y = doc.y;
  drawRow(y, ['Medicine', 'Qty', 'Unit price', 'Total'], true);
  y += 18;
  doc.moveTo(50, y - 4).lineTo(545, y - 4).strokeColor('#E3E7DD').stroke();

  for (const item of invoice.lineItems) {
    const label = item.isSubstitute ? `${item.description} (alternative for ${item.substituteFor ?? 'requested item'})` : item.description;
    drawRow(y, [label, String(item.quantity), formatRupees(item.unitPricePaise), formatRupees(item.lineTotalPaise)]);
    y = Math.max(doc.y, y + 16) + 4;
    if (y > 720) {
      doc.addPage();
      y = 50;
    }
  }

  doc.moveTo(50, y).lineTo(545, y).strokeColor('#E3E7DD').stroke();
  y += 8;
  const totals = [
    ['Subtotal', invoice.subtotalPaise],
    ...(invoice.discountPaise ? [['Discount', -invoice.discountPaise]] : []),
    ...(invoice.taxPaise ? [['Tax', invoice.taxPaise]] : []),
    [`Delivery charge${invoice.deliveryDistanceKm ? ` (${invoice.deliveryDistanceKm} km)` : ''}`, invoice.deliveryChargePaise],
  ];
  for (const [label, paise] of totals) {
    doc.font('Helvetica').fontSize(10).text(label, 300, y, { width: 150, align: 'right' });
    doc.text(paise < 0 ? `- ${formatRupees(-paise)}` : formatRupees(paise), columns.total, y, { width: 85, align: 'right' });
    y += 16;
  }
  doc.font('Helvetica-Bold').fontSize(12).text('Grand total', 300, y + 4, { width: 150, align: 'right' });
  doc.text(formatRupees(invoice.grandTotalPaise), columns.total - 20, y + 4, { width: 105, align: 'right' });

  if (invoice.remarks) {
    doc.moveDown(2).font('Helvetica').fontSize(9).fillColor(muted).text(`Remarks: ${invoice.remarks}`, 50, doc.y, { width: 495 });
  }

  doc.end();
  return doc;
}

/**
 * Permanently delete a single invoice from MongoDB Atlas.
 */
export async function deleteInvoice(invoiceId, adminUser, req) {
  if (!mongoose.isValidObjectId(invoiceId)) throw invoiceNotFound();

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw invoiceNotFound();

  await mongoose.connection.transaction(async (session) => {
    // If order references this invoice, update the order
    const order = await Order.findById(invoice.order).session(session);
    if (order && String(order.invoice) === String(invoice._id)) {
      const fallbackInvoice = await Invoice.findOne({
        order: order._id,
        _id: { $ne: invoice._id },
      })
        .sort({ version: -1 })
        .session(session);

      if (fallbackInvoice) {
        order.invoice = fallbackInvoice._id;
        order.invoiceVersion = fallbackInvoice.version;
      } else {
        order.invoice = undefined;
        order.invoiceVersion = undefined;
      }
      await order.save({ session });
    }

    await Invoice.findByIdAndDelete(invoice._id).session(session);

    await recordAudit({
      actor: adminUser,
      action: AUDIT_ACTION.INVOICE_DELETED,
      entityType: 'Invoice',
      entityId: invoice._id,
      metadata: { invoiceId: invoice._id, version: invoice.version, orderId: invoice.order },
      req,
      session,
    });
  });

  return { success: true, id: invoiceId };
}

/**
 * Permanently delete multiple invoices from MongoDB Atlas.
 */
export async function deleteInvoices(invoiceIds, adminUser, req) {
  if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'No invoices specified for deletion.');
  }

  const validIds = invoiceIds.filter((id) => mongoose.isValidObjectId(id));
  if (validIds.length === 0) {
    return { count: 0 };
  }

  let deletedCount = 0;
  await mongoose.connection.transaction(async (session) => {
    const invoices = await Invoice.find({ _id: { $in: validIds } }).session(session);
    const orderIds = [...new Set(invoices.map((inv) => String(inv.order)))];

    for (const orderId of orderIds) {
      const order = await Order.findById(orderId).session(session);
      if (order && validIds.some((id) => String(id) === String(order.invoice))) {
        const remainingInvoice = await Invoice.findOne({
          order: order._id,
          _id: { $nin: validIds },
        })
          .sort({ version: -1 })
          .session(session);

        if (remainingInvoice) {
          order.invoice = remainingInvoice._id;
          order.invoiceVersion = remainingInvoice.version;
        } else {
          order.invoice = undefined;
          order.invoiceVersion = undefined;
        }
        await order.save({ session });
      }
    }

    const res = await Invoice.deleteMany({ _id: { $in: validIds } }).session(session);
    deletedCount = res.deletedCount;

    await recordAudit({
      actor: adminUser,
      action: AUDIT_ACTION.INVOICES_BULK_DELETED,
      entityType: 'Invoice',
      metadata: { count: deletedCount, invoiceIds: validIds },
      req,
      session,
    });
  });

  return { count: deletedCount };
}
