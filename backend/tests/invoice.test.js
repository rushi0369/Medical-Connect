import './helpers/testEnv.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { INVOICE_STATUS, ORDER_STATUS, PAYMENT_METHOD, ROLES } from '../src/config/constants.js';
import {
  createClient,
  createUser,
  loginAs,
  startTestServer,
} from './helpers/testServer.js';

describe('Phase 4: Admin Review, Billing & Invoices', () => {
  let server;
  let baseUrl;
  let adminClient;
  let admin;
  let customerClient;
  let customer;

  before(async () => {
    server = await startTestServer();
    baseUrl = server.baseUrl;
    ({ client: adminClient, user: admin } = await loginAs(baseUrl, ROLES.ADMIN));
    ({ client: customerClient, user: customer } = await loginAs(baseUrl, ROLES.CUSTOMER));
  });

  after(() => server.stop());

  let orderId;
  let invoiceId;

  it('customer places request, admin views it in order list', async () => {
    const list = await customerClient.get('/api/customers/me/addresses');
    const address = list.body.data.addresses[0];

    const orderRes = await customerClient.post('/api/customers/me/orders', {
      addressId: address.id,
      customerInstructions: 'Urgent delivery needed',
      requestedItems: [
        { description: 'Amoxicillin 500mg', quantity: 2 },
        { description: 'Paracetamol 650mg', quantity: 1 },
      ],
    });

    assert.equal(orderRes.status, 201);
    orderId = orderRes.body.data.orderId;

    const adminOrders = await adminClient.get('/api/admin/orders');
    assert.equal(adminOrders.status, 200);
    assert.ok(adminOrders.body.data.some((o) => o.id === orderId));
  });

  it('admin starts review and saves stock availability notes', async () => {
    const startRes = await adminClient.post(`/api/admin/orders/${orderId}/start-review`);
    assert.equal(startRes.status, 200);
    assert.equal(startRes.body.data.status, ORDER_STATUS.UNDER_REVIEW);

    const orderDetail = await adminClient.get(`/api/admin/orders/${orderId}`);
    const items = orderDetail.body.data.order.requestedItems;

    const notesRes = await adminClient.patch(`/api/admin/orders/${orderId}/review-notes`, {
      adminRemarks: 'Amoxicillin brand changed to generic equivalent',
      requestedItems: [
        { id: items[0].id, isUnavailable: true, alternativeNote: 'Mox 500mg available' },
        { id: items[1].id, isUnavailable: false },
      ],
    });
    assert.equal(notesRes.status, 200);
  });

  it('admin creates and saves bill draft', async () => {
    const draftRes = await adminClient.post(`/api/admin/orders/${orderId}/invoices/draft`, {
      lineItems: [
        { description: 'Mox 500mg (Alt)', quantity: 2, unitPricePaise: 8500, isSubstitute: true, substituteFor: 'Amoxicillin 500mg' },
        { description: 'Paracetamol 650mg', quantity: 1, unitPricePaise: 3000 },
      ],
      deliveryChargePaise: 2500,
      discountPaise: 1000,
      taxPaise: 500,
      remarks: 'Thank you for choosing MediCare',
    });

    assert.equal(draftRes.status, 200);
    const { invoice } = draftRes.body.data;
    assert.equal(invoice.status, INVOICE_STATUS.DRAFT);
    // Subtotal: 2*8500 + 3000 = 20000. Grand total: 20000 - 1000 + 500 + 2500 = 22000 paise (Rs 220)
    assert.equal(invoice.subtotalPaise, 20000);
    assert.equal(invoice.grandTotalPaise, 22000);
    invoiceId = invoice.id;
  });

  it('admin sends invoice to customer', async () => {
    const sendRes = await adminClient.post(`/api/admin/orders/${orderId}/invoices/send`);
    assert.equal(sendRes.status, 200);
    assert.equal(sendRes.body.data.invoice.status, INVOICE_STATUS.SENT);

    const checkOrder = await customerClient.get(`/api/customers/me/orders/${orderId}`);
    assert.equal(checkOrder.body.data.order.status, ORDER_STATUS.WAITING_FOR_CUSTOMER_APPROVAL);
  });

  it('customer approves invoice with UPI and accepts substitutes', async () => {
    const approveRes = await customerClient.post(`/api/customers/me/invoices/${invoiceId}/approve`, {
      paymentMethod: PAYMENT_METHOD.UPI,
      acceptSubstitutes: true,
    });

    assert.equal(approveRes.status, 200);

    const checkOrder = await customerClient.get(`/api/customers/me/orders/${orderId}`);
    assert.equal(checkOrder.body.data.order.status, ORDER_STATUS.CONFIRMED);
    assert.equal(checkOrder.body.data.order.payment.method, PAYMENT_METHOD.UPI);
  });

  it('generates downloadable PDF invoice', async () => {
    const pdfRes = await fetch(`${baseUrl}/api/admin/invoices/${invoiceId}/pdf`, {
      headers: { Cookie: adminClient.getCookie() },
    });
    assert.equal(pdfRes.status, 200);
    assert.equal(pdfRes.headers.get('content-type'), 'application/pdf');
    const bytes = await pdfRes.arrayBuffer();
    assert.ok(bytes.byteLength > 100);
  });

  it('admin can save store settings with UPI ID and customers can read it', async () => {
    const saveRes = await adminClient.post('/api/admin/settings', {
      storeName: 'MediCare Pharmacy',
      contactPhone: '9876543210',
      upiId: 'medicare@okaxis',
    });
    assert.equal(saveRes.status, 200);
    assert.equal(saveRes.body.data.upiId, 'medicare@okaxis');

    const publicRes = await fetch(`${baseUrl}/api/settings`);
    assert.equal(publicRes.status, 200);
    const json = await publicRes.json();
    assert.equal(json.data.upiId, 'medicare@okaxis');
    assert.equal(json.data.storeName, 'MediCare Pharmacy');
  });

  it('admin can list all registered customers and view detailed profile', async () => {
    const customersRes = await adminClient.get('/api/admin/customers');
    assert.equal(customersRes.status, 200);
    assert.ok(customersRes.body.data.length >= 1);

    const customerRecord = await adminClient.get(`/api/admin/customers/${customer._id}`);
    assert.equal(customerRecord.status, 200);
    assert.equal(customerRecord.body.data.customer.fullName, customer.fullName);
    assert.ok(customerRecord.body.data.orders.length >= 1);
  });
});

