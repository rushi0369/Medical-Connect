import './helpers/testEnv.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import mongoose from 'mongoose';
import {
  DELIVERY_STATUS,
  INVOICE_STATUS,
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  ROLES,
} from '../src/config/constants.js';
import {
  AuditLog,
  Delivery,
  DeliveryEvent,
  DeliveryPricing,
  Invoice,
  Notification,
  Order,
  Payment,
  StoreSettings,
  User,
} from '../src/models/index.js';
import { nextSequence } from '../src/models/Counter.js';
import { connectTestDatabase, createUser, disconnectTestDatabase, sampleAddress } from './helpers/testServer.js';

const expectInvalid = (document, path) =>
  assert.rejects(document.validate(), (error) => {
    assert.equal(error.name, 'ValidationError');
    assert.ok(error.errors[path], `expected a validation error on "${path}", got: ${Object.keys(error.errors)}`);
    return true;
  });

let orderCounter = 0;

function orderFields(customer, overrides = {}) {
  orderCounter += 1;
  return {
    orderNumber: `TEST-${orderCounter}`,
    customer: customer._id,
    addressSnapshot: sampleAddress,
    requestedItems: [{ description: 'Paracetamol 500mg', quantity: 2 }],
    ...overrides,
  };
}

function invoiceFields(order, customer, admin, overrides = {}) {
  return {
    order: order._id,
    customer: customer._id,
    createdBy: admin._id,
    version: 1,
    lineItems: [
      { description: 'Medicine A', quantity: 2, unitPricePaise: 5000, lineTotalPaise: 10000 },
      { description: 'Medicine B', quantity: 1, unitPricePaise: 20000, lineTotalPaise: 20000 },
    ],
    subtotalPaise: 30000,
    deliveryChargePaise: 3000,
    grandTotalPaise: 33000,
    ...overrides,
  };
}

