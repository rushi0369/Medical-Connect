import './helpers/testEnv.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  DELIVERY_STATUS,
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  ROLES,
} from '../src/config/constants.js';
import {
  createClient,
  createUser,
  loginAs,
  startTestServer,
} from './helpers/testServer.js';

describe('Phase 8: Complete End-to-End Cross-Role Order Flow', () => {
  let server;
  let baseUrl;
  let adminClient;
  let admin;
  let customerClient;
  let customer;
  let rider1Client;
  let rider1;
  let rider2Client;
  let rider2;
  let orderId;
  let invoiceId;
  let deliveryId;

  before(async () => {
    server = await startTestServer();
    baseUrl = server.baseUrl;
    ({ client: adminClient, user: admin } = await loginAs(baseUrl, ROLES.ADMIN));
    ({ client: customerClient, user: customer } = await loginAs(baseUrl, ROLES.CUSTOMER));
    ({ client: rider1Client, user: rider1 } = await loginAs(baseUrl, ROLES.RIDER));
    // Create a 2nd rider to verify strict rider isolation
    ({ client: rider2Client, user: rider2 } = await loginAs(baseUrl, ROLES.RIDER));
  });

  after(() => server.stop());

  it('Step 1: Customer submits medicine request', async () => {
    const addrs = await customerClient.get('/api/customers/me/addresses');
    assert.equal(addrs.status, 200);
    const address = addrs.body.data.addresses[0];

    const orderRes = await customerClient.post('/api/customers/me/orders', {
      addressId: address.id,
      customerInstructions: 'Leave with guard if unavailable',
      requestedItems: [
        { description: 'Amoxicillin 500mg', quantity: 2 },
        { description: 'Vitamin C 500mg', quantity: 1 },
      ],
    });

    assert.equal(orderRes.status, 201);
    assert.equal(orderRes.body.success, true);
    orderId = orderRes.body.data.orderId;
    assert.equal(orderRes.body.data.status, ORDER_STATUS.PENDING_ADMIN_REVIEW);
  });

  it('Step 2: Admin reviews order and creates bill draft', async () => {
    // Start review
    const startRes = await adminClient.post(`/api/admin/orders/${orderId}/start-review`);
    assert.equal(startRes.status, 200);

    // Save draft bill
    const draftRes = await adminClient.post(`/api/admin/orders/${orderId}/invoices/draft`, {
      lineItems: [
        { description: 'Amoxicillin 500mg (10 tabs)', quantity: 2, unitPricePaise: 12000 },
        { description: 'Limcee Vitamin C (15 chewables)', quantity: 1, unitPricePaise: 4500 },
      ],
      deliveryChargePaise: 3000,
      discountPaise: 1500,
      taxPaise: 1200,
      remarks: 'Standard pharmacy billing',
    });

    assert.equal(draftRes.status, 200);
    invoiceId = draftRes.body.data.invoice.id;
    assert.equal(draftRes.body.data.invoice.grandTotalPaise, 24000 + 4500 + 3000 - 1500 + 1200);

    // Send bill to customer
    const sendRes = await adminClient.post(`/api/admin/orders/${orderId}/invoices/send`);
    assert.equal(sendRes.status, 200);
  });

  it('Step 3: Customer approves the bill choosing Store UPI QR', async () => {
    const approveRes = await customerClient.post(`/api/customers/me/invoices/${invoiceId}/approve`, {
      paymentMethod: PAYMENT_METHOD.UPI,
      acceptSubstitutes: true,
    });

    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.body.data.orderId, orderId);
  });

  it('Step 4: Admin assigns the order to Rider 1', async () => {
    const assignRes = await adminClient.post(`/api/admin/orders/${orderId}/assign-rider`, {
      riderId: rider1.id,
    });

    assert.equal(assignRes.status, 200);
    assert.equal(assignRes.body.data.status, ORDER_STATUS.RIDER_ASSIGNED);
    deliveryId = assignRes.body.data.deliveryId;
    assert.ok(deliveryId);
  });

  it('Step 5: Enforces strict Rider Isolation (Rider 2 cannot see or access Rider 1 order)', async () => {
    // Rider 2 assigned orders list
    const r2List = await rider2Client.get('/api/riders/me/deliveries');
    assert.equal(r2List.status, 200);
    const hasOrder = r2List.body.data.some((d) => d.id === deliveryId);
    assert.equal(hasOrder, false);

    // Rider 2 direct access attempt
    const r2Detail = await rider2Client.get(`/api/riders/me/deliveries/${deliveryId}`);
    assert.equal(r2Detail.status, 404);
  });

  it('Step 6: Assigned Rider 1 receives full order details & Store UPI QR', async () => {
    const r1Detail = await rider1Client.get(`/api/riders/me/deliveries/${deliveryId}`);
    assert.equal(r1Detail.status, 200);
    assert.equal(r1Detail.body.data.delivery.id, deliveryId);
    assert.equal(r1Detail.body.data.customer.fullName, customer.fullName);
    assert.equal(r1Detail.body.data.items.length, 2);
    assert.equal(r1Detail.body.data.payment.method, 'UPI');
  });

  it('Step 7: Rider 1 performs delivery workflow (Out for Delivery -> Reached Customer)', async () => {
    // Start delivery
    const startRes = await rider1Client.post(`/api/riders/me/deliveries/${deliveryId}/action`, {
      action: 'start',
    });
    assert.equal(startRes.status, 200);
    assert.equal(startRes.body.data.delivery.status, DELIVERY_STATUS.OUT_FOR_DELIVERY);

    // Reached customer
    const reachRes = await rider1Client.post(`/api/riders/me/deliveries/${deliveryId}/action`, {
      action: 'reach',
    });
    assert.equal(reachRes.status, 200);
    assert.equal(reachRes.body.data.delivery.status, DELIVERY_STATUS.REACHED_CUSTOMER);
  });

  it('Step 8: Payment is verified and Rider 1 marks delivery complete', async () => {
    // Customer pays via Store UPI QR, simulated or verified in DB
    const { Payment } = await import('../src/models/Payment.js');
    await Payment.findOneAndUpdate(
      { order: orderId },
      { status: PAYMENT_STATUS.PAID, paidAt: new Date(), paymentReference: 'UPI-E2E-TEST-9988' },
    );

    // Rider 1 finalizes delivery
    const deliverRes = await rider1Client.post(`/api/riders/me/deliveries/${deliveryId}/action`, {
      action: 'deliver',
    });
    assert.equal(deliverRes.status, 200);
    assert.equal(deliverRes.body.data.delivery.status, DELIVERY_STATUS.DELIVERED);
  });

  it('Step 9: Universal completion check - Customer, Rider, and Admin all see order DELIVERED', async () => {
    // 1. Customer view
    const custOrder = await customerClient.get(`/api/customers/me/orders/${orderId}`);
    assert.equal(custOrder.status, 200);
    assert.equal(custOrder.body.data.order.status, ORDER_STATUS.DELIVERED);

    // 2. Rider view
    const riderOrder = await rider1Client.get(`/api/riders/me/deliveries/${deliveryId}`);
    assert.equal(riderOrder.status, 200);
    assert.equal(riderOrder.body.data.delivery.status, DELIVERY_STATUS.DELIVERED);

    // 3. Admin view
    const adminOrder = await adminClient.get(`/api/admin/orders/${orderId}`);
    assert.equal(adminOrder.status, 200);
    assert.equal(adminOrder.body.data.order.status, ORDER_STATUS.DELIVERED);
  });

  it('Step 10: Admin verifies Payments ledger and Reports analytics', async () => {
    // Payments list
    const paymentsRes = await adminClient.get('/api/admin/payments');
    assert.equal(paymentsRes.status, 200);
    assert.ok(paymentsRes.body.data.some((p) => p.orderId === orderId && p.status === 'PAID'));

    // Reports analytics
    const reportsRes = await adminClient.get('/api/admin/reports?groupBy=day');
    assert.equal(reportsRes.status, 200);
    assert.ok(reportsRes.body.data.totals.delivered >= 1);
    assert.ok(reportsRes.body.data.totals.revenuePaise > 0);
  });

  it('Step 11: Admin can purge old orders by days filter (10, 20, 30 days) to keep database lean', async () => {
    const purgeRes = await adminClient.post('/api/admin/orders/purge', {
      days: 30,
      scope: 'ALL',
    });
    assert.equal(purgeRes.status, 200);
    assert.equal(purgeRes.body.success, true);
    assert.equal(typeof purgeRes.body.data.deletedOrdersCount, 'number');
  });

  it('Step 12: Admin permanently deletes an individual order', async () => {
    const deleteRes = await adminClient.delete(`/api/admin/orders/${orderId}`);
    assert.equal(deleteRes.status, 200);
    assert.equal(deleteRes.body.success, true);

    // Verify it is gone from database
    const checkRes = await adminClient.get(`/api/admin/orders/${orderId}`);
    assert.equal(checkRes.status, 404);
  });
});
