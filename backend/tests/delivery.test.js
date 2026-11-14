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

describe('Phase 6: Rider Deliveries', () => {
  let server;
  let baseUrl;
  let adminClient;
  let admin;
  let customerClient;
  let customer;
  let riderClient;
  let rider;
  let orderId;
  let deliveryId;

  before(async () => {
    server = await startTestServer();
    baseUrl = server.baseUrl;
    ({ client: adminClient, user: admin } = await loginAs(baseUrl, ROLES.ADMIN));
    ({ client: customerClient, user: customer } = await loginAs(baseUrl, ROLES.CUSTOMER));
    ({ client: riderClient, user: rider } = await loginAs(baseUrl, ROLES.RIDER));
  });

  after(() => server.stop());

  it('admin views available riders with workload counts', async () => {
    const res = await adminClient.get('/api/admin/deliveries/available-riders');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    const found = res.body.data.find((r) => r.id === rider.id);
    assert.ok(found);
    assert.equal(found.activeDeliveries, 0);
  });

  it('customer places order, admin reviews, sends bill and customer approves with CASH', async () => {
    // 1. Get address
    const addrs = await customerClient.get('/api/customers/me/addresses');
    const address = addrs.body.data.addresses[0];

    // 2. Customer creates order
    const orderRes = await customerClient.post('/api/customers/me/orders', {
      addressId: address.id,
      customerInstructions: 'Call upon arrival',
      requestedItems: [{ description: 'Paracetamol 500mg', quantity: 2 }],
    });
    assert.equal(orderRes.status, 201);
    orderId = orderRes.body.data.orderId;

    // 3. Admin starts review & sends bill
    await adminClient.post(`/api/admin/orders/${orderId}/start-review`);
    await adminClient.post(`/api/admin/orders/${orderId}/invoices/draft`, {
      lineItems: [{ description: 'Paracetamol 500mg', quantity: 2, unitPricePaise: 2500 }],
      deliveryChargePaise: 3000,
    });
    const sendRes = await adminClient.post(`/api/admin/orders/${orderId}/invoices/send`);
    const invoiceId = sendRes.body.data.invoice.id;

    // 4. Customer approves with CASH
    const approveRes = await customerClient.post(`/api/customers/me/invoices/${invoiceId}/approve`, {
      paymentMethod: 'CASH',
    });
    assert.equal(approveRes.status, 200);

    const orderDetail = await adminClient.get(`/api/admin/orders/${orderId}`);
    assert.equal(orderDetail.body.data.order.status, ORDER_STATUS.CONFIRMED);
  });

  it('admin assigns a rider to the confirmed order', async () => {
    const assignRes = await adminClient.post(`/api/admin/orders/${orderId}/assign-rider`, {
      riderId: rider.id,
    });

    assert.equal(assignRes.status, 200);
    assert.equal(assignRes.body.success, true);
    deliveryId = assignRes.body.data.deliveryId;
    assert.ok(deliveryId);

    const orderDetail = await adminClient.get(`/api/admin/orders/${orderId}`);
    assert.equal(orderDetail.body.data.order.status, ORDER_STATUS.RIDER_ASSIGNED);
  });

  it('rider lists their active assigned deliveries', async () => {
    const res = await riderClient.get('/api/riders/me/deliveries?scope=active');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.length >= 1);
    const del = res.body.data.find((d) => d.id === deliveryId);
    assert.ok(del);
    assert.equal(del.status, DELIVERY_STATUS.RIDER_ASSIGNED);
  });

  it('rider gets delivery details', async () => {
    const res = await riderClient.get(`/api/riders/me/deliveries/${deliveryId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.delivery.id, deliveryId);
    assert.equal(res.body.data.allowedActions.canStart, true);
  });

  it('rider starts delivery (out for delivery)', async () => {
    const res = await riderClient.post(`/api/riders/me/deliveries/${deliveryId}/action`, {
      action: 'start',
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.delivery.status, DELIVERY_STATUS.OUT_FOR_DELIVERY);

    const orderDetail = await adminClient.get(`/api/admin/orders/${orderId}`);
    assert.equal(orderDetail.body.data.order.status, ORDER_STATUS.OUT_FOR_DELIVERY);
  });

  it('rider reaches customer location', async () => {
    const res = await riderClient.post(`/api/riders/me/deliveries/${deliveryId}/action`, {
      action: 'reach',
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.delivery.status, DELIVERY_STATUS.REACHED_CUSTOMER);

    const orderDetail = await adminClient.get(`/api/admin/orders/${orderId}`);
    assert.equal(orderDetail.body.data.order.status, ORDER_STATUS.REACHED_CUSTOMER);
  });

  it('rider records cash collection', async () => {
    const res = await riderClient.post(`/api/riders/me/deliveries/${deliveryId}/collect-cash`, {
      amountPaise: 8000,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.payment.status, PAYMENT_STATUS.CASH_COLLECTED);
  });

  it('rider marks order delivered', async () => {
    const res = await riderClient.post(`/api/riders/me/deliveries/${deliveryId}/action`, {
      action: 'deliver',
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.delivery.status, DELIVERY_STATUS.DELIVERED);

    const orderDetail = await adminClient.get(`/api/admin/orders/${orderId}`);
    assert.equal(orderDetail.body.data.order.status, ORDER_STATUS.DELIVERED);
  });

  it('delivery appears in rider history and admin delivery list', async () => {
    const riderHistory = await riderClient.get('/api/riders/me/deliveries?scope=history');
    assert.equal(riderHistory.status, 200);
    const foundRider = riderHistory.body.data.find((d) => d.id === deliveryId);
    assert.ok(foundRider);

    const adminList = await adminClient.get('/api/admin/deliveries?scope=all');
    assert.equal(adminList.status, 200);
    const foundAdmin = adminList.body.data.find((d) => d.id === deliveryId);
    assert.ok(foundAdmin);
  });

  it('rider can confirm online UPI payment at doorstep and mark delivered', async () => {
    // 1. Customer creates a second order
    const addrs = await customerClient.get('/api/customers/me/addresses');
    const address = addrs.body.data.addresses[0];
    const orderRes = await customerClient.post('/api/customers/me/orders', {
      addressId: address.id,
      customerInstructions: 'Leave at door',
      requestedItems: [{ description: 'Vitamin C 500mg', quantity: 1 }],
    });
    const order2Id = orderRes.body.data.orderId;

    // 2. Admin prepares bill & customer approves via UPI
    await adminClient.post(`/api/admin/orders/${order2Id}/start-review`);
    await adminClient.post(`/api/admin/orders/${order2Id}/invoices/draft`, {
      lineItems: [{ description: 'Vitamin C 500mg', quantity: 1, unitPricePaise: 5600 }],
    });
    const sendRes = await adminClient.post(`/api/admin/orders/${order2Id}/invoices/send`);
    const invoiceId = sendRes.body.data.invoice.id;
    await customerClient.post(`/api/customers/me/invoices/${invoiceId}/approve`, {
      paymentMethod: 'UPI',
    });

    // 3. Admin assigns to rider
    const assignRes = await adminClient.post(`/api/admin/orders/${order2Id}/assign-rider`, {
      riderId: rider.id,
    });
    const deliv2Id = assignRes.body.data.deliveryId;

    // 4. Rider starts and reaches customer
    await riderClient.post(`/api/riders/me/deliveries/${deliv2Id}/action`, { action: 'start' });
    await riderClient.post(`/api/riders/me/deliveries/${deliv2Id}/action`, { action: 'reach' });

    // 5. Rider verifies online payment done by customer
    const confirmRes = await riderClient.post(`/api/riders/me/deliveries/${deliv2Id}/confirm-online`);
    assert.equal(confirmRes.status, 200);
    assert.equal(confirmRes.body.data.payment.status, PAYMENT_STATUS.PAID);
    assert.equal(confirmRes.body.data.payment.method, PAYMENT_METHOD.UPI);
    assert.equal(String(confirmRes.body.data.payment.collectedBy), rider.id);

    // 6. Rider marks delivered
    const deliverRes = await riderClient.post(`/api/riders/me/deliveries/${deliv2Id}/action`, { action: 'deliver' });
    assert.equal(deliverRes.status, 200);
    assert.equal(deliverRes.body.data.delivery.status, DELIVERY_STATUS.DELIVERED);

    // 7. Admin payment list shows online payment verified by rider
    const paymentsRes = await adminClient.get('/api/admin/payments');
    assert.equal(paymentsRes.status, 200);
    const orderPayment = paymentsRes.body.data.find((p) => p.orderId === order2Id);
    assert.ok(orderPayment);
    assert.equal(orderPayment.status, PAYMENT_STATUS.PAID);
    assert.equal(orderPayment.collectedByName, rider.fullName);
  });
});
