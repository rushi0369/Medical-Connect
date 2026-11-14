import './helpers/testEnv.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { AUDIT_ACTION, DELIVERY_STATUS, ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, ROLES } from '../src/config/constants.js';
import { AuditLog, Delivery, Invoice, Notification, Order, Payment, User } from '../src/models/index.js';
import { Counter } from '../src/models/Counter.js';
import { startOfTodayInIndia } from '../src/services/dashboard.service.js';
import {
  createClient,
  createUser,
  loginAs,
  sampleAddress,
  startTestServer,
  TEST_PASSWORD,
  uniqueEmail,
  uniquePhone,
} from './helpers/testServer.js';

const NEW_PASSWORD = 'BrandNew456';
const SOMEONE_ELSES_ID = '507f1f77bcf86cd799439011';

let orderCounter = 0;
const createOrder = (customer, overrides = {}) => {
  orderCounter += 1;
  return Order.create({
    orderNumber: `ACCESS-${orderCounter}`,
    customer: customer._id,
    addressSnapshot: sampleAddress,
    requestedItems: [{ description: 'Paracetamol 500mg', quantity: 1 }],
    ...overrides,
  });
};

describe('role-based access', () => {
  let server;
  let baseUrl;
  let adminClient;
  let admin;

  before(async () => {
    server = await startTestServer();
    baseUrl = server.baseUrl;
    ({ client: adminClient, user: admin } = await loginAs(baseUrl, ROLES.ADMIN));
  });

  after(() => server.stop());

  const newClient = () => createClient(baseUrl);

  const newRiderPayload = (overrides = {}) => ({
    fullName: 'Ravi Kumar',
    phone: uniquePhone(),
    email: uniqueEmail(),
    vehicleNumber: 'gj05ab1234',
    ...overrides,
  });

  /** Rider who has already replaced their temporary password. */
  const readyRider = () => loginAs(baseUrl, ROLES.RIDER);

  describe('who can reach what', () => {
    const adminOnlyRoutes = [
      ['get', '/api/admin/summary'],
      ['get', '/api/riders'],
      ['post', '/api/riders'],
      ['get', `/api/riders/${SOMEONE_ELSES_ID}`],
      ['patch', `/api/riders/${SOMEONE_ELSES_ID}`],
      ['patch', `/api/riders/${SOMEONE_ELSES_ID}/status`],
      ['post', `/api/riders/${SOMEONE_ELSES_ID}/reset-credentials`],
    ];

    it('sends visitors who are not logged in away from every protected route', async () => {
      const client = newClient();
      for (const [method, path] of [
        ...adminOnlyRoutes,
        ['get', '/api/customers/me/summary'],
        ['get', '/api/riders/me/summary'],
        ['get', '/api/notifications'],
      ]) {
        const response = await client[method](path);
        assert.equal(response.status, 401, `${method} ${path}`);
        assert.equal(response.body.error.code, 'NOT_AUTHENTICATED');
      }
    });

    it('refuses customers and riders on every admin route', async () => {
      const { client: customerClient } = await loginAs(baseUrl, ROLES.CUSTOMER);
      const { client: riderClient } = await readyRider();

      for (const [method, path] of adminOnlyRoutes) {
        for (const client of [customerClient, riderClient]) {
          const response = await client[method](path);
          assert.equal(response.status, 403, `${method} ${path}`);
          assert.equal(response.body.error.code, 'FORBIDDEN');
        }
      }
    });

    it('keeps the customer and rider dashboards to their own role', async () => {
      const { client: customerClient } = await loginAs(baseUrl, ROLES.CUSTOMER);
      const { client: riderClient } = await readyRider();

      assert.equal((await customerClient.get('/api/customers/me/summary')).status, 200);
      assert.equal((await customerClient.get('/api/riders/me/summary')).status, 403);
      assert.equal((await riderClient.get('/api/riders/me/summary')).status, 200);
      assert.equal((await riderClient.get('/api/customers/me/summary')).status, 403);
      assert.equal((await adminClient.get('/api/customers/me/summary')).status, 403);
    });
  });

  describe('rider accounts', () => {
    it('creates a rider with an ID and a temporary password shown once', async () => {
      const response = await adminClient.post('/api/riders', newRiderPayload());

      assert.equal(response.status, 201);
      const { rider, temporaryPassword } = response.body.data;
      assert.match(rider.riderProfile.riderId, /^RDR-\d{4}$/);
      assert.equal(rider.riderProfile.vehicleNumber, 'GJ05AB1234');
      assert.equal(rider.role, ROLES.RIDER);
      assert.equal(rider.mustChangePassword, true);
      assert.ok(temporaryPassword.length >= 12);

      const stored = await User.findById(rider.id).select('+passwordHash');
      assert.notEqual(stored.passwordHash, temporaryPassword);

      const fetched = await adminClient.get(`/api/riders/${rider.id}`);
      assert.doesNotMatch(JSON.stringify(fetched.body), new RegExp(temporaryPassword));
      assert.doesNotMatch(JSON.stringify(fetched.body), /passwordHash/);

      const audit = await AuditLog.findOne({ action: AUDIT_ACTION.RIDER_CREATED, entityId: rider.id });
      assert.equal(audit.actor.toString(), admin.id);
      assert.equal(audit.actorRole, ROLES.ADMIN);
      assert.doesNotMatch(JSON.stringify(audit), new RegExp(temporaryPassword));
    });

    it('gives each rider a new ID', async () => {
      const first = await adminClient.post('/api/riders', newRiderPayload());
      const second = await adminClient.post('/api/riders', newRiderPayload());
      assert.notEqual(first.body.data.rider.riderProfile.riderId, second.body.data.rider.riderProfile.riderId);
    });

    it('rolls everything back when a duplicate phone stops the creation', async () => {
      const phone = uniquePhone();
      await adminClient.post('/api/riders', newRiderPayload({ phone }));

      const before_ = await Counter.findById('rider');
      const auditBefore = await AuditLog.countDocuments({ action: AUDIT_ACTION.RIDER_CREATED });

      const duplicate = await adminClient.post('/api/riders', newRiderPayload({ phone }));
      assert.equal(duplicate.status, 409);
      assert.ok(duplicate.body.error.details.fieldErrors.phone);

      const after_ = await Counter.findById('rider');
      assert.equal(after_.seq, before_.seq);
      assert.equal(await AuditLog.countDocuments({ action: AUDIT_ACTION.RIDER_CREATED }), auditBefore);
    });

    it('cannot set a password or role when creating a rider', async () => {
      const response = await adminClient.post(
        '/api/riders',
        newRiderPayload({ password: 'Chosen12345', role: ROLES.ADMIN, riderProfile: { riderId: 'HACK' } }),
      );

      assert.equal(response.status, 201);
      assert.equal(response.body.data.rider.role, ROLES.RIDER);
      assert.notEqual(response.body.data.rider.riderProfile.riderId, 'HACK');

      const login = await newClient().post('/api/auth/login', {
        identifier: response.body.data.rider.phone,
        password: 'Chosen12345',
      });
      assert.equal(login.status, 401);
    });

    it('makes a new rider replace the temporary password before doing anything else', async () => {
      const { rider, temporaryPassword } = (await adminClient.post('/api/riders', newRiderPayload())).body.data;
      const client = newClient();

      const login = await client.post('/api/auth/login', { identifier: rider.phone, password: temporaryPassword });
      assert.equal(login.status, 200);
      assert.equal(login.body.data.user.mustChangePassword, true);

      const blocked = await client.get('/api/riders/me/summary');
      assert.equal(blocked.status, 403);
      assert.equal(blocked.body.error.code, 'PASSWORD_CHANGE_REQUIRED');

      const changed = await client.post('/api/auth/change-password', {
        currentPassword: temporaryPassword,
        newPassword: NEW_PASSWORD,
      });
      assert.equal(changed.status, 200);
      assert.equal(changed.body.data.user.mustChangePassword, false);

      assert.equal((await client.get('/api/riders/me/summary')).status, 200);
    });

    it('signs out a deactivated rider immediately, and blocks new logins until reactivated', async () => {
      const { client: riderClient, user: rider } = await readyRider();
      assert.equal((await riderClient.get('/api/riders/me/summary')).status, 200);

      const deactivated = await adminClient.patch(`/api/riders/${rider.id}/status`, { isActive: false });
      assert.equal(deactivated.status, 200);
      assert.equal(deactivated.body.data.rider.isActive, false);

      assert.equal((await riderClient.get('/api/riders/me/summary')).status, 401);

      const credentials = { identifier: rider.phone, password: TEST_PASSWORD };
      const refused = await newClient().post('/api/auth/login', credentials);
      assert.equal(refused.status, 403);
      assert.equal(refused.body.error.code, 'ACCOUNT_INACTIVE');

      await adminClient.patch(`/api/riders/${rider.id}/status`, { isActive: true });
      assert.equal((await newClient().post('/api/auth/login', credentials)).status, 200);

      for (const action of [AUDIT_ACTION.RIDER_DEACTIVATED, AUDIT_ACTION.RIDER_ACTIVATED]) {
        assert.ok(await AuditLog.findOne({ action, entityId: rider._id }));
      }
    });

    it('resetting credentials retires the old password and ends open logins', async () => {
      const { client: riderClient, user: rider } = await readyRider();

      const reset = await adminClient.post(`/api/riders/${rider.id}/reset-credentials`);
      assert.equal(reset.status, 200);
      const { temporaryPassword } = reset.body.data;

      assert.equal((await riderClient.get('/api/riders/me/summary')).status, 401);

      const oldPassword = await newClient().post('/api/auth/login', { identifier: rider.phone, password: TEST_PASSWORD });
      assert.equal(oldPassword.status, 401);

      const fresh = await newClient().post('/api/auth/login', { identifier: rider.phone, password: temporaryPassword });
      assert.equal(fresh.status, 200);
      assert.equal(fresh.body.data.user.mustChangePassword, true);

      assert.ok(await AuditLog.findOne({ action: AUDIT_ACTION.RIDER_CREDENTIALS_RESET, entityId: rider._id }));
    });

    it('edits details, and can clear optional ones', async () => {
      const { rider } = (await adminClient.post('/api/riders', newRiderPayload())).body.data;

      const response = await adminClient.patch(`/api/riders/${rider.id}`, {
        fullName: 'Ravi K',
        email: '',
        vehicleNumber: '',
        notes: 'Morning shift',
      });

      assert.equal(response.status, 200);
      const updated = response.body.data.rider;
      assert.equal(updated.fullName, 'Ravi K');
      assert.equal(updated.email, null);
      assert.equal(updated.riderProfile.vehicleNumber, null);
      assert.equal(updated.riderProfile.notes, 'Morning shift');
      assert.equal(updated.riderProfile.riderId, rider.riderProfile.riderId);
    });

    it('refuses an empty edit and a phone already in use', async () => {
      const { rider } = (await adminClient.post('/api/riders', newRiderPayload())).body.data;

      assert.equal((await adminClient.patch(`/api/riders/${rider.id}`, {})).status, 422);

      const taken = await adminClient.patch(`/api/riders/${rider.id}`, { phone: admin.phone });
      assert.equal(taken.status, 409);
    });

    it('only treats real rider accounts as riders', async () => {
      assert.equal((await adminClient.get(`/api/riders/${admin.id}`)).status, 404);
      assert.equal((await adminClient.patch(`/api/riders/${admin.id}/status`, { isActive: false })).status, 404);
      assert.equal((await adminClient.post(`/api/riders/${admin.id}/reset-credentials`)).status, 404);
      assert.equal((await adminClient.get(`/api/riders/${SOMEONE_ELSES_ID}`)).status, 404);
      assert.equal((await adminClient.get('/api/riders/not-an-id')).status, 422);
    });
  });

  describe('rider list', () => {
    let tagged;

    before(async () => {
      tagged = await Promise.all(
        ['Zubin Mehta', 'Zubin Shah', 'Zubin Rao'].map((fullName) =>
          createUser(ROLES.RIDER, { fullName }),
        ),
      );
      await User.updateOne({ _id: tagged[2]._id }, { isActive: false });
    });

    it('supports pagination', async () => {
      const first = await adminClient.get('/api/riders?search=Zubin&page=1&pageSize=2');
      assert.equal(first.body.data.length, 2);
      assert.deepEqual(first.body.meta, { page: 1, pageSize: 2, totalItems: 3, totalPages: 2 });

      const second = await adminClient.get('/api/riders?search=Zubin&page=2&pageSize=2');
      assert.equal(second.body.data.length, 1);
    });

    it('searches by name, phone and rider ID, and filters by status', async () => {
      const byPhone = await adminClient.get(`/api/riders?search=${tagged[0].phone}`);
      assert.equal(byPhone.body.data[0].id, tagged[0].id);

      const byRiderId = await adminClient.get(`/api/riders?search=${tagged[1].riderProfile.riderId}`);
      assert.equal(byRiderId.body.data[0].id, tagged[1].id);

      const active = await adminClient.get('/api/riders?search=Zubin&status=active');
      assert.equal(active.body.meta.totalItems, 2);

      const inactive = await adminClient.get('/api/riders?search=Zubin&status=inactive');
      assert.equal(inactive.body.meta.totalItems, 1);
    });

    it('treats search text literally, so symbols cannot form a database pattern', async () => {
      const response = await adminClient.get(`/api/riders?search=${encodeURIComponent('.*')}`);
      assert.equal(response.status, 200);
      assert.equal(response.body.meta.totalItems, 0);
    });

    it('rejects bad list settings', async () => {
      assert.equal((await adminClient.get('/api/riders?pageSize=5000')).status, 422);
      assert.equal((await adminClient.get('/api/riders?status=everything')).status, 422);
    });

    it('shows real delivery counts for each rider', async () => {
      const customer = await createUser(ROLES.CUSTOMER);
      const rider = await createUser(ROLES.RIDER, { fullName: 'Counted Rider' });
      const shared = { customer: customer._id, rider: rider._id, assignedBy: admin._id };

      const active = await createOrder(customer);
      const done = await createOrder(customer);
      await Delivery.create({ ...shared, order: active._id, status: DELIVERY_STATUS.OUT_FOR_DELIVERY });
      await Delivery.create({ ...shared, order: done._id, status: DELIVERY_STATUS.DELIVERED, isCurrent: false });

      const response = await adminClient.get('/api/riders?search=Counted');
      assert.deepEqual(response.body.data[0].deliveryStats, { assigned: 1, completed: 1 });
    });
  });

  describe('dashboards', () => {
    it('admin figures come from real records', async () => {
      const baseline = (await adminClient.get('/api/admin/summary')).body.data;

      const customer = await createUser(ROLES.CUSTOMER);
      await createOrder(customer);
      await createOrder(customer, { status: ORDER_STATUS.UNDER_REVIEW });
      await createOrder(customer, { status: ORDER_STATUS.WAITING_FOR_CUSTOMER_APPROVAL });
      await createOrder(customer, { status: ORDER_STATUS.DELIVERED });
      await createOrder(customer, { status: ORDER_STATUS.DELIVERY_FAILED });

      const order = await createOrder(customer);
      const invoice = await Invoice.create({
        order: order._id,
        customer: customer._id,
        createdBy: admin._id,
        version: 1,
        lineItems: [{ description: 'Item', quantity: 1, unitPricePaise: 30000, lineTotalPaise: 30000 }],
        subtotalPaise: 30000,
        deliveryChargePaise: 3000,
        grandTotalPaise: 33000,
      });
      const payment = {
        order: order._id,
        customer: customer._id,
        invoice: invoice._id,
        amountPaise: 33000,
        method: PAYMENT_METHOD.UPI,
      };
      await Payment.create({ ...payment, status: PAYMENT_STATUS.PAID, paymentReference: 'REF-TODAY', paidAt: new Date() });
      await Payment.create({
        ...payment,
        amountPaise: 99900,
        status: PAYMENT_STATUS.PAID,
        paymentReference: 'REF-OLD',
        paidAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      });
      await Payment.create(payment);

      const summary = (await adminClient.get('/api/admin/summary')).body.data;

      assert.equal(summary.totalCustomers, baseline.totalCustomers + 1);
      assert.equal(summary.totalOrders, baseline.totalOrders + 6);
      assert.equal(summary.newRequests, baseline.newRequests + 2);
      assert.equal(summary.underReview, baseline.underReview + 1);
      assert.equal(summary.awaitingApproval, baseline.awaitingApproval + 1);
      assert.equal(summary.deliveredOrders, baseline.deliveredOrders + 1);
      assert.equal(summary.failedDeliveries, baseline.failedDeliveries + 1);
      assert.equal(summary.todayRevenuePaise, baseline.todayRevenuePaise + 33000);
      assert.equal(summary.pendingPayments, baseline.pendingPayments + 1);
    });

    it('a customer only ever counts their own orders', async () => {
      const { client, user } = await loginAs(baseUrl, ROLES.CUSTOMER);
      const stranger = await createUser(ROLES.CUSTOMER);

      await createOrder(user, { orderNumber: 'MINE-1' });
      await createOrder(user, { status: ORDER_STATUS.WAITING_FOR_CUSTOMER_APPROVAL });
      await createOrder(user, { status: ORDER_STATUS.DELIVERED });
      await createOrder(user, { status: ORDER_STATUS.CANCELLED });
      await createOrder(stranger, { orderNumber: 'NOT-MINE' });

      const { data } = await client.get('/api/customers/me/summary').then((response) => response.body);

      assert.equal(data.totalOrders, 4);
      assert.equal(data.activeOrders, 2);
      assert.equal(data.pendingApprovals, 1);
      assert.equal(data.completedDeliveries, 1);
      assert.equal(data.recentOrders.length, 4);
      assert.ok(!data.recentOrders.some((order) => order.orderNumber === 'NOT-MINE'));
    });

    it('a rider only ever counts their own deliveries and cash', async () => {
      const { client, user: rider } = await readyRider();
      const otherRider = await createUser(ROLES.RIDER);
      const customer = await createUser(ROLES.CUSTOMER);
      const shared = { customer: customer._id, assignedBy: admin._id };

      const deliver = async (who, status, isCurrent = true) => {
        const order = await createOrder(customer);
        const failureReason = status === DELIVERY_STATUS.DELIVERY_FAILED ? 'CUSTOMER_UNAVAILABLE' : undefined;
        await Delivery.create({ ...shared, order: order._id, rider: who._id, status, isCurrent, failureReason });
        return order;
      };

      await deliver(rider, DELIVERY_STATUS.RIDER_ASSIGNED);
      await deliver(rider, DELIVERY_STATUS.OUT_FOR_DELIVERY);
      await deliver(rider, DELIVERY_STATUS.REACHED_CUSTOMER);
      await deliver(rider, DELIVERY_STATUS.DELIVERY_FAILED, false);
      const delivered = await deliver(rider, DELIVERY_STATUS.DELIVERED, false);
      await deliver(rider, DELIVERY_STATUS.REASSIGNED, false);
      await deliver(otherRider, DELIVERY_STATUS.RIDER_ASSIGNED);

      const invoice = await Invoice.create({
        order: delivered._id,
        customer: customer._id,
        createdBy: admin._id,
        version: 1,
        lineItems: [{ description: 'Item', quantity: 1, unitPricePaise: 30000, lineTotalPaise: 30000 }],
        subtotalPaise: 30000,
        deliveryChargePaise: 3000,
        grandTotalPaise: 33000,
      });
      await Payment.create({
        order: delivered._id,
        customer: customer._id,
        invoice: invoice._id,
        amountPaise: 33000,
        method: PAYMENT_METHOD.CASH,
        status: PAYMENT_STATUS.CASH_COLLECTED,
        collectedBy: rider._id,
        collectedAmountPaise: 33000,
        collectedAt: new Date(),
        settlementStatus: 'PENDING',
      });

      const { data } = (await client.get('/api/riders/me/summary')).body;

      assert.deepEqual(data, {
        assignedDeliveries: 3,
        pendingDeliveries: 1,
        outForDelivery: 2,
        completedDeliveries: 1,
        failedDeliveries: 1,
        cashCollectedPaise: 33000,
        cashSettlementPendingPaise: 33000,
      });
    });

    it('"today" follows the date in India', () => {
      // 20:00 UTC on 1 Jan is already 01:30 on 2 Jan in India.
      assert.equal(
        startOfTodayInIndia(new Date('2026-01-01T20:00:00Z')).toISOString(),
        '2026-01-01T18:30:00.000Z',
      );
      // 10:00 UTC on 1 Jan is 15:30 on 1 Jan in India.
      assert.equal(
        startOfTodayInIndia(new Date('2026-01-01T10:00:00Z')).toISOString(),
        '2025-12-31T18:30:00.000Z',
      );
    });
  });

  describe('notifications', () => {
    it('shows each person only their own, and lets them mark them read', async () => {
      const { client, user } = await loginAs(baseUrl, ROLES.CUSTOMER);
      const { client: strangerClient, user: stranger } = await loginAs(baseUrl, ROLES.CUSTOMER);
      const notify = (recipient, title) =>
        Notification.create({ recipient: recipient._id, type: 'TEST', title, message: 'Hello' });

      const mine = await notify(user, 'For me');
      await notify(user, 'Also for me');
      const theirs = await notify(stranger, 'For a stranger');

      const list = await client.get('/api/notifications');
      assert.equal(list.body.data.length, 2);
      assert.equal(list.body.meta.unreadCount, 2);
      assert.ok(!list.body.data.some((item) => item.title === 'For a stranger'));

      assert.equal((await client.patch(`/api/notifications/${theirs.id}/read`)).status, 404);
      assert.equal((await strangerClient.get('/api/notifications')).body.meta.unreadCount, 1);

      assert.equal((await client.patch(`/api/notifications/${mine.id}/read`)).body.data.isRead, true);
      assert.equal((await client.get('/api/notifications')).body.meta.unreadCount, 1);

      await client.patch('/api/notifications/read-all');
      assert.equal((await client.get('/api/notifications')).body.meta.unreadCount, 0);
      assert.equal((await strangerClient.get('/api/notifications')).body.meta.unreadCount, 1);
    });
  });
});