describe('database models', () => {
  let customer;
  let rider;
  let admin;

  before(async () => {
    await connectTestDatabase();
    customer = await createUser(ROLES.CUSTOMER);
    rider = await createUser(ROLES.RIDER);
    admin = await createUser(ROLES.ADMIN);
  });

  after(disconnectTestDatabase);

  it('has the 10 required collections and no catalogue or stock collection', () => {
    const names = mongoose.modelNames();

    for (const required of [
      'User',
      'Order',
      'Invoice',
      'Delivery',
      'DeliveryEvent',
      'Payment',
      'Notification',
      'StoreSettings',
      'DeliveryPricing',
      'AuditLog',
    ]) {
      assert.ok(names.includes(required), `${required} is missing`);
    }

    for (const name of names) {
      assert.doesNotMatch(name, /medicine|categor|inventory|stock/i);
    }
  });

  describe('User', () => {
    it('never returns the password hash unless asked for it', async () => {
      const found = await User.findById(customer._id);
      assert.equal(found.passwordHash, undefined);
      assert.equal(found.tokenVersion, undefined);
    });

    it('rejects an invalid role and bad phone format', async () => {
      await expectInvalid(new User({ fullName: 'A Person', phone: '12345', passwordHash: 'x', role: 'SUPERUSER' }), 'role');
      await expectInvalid(new User({ fullName: 'A Person', phone: '12345', passwordHash: 'x', role: ROLES.ADMIN }), 'phone');
    });

    it('does not allow a role to be changed later', async () => {
      const user = await User.findById(customer._id);
      user.role = ROLES.ADMIN;
      await user.save();
      const reloaded = await User.findById(customer._id);
      assert.equal(reloaded.role, ROLES.CUSTOMER);
    });

    it('rejects duplicate phone numbers and emails, but allows many users without email', async () => {
      await assert.rejects(createUser(ROLES.ADMIN, { phone: customer.phone }), { code: 11000 });
      await assert.rejects(createUser(ROLES.ADMIN, { email: customer.email }), { code: 11000 });

      await createUser(ROLES.ADMIN, { email: undefined });
      await createUser(ROLES.ADMIN, { email: undefined });
    });

    it('requires a rider profile on riders and refuses it on other roles', async () => {
      const base = { fullName: 'A Person', phone: '9000000000', passwordHash: 'x' };
      await expectInvalid(new User({ ...base, role: ROLES.RIDER }), 'riderProfile');
      await expectInvalid(new User({ ...base, role: ROLES.CUSTOMER, riderProfile: { riderId: 'X' } }), 'riderProfile');
    });
  });

  describe('Order', () => {
    it('starts as PENDING_ADMIN_REVIEW and keeps an address snapshot', async () => {
      const order = await Order.create(orderFields(customer));
      assert.equal(order.status, ORDER_STATUS.PENDING_ADMIN_REVIEW);
      assert.equal(order.addressSnapshot.city, 'Surat');
    });

    it('needs at least one photo or written medicine', async () => {
      await expectInvalid(new Order(orderFields(customer, { requestedItems: [] })), 'requestedItems');
    });

    it('allows a photo-only request', async () => {
      const requestPhotos = [{ url: 'https://example.com/a.jpg', storageKey: 'a.jpg' }];
      await Order.create(orderFields(customer, { requestedItems: [], requestPhotos }));
    });

    it('refuses a customer who is not a customer, and a rider who is not a rider', async () => {
      await expectInvalid(new Order(orderFields(rider)), 'customer');
      await expectInvalid(new Order(orderFields(customer, { currentRider: admin._id })), 'currentRider');
      await expectInvalid(new Order(orderFields(customer, { invoice: new mongoose.Types.ObjectId() })), 'invoice');
    });

    it('rejects a status outside the approved list and duplicate order numbers', async () => {
      await expectInvalid(new Order(orderFields(customer, { status: 'SHIPPED' })), 'status');

      const fields = orderFields(customer);
      await Order.create(fields);
      await assert.rejects(Order.create(fields), { code: 11000 });
    });
  });

  describe('Invoice', () => {
    it('checks the arithmetic on line items and totals', async () => {
      const order = await Order.create(orderFields(customer));

      await expectInvalid(new Invoice(invoiceFields(order, customer, admin, { subtotalPaise: 29999 })), 'subtotalPaise');
      await expectInvalid(new Invoice(invoiceFields(order, customer, admin, { grandTotalPaise: 1 })), 'grandTotalPaise');
      await expectInvalid(
        new Invoice(
          invoiceFields(order, customer, admin, {
            lineItems: [{ description: 'Wrong', quantity: 2, unitPricePaise: 100, lineTotalPaise: 999 }],
            subtotalPaise: 999,
            grandTotalPaise: 3999,
          }),
        ),
        'lineItems.0.lineTotalPaise',
      );

      const withDiscountAndTax = invoiceFields(order, customer, admin, {
        discountPaise: 1000,
        taxPaise: 500,
        grandTotalPaise: 32500,
      });
      await new Invoice(withDiscountAndTax).validate();
    });

    it('keeps every version, and only one invoice per order and version', async () => {
      const order = await Order.create(orderFields(customer));
      await Invoice.create(invoiceFields(order, customer, admin, { status: INVOICE_STATUS.REVISED }));
      await Invoice.create(invoiceFields(order, customer, admin, { version: 2 }));
      await assert.rejects(Invoice.create(invoiceFields(order, customer, admin)), { code: 11000 });
    });

    it('cannot be changed once approved, by save or by direct update', async () => {
      const order = await Order.create(orderFields(customer));
      const created = await Invoice.create(invoiceFields(order, customer, admin, { status: INVOICE_STATUS.APPROVED }));

      const invoice = await Invoice.findById(created._id);
      invoice.deliveryChargePaise = 0;
      invoice.grandTotalPaise = 30000;
      await assert.rejects(invoice.save(), /approved invoice cannot be changed/);

      await Invoice.updateOne({ _id: created._id }, { grandTotalPaise: 1 });
      const reloaded = await Invoice.findById(created._id);
      assert.equal(reloaded.grandTotalPaise, 33000);
    });

    it('can still be changed while it is a draft', async () => {
      const order = await Order.create(orderFields(customer));
      const created = await Invoice.create(invoiceFields(order, customer, admin));

      const invoice = await Invoice.findById(created._id);
      invoice.remarks = 'Checked by the store';
      await invoice.save();
    });
  });

  describe('Delivery', () => {
    it('allows only one current assignment, and keeps the old one as history', async () => {
      const order = await Order.create(orderFields(customer));
      const secondRider = await createUser(ROLES.RIDER);
      const fields = { order: order._id, customer: customer._id, assignedBy: admin._id };

      const first = await Delivery.create({ ...fields, rider: rider._id });
      await assert.rejects(Delivery.create({ ...fields, rider: secondRider._id }), { code: 11000 });

      first.isCurrent = false;
      first.status = DELIVERY_STATUS.REASSIGNED;
      await first.save();
      await Delivery.create({ ...fields, rider: secondRider._id });

      assert.equal(await Delivery.countDocuments({ order: order._id }), 2);
    });

    it('refuses a non-rider as rider, and a failed delivery with no reason', async () => {
      const order = await Order.create(orderFields(customer));
      const fields = { order: order._id, customer: customer._id, assignedBy: admin._id };

      await expectInvalid(new Delivery({ ...fields, rider: customer._id }), 'rider');
      await expectInvalid(
        new Delivery({ ...fields, rider: rider._id, status: DELIVERY_STATUS.DELIVERY_FAILED }),
        'failureReason',
      );
    });
  });

  describe('Payment', () => {
    it('keeps payment status independent of delivery, and needs proof for each status', async () => {
      const order = await Order.create(orderFields(customer));
      const invoice = await Invoice.create(invoiceFields(order, customer, admin));
      const fields = {
        order: order._id,
        customer: customer._id,
        invoice: invoice._id,
        amountPaise: 33000,
        method: PAYMENT_METHOD.UPI,
      };

      assert.equal((await Payment.create(fields)).status, PAYMENT_STATUS.UNPAID);
      await expectInvalid(new Payment({ ...fields, status: PAYMENT_STATUS.PAID }), 'paymentReference');
      await expectInvalid(
        new Payment({ ...fields, method: PAYMENT_METHOD.CASH, status: PAYMENT_STATUS.CASH_COLLECTED }),
        'collectedBy',
      );
      await expectInvalid(new Payment({ ...fields, status: PAYMENT_STATUS.SETTLED }), 'settledBy');
    });

    it('never counts the same gateway reference twice', async () => {
      const order = await Order.create(orderFields(customer));
      const invoice = await Invoice.create(invoiceFields(order, customer, admin));
      const fields = {
        order: order._id,
        customer: customer._id,
        invoice: invoice._id,
        amountPaise: 33000,
        method: PAYMENT_METHOD.UPI,
        status: PAYMENT_STATUS.PAID,
        paymentReference: 'GATEWAY-REF-1',
      };

      await Payment.create(fields);
      await assert.rejects(Payment.create(fields), { code: 11000 });
    });
  });

  describe('permanent history', () => {
    it('audit logs can be added but never changed or deleted', async () => {
      const entry = await AuditLog.create({ action: 'LOGIN_FAILED' });

      await assert.rejects(AuditLog.updateOne({ _id: entry._id }, { action: 'LOGOUT' }), /permanent history/);
      await assert.rejects(AuditLog.deleteOne({ _id: entry._id }), /permanent history/);
      await assert.rejects(AuditLog.findOneAndDelete({ _id: entry._id }), /permanent history/);
      await assert.rejects(entry.deleteOne(), /permanent history/);

      entry.action = 'LOGOUT';
      await assert.rejects(entry.save(), /permanent history/);
    });

    it('delivery events can be added but never changed', async () => {
      const order = await Order.create(orderFields(customer));
      const delivery = await Delivery.create({
        order: order._id,
        customer: customer._id,
        rider: rider._id,
        assignedBy: admin._id,
      });

      const event = await DeliveryEvent.create({
        delivery: delivery._id,
        order: order._id,
        customer: customer._id,
        rider: rider._id,
        status: DELIVERY_STATUS.RIDER_ASSIGNED,
        actor: admin._id,
        actorRole: ROLES.ADMIN,
      });

      await assert.rejects(DeliveryEvent.updateOne({ _id: event._id }, { note: 'changed' }), /permanent history/);
    });
  });

  describe('settings', () => {
    it('allows only one store settings record and one price list', async () => {
      await StoreSettings.create({});
      await assert.rejects(StoreSettings.create({}), { code: 11000 });

      await DeliveryPricing.create({});
      await assert.rejects(DeliveryPricing.create({}), { code: 11000 });
    });

    it('accepts your example price tiers, and rejects gaps and overlaps', async () => {
      const tiers = [
        { minKm: 0, maxKm: 2, chargePaise: 2000 },
        { minKm: 2, maxKm: 5, chargePaise: 3000 },
        { minKm: 5, maxKm: 8, chargePaise: 4000 },
        { minKm: 8, maxKm: 12, chargePaise: 6000 },
        { minKm: 12 },
      ];
      await new DeliveryPricing({ tiers }).validate();

      await expectInvalid(new DeliveryPricing({ tiers: [{ minKm: 1, maxKm: 2, chargePaise: 1 }] }), 'tiers');
      await expectInvalid(
        new DeliveryPricing({
          tiers: [
            { minKm: 0, maxKm: 2, chargePaise: 1 },
            { minKm: 3, maxKm: 5, chargePaise: 1 },
          ],
        }),
        'tiers',
      );
    });
  });

  it('notifications must have a real recipient', async () => {
    await expectInvalid(
      new Notification({ recipient: new mongoose.Types.ObjectId(), type: 'TEST', title: 'T', message: 'M' }),
      'recipient',
    );
  });

  it('running numbers stay unique when requested at the same moment', async () => {
    const numbers = await Promise.all(Array.from({ length: 10 }, () => nextSequence('concurrency-check')));
    assert.equal(new Set(numbers).size, 10);
  });
});
