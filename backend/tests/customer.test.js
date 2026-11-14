import './helpers/testEnv.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { AUDIT_ACTION, ORDER_STATUS, ROLES } from '../src/config/constants.js';
import { AuditLog, Order, User } from '../src/models/index.js';
import {
  createClient,
  createUser,
  loginAs,
  sampleAddress,
  startTestServer,
} from './helpers/testServer.js';

describe('Phase 3: Customer requests & profile', () => {
  let server;
  let baseUrl;
  let customerClient;
  let customer;

  before(async () => {
    server = await startTestServer();
    baseUrl = server.baseUrl;
    ({ client: customerClient, user: customer } = await loginAs(baseUrl, ROLES.CUSTOMER));
  });

  after(() => server.stop());

  describe('Address management', () => {
    it('customer can list and add addresses', async () => {
      const initial = await customerClient.get('/api/customers/me/addresses');
      assert.equal(initial.status, 200);
      const initialCount = initial.body.data.addresses.length;

      const newAddress = {
        label: 'Office',
        fullAddress: 'Suite 300, Corporate Park, MG Road',
        area: 'Fort',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        deliveryInstructions: 'Leave with reception',
      };

      const added = await customerClient.post('/api/customers/me/addresses', newAddress);
      assert.equal(added.status, 201);
      assert.equal(added.body.data.addresses.length, initialCount + 1);

      const saved = added.body.data.addresses.find((a) => a.label === 'Office');
      assert.ok(saved);
      assert.equal(saved.area, 'Fort');
      assert.equal(saved.deliveryInstructions, 'Leave with reception');
    });

    it('customer can edit an address and set it as default', async () => {
      const list = await customerClient.get('/api/customers/me/addresses');
      const address = list.body.data.addresses[0];

      const updated = await customerClient.patch(`/api/customers/me/addresses/${address.id}`, {
        fullAddress: 'Updated Flat 202, Sunshine Heights',
        area: 'Bandra West',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400050',
      });
      assert.equal(updated.status, 200);

      const makeDefault = await customerClient.post(`/api/customers/me/addresses/${address.id}/default`);
      assert.equal(makeDefault.status, 200);
      const defaultAddr = makeDefault.body.data.addresses.find((a) => a.id === address.id);
      assert.equal(defaultAddr.isDefault, true);
    });

    it('customer cannot delete their only address', async () => {
      // Find a fresh customer with 1 address
      const { client: freshClient, user: freshCustomer } = await loginAs(baseUrl, ROLES.CUSTOMER);
      assert.equal(freshCustomer.addresses.length, 1);

      const response = await freshClient.delete(`/api/customers/me/addresses/${freshCustomer.addresses[0]._id}`);
      assert.equal(response.status, 409);
    });
  });

  describe('Profile updates', () => {
    it('customer can update their name and email', async () => {
      const response = await customerClient.patch('/api/customers/me/profile', {
        fullName: 'Updated Customer Name',
        email: 'updated.customer@test.local',
      });

      assert.equal(response.status, 200);
      assert.equal(response.body.data.user.fullName, 'Updated Customer Name');
      assert.equal(response.body.data.user.email, 'updated.customer@test.local');
    });
  });

  describe('Orders / Medicine Requests', () => {
    let createdOrderId;

    it('customer can submit a medicine request with written items', async () => {
      const list = await customerClient.get('/api/customers/me/addresses');
      const address = list.body.data.addresses[0];

      const payload = {
        addressId: address.id,
        customerInstructions: 'Please deliver between 5 PM and 7 PM.',
        requestedItems: [
          { description: 'Paracetamol 650mg', quantity: 2 },
          { description: 'Vitamin C 500mg', quantity: 1 },
        ],
      };

      const response = await customerClient.post('/api/customers/me/orders', payload);
      assert.equal(response.status, 201);
      assert.ok(response.body.data.orderId);
      assert.ok(response.body.data.orderNumber.startsWith('CK-'));
      assert.equal(response.body.data.status, ORDER_STATUS.PENDING_ADMIN_REVIEW);

      createdOrderId = response.body.data.orderId;
    });

    it('customer can submit a medicine request with photo upload', async () => {
      const list = await customerClient.get('/api/customers/me/addresses');
      const address = list.body.data.addresses[0];

      const form = new FormData();
      form.append('addressId', address.id);
      form.append('customerInstructions', 'Photo prescription attached');
      const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
      form.append('photos', new Blob([fakeJpeg], { type: 'image/jpeg' }), 'rx.jpg');

      const response = await customerClient.post('/api/customers/me/orders', form);
      assert.equal(response.status, 201);

      const detail = await customerClient.get(`/api/customers/me/orders/${response.body.data.orderId}`);
      assert.equal(detail.status, 200);
      assert.equal(detail.body.data.order.photos.length, 1);
      assert.equal(detail.body.data.order.photos[0].name, 'rx.jpg');

      const photoId = detail.body.data.order.photos[0].id;
      const fetchImage = await fetch(`${baseUrl}/uploads/${photoId}`);
      assert.equal(fetchImage.status, 200);
      assert.equal(fetchImage.headers.get('content-type'), 'image/jpeg');
    });

    it('customer can view their order list and order details', async () => {
      const listResponse = await customerClient.get('/api/customers/me/orders');
      assert.equal(listResponse.status, 200);
      assert.ok(listResponse.body.data.length >= 1);
      assert.ok(listResponse.body.data.some((o) => o.id === createdOrderId));

      const detailResponse = await customerClient.get(`/api/customers/me/orders/${createdOrderId}`);
      assert.equal(detailResponse.status, 200);
      const { order } = detailResponse.body.data;
      assert.equal(order.id, createdOrderId);
      assert.equal(order.requestedItems.length, 2);
      assert.equal(order.customerInstructions, 'Please deliver between 5 PM and 7 PM.');
      assert.ok(order.statusHistory.length >= 1);
      assert.equal(order.allowedActions.canCancel, true);
    });

    it('customer can cancel an order in pending review status', async () => {
      const response = await customerClient.post(`/api/customers/me/orders/${createdOrderId}/cancel`, {
        reason: 'Ordered by mistake',
      });

      assert.equal(response.status, 200);
      assert.equal(response.body.data.status, ORDER_STATUS.CANCELLED);

      const detail = await customerClient.get(`/api/customers/me/orders/${createdOrderId}`);
      assert.equal(detail.body.data.order.status, ORDER_STATUS.CANCELLED);
      assert.equal(detail.body.data.order.allowedActions.canCancel, false);
    });
  });

  describe('Admin customer management (Edit & Delete)', () => {
    let adminClient;
    let freshCustomer;

    before(async () => {
      ({ client: adminClient } = await loginAs(baseUrl, ROLES.ADMIN));
      freshCustomer = await createUser(ROLES.CUSTOMER, {
        phone: '9988776655',
        fullName: 'Test Customer For Deletion',
        email: 'deletion.test@example.com',
      });
    });

    it('admin can update customer details', async () => {
      const response = await adminClient.patch(`/api/admin/customers/${freshCustomer._id}`, {
        fullName: 'Updated Name By Admin',
        phone: '9988776654',
        email: 'updated.byadmin@example.com',
        isActive: true,
      });

      assert.equal(response.status, 200);
      assert.equal(response.body.data.customer.fullName, 'Updated Name By Admin');
      assert.equal(response.body.data.customer.phone, '9988776654');
      assert.equal(response.body.data.customer.email, 'updated.byadmin@example.com');
    });

    it('admin can permanently delete customer', async () => {
      const response = await adminClient.delete(`/api/admin/customers/${freshCustomer._id}`);
      assert.equal(response.status, 200);
      assert.equal(response.body.data.deleted, true);

      // Verify customer is gone from DB
      const checkUser = await User.findById(freshCustomer._id);
      assert.equal(checkUser, null);
    });
  });
});
