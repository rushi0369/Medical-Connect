import { ROLES, ORDER_STATUS, INVOICE_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, DELIVERY_STATUS } from '../src/config/constants.js';
import { disconnectDatabase, openDatabaseConnection } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Order } from '../src/models/Order.js';
import { Invoice } from '../src/models/Invoice.js';
import { Delivery } from '../src/models/Delivery.js';
import { Payment } from '../src/models/Payment.js';
import { Counter, nextSequence } from '../src/models/Counter.js';
import { hashPassword } from '../src/services/auth.service.js';
import { indiaDateStamp } from '../src/utils/time.js';

const DEMO_CUSTOMERS = [
  {
    fullName: 'Priya Sharma',
    phone: '9800000001',
    email: 'priya.sharma@demo.medicare.com',
    address: {
      label: 'Home',
      fullAddress: 'Flat 203, Gokul Dham Residency, Station Road',
      area: 'Kim Char Rasta',
      city: 'Kim, Surat',
      state: 'Gujarat',
      pincode: '394110',
      location: { lat: 21.4050, lng: 72.9290 },
      deliveryInstructions: 'Ring the doorbell twice. Please leave at security if unavailable.',
      isDefault: true,
    },
  },
  {
    fullName: 'Rajesh Verma',
    phone: '9800000002',
    email: 'rajesh.verma@demo.medicare.com',
    address: {
      label: 'Home',
      fullAddress: 'B-14, Shreenathji Society, Mandvi Road',
      area: 'Mandvi Road',
      city: 'Kim, Surat',
      state: 'Gujarat',
      pincode: '394110',
      location: { lat: 21.4020, lng: 72.9250 },
      deliveryInstructions: 'Near the community hall, ground floor.',
      isDefault: true,
    },
  },
  {
    fullName: 'Anjali Mehta',
    phone: '9800000003',
    email: 'anjali.mehta@demo.medicare.com',
    address: {
      label: 'Home',
      fullAddress: 'House 45, Sardar Patel Nagar, Near GIDC Phase 1',
      area: 'GIDC Area',
      city: 'Kim, Surat',
      state: 'Gujarat',
      pincode: '394110',
      location: { lat: 21.4060, lng: 72.9240 },
      deliveryInstructions: 'Call upon arrival.',
      isDefault: true,
    },
  },
  {
    fullName: 'Vikram Patel',
    phone: '9800000004',
    email: 'vikram.patel@demo.medicare.com',
    address: {
      label: 'Shop / Work',
      fullAddress: '12, Radhe Krishna Arcade, Main Bazaar',
      area: 'Main Bazaar',
      city: 'Kim, Surat',
      state: 'Gujarat',
      pincode: '394110',
      location: { lat: 21.4010, lng: 72.9300 },
      deliveryInstructions: 'Deliver to front counter.',
      isDefault: true,
    },
  },
  {
    fullName: 'Neha Desai',
    phone: '9800000005',
    email: 'neha.desai@demo.medicare.com',
    address: {
      label: 'Home',
      fullAddress: 'A-302, Royal Enclave, Char Rasta',
      area: 'Kim Char Rasta',
      city: 'Kim, Surat',
      state: 'Gujarat',
      pincode: '394110',
      location: { lat: 21.4040, lng: 72.9260 },
      deliveryInstructions: '3rd floor, elevator available.',
      isDefault: true,
    },
  },
];

const DEMO_RIDERS = [
  {
    fullName: 'Suresh Kumar',
    phone: '9800000011',
    email: 'suresh.rider@demo.medicare.com',
    riderId: 'RDR-0002',
    vehicleNumber: 'GJ-05-SK-1001',
    notes: 'Morning & Afternoon Shift - Honda Activa 6G',
  },
  {
    fullName: 'Deepak Solanki',
    phone: '9800000012',
    email: 'deepak.rider@demo.medicare.com',
    riderId: 'RDR-0003',
    vehicleNumber: 'GJ-05-DS-2002',
    notes: 'Evening & Night Shift - Hero Splendor Plus',
  },
];

async function seedDemoData() {
  await openDatabaseConnection();
  console.log('Connected to MongoDB Atlas. Starting demo data generation...');

  // 1. Ensure Admin exists
  let admin = await User.findOne({ role: ROLES.ADMIN });
  if (!admin) {
    const adminPasswordHash = await hashPassword('Admin@123');
    admin = await User.create({
      fullName: 'MediCare Admin',
      phone: '9876543210',
      email: 'admin@medicare.com',
      passwordHash: adminPasswordHash,
      role: ROLES.ADMIN,
      isActive: true,
      mustChangePassword: false,
    });
    console.log('Created Admin account');
  } else {
    console.log(`Using existing Admin: ${admin.fullName} (${admin.phone})`);
  }

  const customerPasswordHash = await hashPassword('Customer@123');
  const riderPasswordHash = await hashPassword('Rider@123');

  // 2. Seed 5 Customers
  const customerDocs = [];
  for (const c of DEMO_CUSTOMERS) {
    let customer = await User.findOne({ phone: c.phone });
    if (customer) {
      customer.fullName = c.fullName;
      customer.email = c.email;
      customer.passwordHash = customerPasswordHash;
      customer.isActive = true;
      customer.mustChangePassword = false;
      customer.addresses = [c.address];
      await customer.save();
      console.log(`Updated Customer: ${c.fullName} (${c.phone})`);
    } else {
      // Remove any conflict on email
      if (c.email) {
        await User.deleteMany({ email: c.email });
      }
      customer = await User.create({
        fullName: c.fullName,
        phone: c.phone,
        email: c.email,
        passwordHash: customerPasswordHash,
        role: ROLES.CUSTOMER,
        isActive: true,
        mustChangePassword: false,
        addresses: [c.address],
      });
      console.log(`Created Customer: ${c.fullName} (${c.phone})`);
    }
    customerDocs.push(customer);
  }

  // 3. Seed 2 Riders
  const riderDocs = [];
  for (const r of DEMO_RIDERS) {
    let rider = await User.findOne({ phone: r.phone });
    if (rider) {
      rider.fullName = r.fullName;
      rider.email = r.email;
      rider.passwordHash = riderPasswordHash;
      rider.isActive = true;
      rider.mustChangePassword = false;
      rider.riderProfile = {
        riderId: r.riderId,
        vehicleNumber: r.vehicleNumber,
        notes: r.notes,
      };
      await rider.save();
      console.log(`Updated Rider: ${r.fullName} (${r.phone} - ${r.riderId})`);
    } else {
      if (r.email) {
        await User.deleteMany({ email: r.email });
      }
      await User.deleteMany({ 'riderProfile.riderId': r.riderId });
      rider = await User.create({
        fullName: r.fullName,
        phone: r.phone,
        email: r.email,
        passwordHash: riderPasswordHash,
        role: ROLES.RIDER,
        isActive: true,
        mustChangePassword: false,
        createdBy: admin._id,
        riderProfile: {
          riderId: r.riderId,
          vehicleNumber: r.vehicleNumber,
          notes: r.notes,
        },
      });
      console.log(`Created Rider: ${r.fullName} (${r.phone} - ${r.riderId})`);
    }
    riderDocs.push(rider);
  }

  // Update rider counter
  await Counter.findByIdAndUpdate('rider', { $max: { seq: 3 } }, { upsert: true });

  // 4. Seed Demo Orders across various lifecycle statuses
  console.log('\nSeeding realistic demo medical orders and requests...');
  const customerIds = customerDocs.map((c) => c._id);

  // Clean old orders for these test customers to prevent accumulation on rerun
  const oldOrders = await Order.find({ customer: { $in: customerIds } });
  const oldOrderIds = oldOrders.map((o) => o._id);
  if (oldOrderIds.length > 0) {
    await Invoice.deleteMany({ order: { $in: oldOrderIds } });
    await Delivery.deleteMany({ order: { $in: oldOrderIds } });
    await Payment.deleteMany({ order: { $in: oldOrderIds } });
    await Order.deleteMany({ _id: { $in: oldOrderIds } });
    console.log(`Cleaned up ${oldOrderIds.length} previous demo orders.`);
  }

  const day = indiaDateStamp();

  async function createOrderNumber() {
    const seq = await nextSequence(`order-${day}`);
    return `CK-${day}-${String(seq).padStart(4, '0')}`;
  }

  const seededOrdersSummary = [];

  // --- Order 1: PENDING_ADMIN_REVIEW (New Medicine Request from Priya Sharma) ---
  {
    const cust = customerDocs[0];
    const orderNum = await createOrderNumber();
    const order = await Order.create({
      orderNumber: orderNum,
      customer: cust._id,
      addressSnapshot: cust.addresses[0],
      requestedItems: [
        { description: 'Paracetamol 650mg (Dolo 650)', quantity: 2, notes: 'Need fast relief for fever' },
        { description: 'Cheston Cold Tablet', quantity: 1, notes: '1 strip' },
        { description: 'Vitamin C 500mg Chewable (Limcee)', quantity: 1, notes: 'Orange flavour preferred' },
      ],
      customerInstructions: 'Please deliver after 6 PM if possible. Thank you!',
      status: ORDER_STATUS.PENDING_ADMIN_REVIEW,
      statusHistory: [
        { status: ORDER_STATUS.PENDING_ADMIN_REVIEW, actor: cust._id, actorRole: ROLES.CUSTOMER, note: 'Order placed by customer' },
      ],
    });
    seededOrdersSummary.push({ orderNumber: orderNum, customer: cust.fullName, status: 'PENDING_ADMIN_REVIEW', items: 'Dolo 650, Cheston Cold, Limcee' });
  }

  // --- Order 2: WAITING_FOR_CUSTOMER_APPROVAL (Admin created bill, awaiting Rajesh Verma's OK) ---
  {
    const cust = customerDocs[1];
    const orderNum = await createOrderNumber();
    const lineItems = [
      { description: 'Azithromycin 500mg (Azee 500)', quantity: 1, unitPricePaise: 11800, lineTotalPaise: 11800 },
      { description: 'Pantoprazole 40mg (Pan 40)', quantity: 1, unitPricePaise: 9500, lineTotalPaise: 9500 },
      { description: 'Electral ORS Powder 21.8g Sachet', quantity: 3, unitPricePaise: 2200, lineTotalPaise: 6600 },
    ];
    const subtotal = 27900;
    const deliveryCharge = 2500;
    const grandTotal = subtotal + deliveryCharge;

    const order = await Order.create({
      orderNumber: orderNum,
      customer: cust._id,
      addressSnapshot: cust.addresses[0],
      requestedItems: [
        { description: 'Azee 500mg - 1 strip', quantity: 1 },
        { description: 'Pan 40 - 1 strip', quantity: 1 },
        { description: 'Electral powder - 3 sachets', quantity: 3 },
      ],
      lineItems,
      adminRemarks: 'Brand substitutes checked and verified by pharmacist.',
      status: ORDER_STATUS.WAITING_FOR_CUSTOMER_APPROVAL,
      statusHistory: [
        { status: ORDER_STATUS.PENDING_ADMIN_REVIEW, actor: cust._id, actorRole: ROLES.CUSTOMER, note: 'Order placed' },
        { status: ORDER_STATUS.UNDER_REVIEW, actor: admin._id, actorRole: ROLES.ADMIN, note: 'Admin verified inventory' },
        { status: ORDER_STATUS.WAITING_FOR_CUSTOMER_APPROVAL, actor: admin._id, actorRole: ROLES.ADMIN, note: 'Bill generated and sent to customer' },
      ],
    });

    const invoice = await Invoice.create({
      order: order._id,
      customer: cust._id,
      version: 1,
      status: INVOICE_STATUS.SENT,
      lineItems,
      subtotalPaise: subtotal,
      discountPaise: 0,
      taxPaise: 0,
      deliveryChargePaise: deliveryCharge,
      grandTotalPaise: grandTotal,
      deliveryDistanceKm: 2.1,
      deliveryDurationMinutes: 8,
      createdBy: admin._id,
      sentAt: new Date(Date.now() - 15 * 60 * 1000),
    });

    order.invoice = invoice._id;
    order.invoiceVersion = 1;
    await order.save();
    seededOrdersSummary.push({ orderNumber: orderNum, customer: cust.fullName, status: 'WAITING_FOR_CUSTOMER_APPROVAL', total: '₹304.00' });
  }

  // --- Order 3: CONFIRMED (Customer Anjali Mehta approved bill, ready for dispatch) ---
  {
    const cust = customerDocs[2];
    const orderNum = await createOrderNumber();
    const lineItems = [
      { description: 'Glycomet 500mg SR Tablet', quantity: 2, unitPricePaise: 4800, lineTotalPaise: 9600 },
      { description: 'Telma 40mg Tablet', quantity: 2, unitPricePaise: 14200, lineTotalPaise: 28400 },
    ];
    const subtotal = 38000;
    const deliveryCharge = 2000;
    const grandTotal = subtotal + deliveryCharge;

    const order = await Order.create({
      orderNumber: orderNum,
      customer: cust._id,
      addressSnapshot: cust.addresses[0],
      requestedItems: [
        { description: 'Glycomet 500mg - 2 strips', quantity: 2 },
        { description: 'Telma 40mg - 2 strips', quantity: 2 },
      ],
      lineItems,
      status: ORDER_STATUS.CONFIRMED,
      statusHistory: [
        { status: ORDER_STATUS.PENDING_ADMIN_REVIEW, actor: cust._id, actorRole: ROLES.CUSTOMER, note: 'Order placed' },
        { status: ORDER_STATUS.WAITING_FOR_CUSTOMER_APPROVAL, actor: admin._id, actorRole: ROLES.ADMIN, note: 'Invoice sent' },
        { status: ORDER_STATUS.CONFIRMED, actor: cust._id, actorRole: ROLES.CUSTOMER, note: 'Customer approved bill' },
      ],
    });

    const invoice = await Invoice.create({
      order: order._id,
      customer: cust._id,
      version: 1,
      status: INVOICE_STATUS.APPROVED,
      lineItems,
      subtotalPaise: subtotal,
      discountPaise: 0,
      taxPaise: 0,
      deliveryChargePaise: deliveryCharge,
      grandTotalPaise: grandTotal,
      deliveryDistanceKm: 1.8,
      deliveryDurationMinutes: 6,
      createdBy: admin._id,
      sentAt: new Date(Date.now() - 40 * 60 * 1000),
      approvedAt: new Date(Date.now() - 25 * 60 * 1000),
    });

    order.invoice = invoice._id;
    order.invoiceVersion = 1;
    await order.save();
    seededOrdersSummary.push({ orderNumber: orderNum, customer: cust.fullName, status: 'CONFIRMED', total: '₹400.00' });
  }

  // --- Order 4: RIDER_ASSIGNED (Assigned to Suresh Kumar for Vikram Patel) ---
  {
    const cust = customerDocs[3];
    const rider = riderDocs[0];
    const orderNum = await createOrderNumber();
    const lineItems = [
      { description: 'Volini Pain Relief Gel 30g', quantity: 1, unitPricePaise: 13500, lineTotalPaise: 13500 },
      { description: 'Band-Aid Washproof Strips 20s', quantity: 1, unitPricePaise: 6000, lineTotalPaise: 6000 },
      { description: 'Betadine 5% Antiseptic Ointment 20g', quantity: 1, unitPricePaise: 11000, lineTotalPaise: 11000 },
    ];
    const subtotal = 30500;
    const deliveryCharge = 2500;
    const grandTotal = subtotal + deliveryCharge;

    const order = await Order.create({
      orderNumber: orderNum,
      customer: cust._id,
      addressSnapshot: cust.addresses[0],
      requestedItems: [
        { description: 'Volini Gel 30g', quantity: 1 },
        { description: 'Band-Aid packet (20 pieces)', quantity: 1 },
        { description: 'Betadine Ointment 20g', quantity: 1 },
      ],
      lineItems,
      status: ORDER_STATUS.RIDER_ASSIGNED,
      currentRider: rider._id,
      statusHistory: [
        { status: ORDER_STATUS.PENDING_ADMIN_REVIEW, actor: cust._id, actorRole: ROLES.CUSTOMER, note: 'Order placed' },
        { status: ORDER_STATUS.CONFIRMED, actor: cust._id, actorRole: ROLES.CUSTOMER, note: 'Bill approved' },
        { status: ORDER_STATUS.RIDER_ASSIGNED, actor: admin._id, actorRole: ROLES.ADMIN, note: `Assigned to rider ${rider.fullName}` },
      ],
    });

    const invoice = await Invoice.create({
      order: order._id,
      customer: cust._id,
      version: 1,
      status: INVOICE_STATUS.APPROVED,
      lineItems,
      subtotalPaise: subtotal,
      discountPaise: 0,
      taxPaise: 0,
      deliveryChargePaise: deliveryCharge,
      grandTotalPaise: grandTotal,
      deliveryDistanceKm: 2.5,
      deliveryDurationMinutes: 10,
      createdBy: admin._id,
      sentAt: new Date(Date.now() - 50 * 60 * 1000),
      approvedAt: new Date(Date.now() - 35 * 60 * 1000),
    });

    const delivery = await Delivery.create({
      order: order._id,
      customer: cust._id,
      rider: rider._id,
      assignedBy: admin._id,
      status: DELIVERY_STATUS.RIDER_ASSIGNED,
      isCurrent: true,
      assignedAt: new Date(Date.now() - 20 * 60 * 1000),
    });

    order.invoice = invoice._id;
    order.invoiceVersion = 1;
    order.delivery = delivery._id;
    await order.save();
    seededOrdersSummary.push({ orderNumber: orderNum, customer: cust.fullName, status: 'RIDER_ASSIGNED', rider: rider.fullName, total: '₹330.00' });
  }

  // --- Order 5: OUT_FOR_DELIVERY (Deepak Solanki on the way to Neha Desai) ---
  {
    const cust = customerDocs[4];
    const rider = riderDocs[1];
    const orderNum = await createOrderNumber();
    const lineItems = [
      { description: 'Becosules Z Multivitamin Capsules (20s)', quantity: 1, unitPricePaise: 5200, lineTotalPaise: 5200 },
      { description: 'Vicks Vaporub 25ml Relief Balm', quantity: 1, unitPricePaise: 9500, lineTotalPaise: 9500 },
      { description: 'Strepsils Honey & Lemon Lozenges (8s)', quantity: 2, unitPricePaise: 3500, lineTotalPaise: 7000 },
    ];
    const subtotal = 21700;
    const deliveryCharge = 2000;
    const grandTotal = subtotal + deliveryCharge;

    const order = await Order.create({
      orderNumber: orderNum,
      customer: cust._id,
      addressSnapshot: cust.addresses[0],
      requestedItems: [
        { description: 'Becosules Z capsules - 1 strip', quantity: 1 },
        { description: 'Vicks 25ml balm', quantity: 1 },
        { description: 'Strepsils lemon - 2 packets', quantity: 2 },
      ],
      lineItems,
      status: ORDER_STATUS.OUT_FOR_DELIVERY,
      currentRider: rider._id,
      statusHistory: [
        { status: ORDER_STATUS.PENDING_ADMIN_REVIEW, actor: cust._id, actorRole: ROLES.CUSTOMER, note: 'Order placed' },
        { status: ORDER_STATUS.CONFIRMED, actor: cust._id, actorRole: ROLES.CUSTOMER, note: 'Bill approved' },
        { status: ORDER_STATUS.RIDER_ASSIGNED, actor: admin._id, actorRole: ROLES.ADMIN, note: `Assigned to rider ${rider.fullName}` },
        { status: ORDER_STATUS.OUT_FOR_DELIVERY, actor: rider._id, actorRole: ROLES.RIDER, note: 'Rider picked up parcel and started delivery' },
      ],
    });

    const invoice = await Invoice.create({
      order: order._id,
      customer: cust._id,
      version: 1,
      status: INVOICE_STATUS.APPROVED,
      lineItems,
      subtotalPaise: subtotal,
      discountPaise: 0,
      taxPaise: 0,
      deliveryChargePaise: deliveryCharge,
      grandTotalPaise: grandTotal,
      deliveryDistanceKm: 1.5,
      deliveryDurationMinutes: 5,
      createdBy: admin._id,
      sentAt: new Date(Date.now() - 60 * 60 * 1000),
      approvedAt: new Date(Date.now() - 45 * 60 * 1000),
    });

    const delivery = await Delivery.create({
      order: order._id,
      customer: cust._id,
      rider: rider._id,
      assignedBy: admin._id,
      status: DELIVERY_STATUS.OUT_FOR_DELIVERY,
      isCurrent: true,
      assignedAt: new Date(Date.now() - 30 * 60 * 1000),
      outForDeliveryAt: new Date(Date.now() - 10 * 60 * 1000),
    });

    order.invoice = invoice._id;
    order.invoiceVersion = 1;
    order.delivery = delivery._id;
    await order.save();
    seededOrdersSummary.push({ orderNumber: orderNum, customer: cust.fullName, status: 'OUT_FOR_DELIVERY', rider: rider.fullName, total: '₹237.00' });
  }

  // --- Order 6: DELIVERED (Completed and paid with Cash) ---
  {
    const cust = customerDocs[0];
    const rider = riderDocs[0];
    const orderNum = await createOrderNumber();
    const lineItems = [
      { description: 'Crocin 650 Advance Fast Action (15s)', quantity: 1, unitPricePaise: 3200, lineTotalPaise: 3200 },
      { description: 'Digene Antacid Gel Mint 200ml', quantity: 1, unitPricePaise: 16500, lineTotalPaise: 16500 },
    ];
    const subtotal = 19700;
    const deliveryCharge = 2000;
    const grandTotal = subtotal + deliveryCharge;

    const order = await Order.create({
      orderNumber: orderNum,
      customer: cust._id,
      addressSnapshot: cust.addresses[0],
      requestedItems: [
        { description: 'Crocin 650 - 1 strip', quantity: 1 },
        { description: 'Digene mint liquid syrup - 1 bottle', quantity: 1 },
      ],
      lineItems,
      status: ORDER_STATUS.DELIVERED,
      currentRider: rider._id,
      statusHistory: [
        { status: ORDER_STATUS.PENDING_ADMIN_REVIEW, actor: cust._id, actorRole: ROLES.CUSTOMER, note: 'Order placed' },
        { status: ORDER_STATUS.CONFIRMED, actor: cust._id, actorRole: ROLES.CUSTOMER, note: 'Bill approved' },
        { status: ORDER_STATUS.RIDER_ASSIGNED, actor: admin._id, actorRole: ROLES.ADMIN, note: `Assigned to ${rider.fullName}` },
        { status: ORDER_STATUS.OUT_FOR_DELIVERY, actor: rider._id, actorRole: ROLES.RIDER, note: 'Out for delivery' },
        { status: ORDER_STATUS.DELIVERED, actor: rider._id, actorRole: ROLES.RIDER, note: 'Handed to customer and cash collected' },
      ],
    });

    const invoice = await Invoice.create({
      order: order._id,
      customer: cust._id,
      version: 1,
      status: INVOICE_STATUS.APPROVED,
      lineItems,
      subtotalPaise: subtotal,
      discountPaise: 0,
      taxPaise: 0,
      deliveryChargePaise: deliveryCharge,
      grandTotalPaise: grandTotal,
      deliveryDistanceKm: 2.0,
      deliveryDurationMinutes: 7,
      createdBy: admin._id,
      sentAt: new Date(Date.now() - 3 * 3600 * 1000),
      approvedAt: new Date(Date.now() - 2.5 * 3600 * 1000),
    });

    const delivery = await Delivery.create({
      order: order._id,
      customer: cust._id,
      rider: rider._id,
      assignedBy: admin._id,
      status: DELIVERY_STATUS.DELIVERED,
      isCurrent: true,
      assignedAt: new Date(Date.now() - 2.5 * 3600 * 1000),
      outForDeliveryAt: new Date(Date.now() - 2 * 3600 * 1000),
      deliveredAt: new Date(Date.now() - 1.5 * 3600 * 1000),
    });

    const payment = await Payment.create({
      order: order._id,
      customer: cust._id,
      invoice: invoice._id,
      amountPaise: grandTotal,
      method: PAYMENT_METHOD.CASH,
      status: PAYMENT_STATUS.CASH_COLLECTED,
      paymentReference: `CASH-${orderNum}`,
      paidAt: new Date(Date.now() - 1.5 * 3600 * 1000),
      collectedBy: rider._id,
      collectedAmountPaise: grandTotal,
      collectedAt: new Date(Date.now() - 1.5 * 3600 * 1000),
    });

    order.invoice = invoice._id;
    order.invoiceVersion = 1;
    order.delivery = delivery._id;
    order.payment = payment._id;
    await order.save();
    seededOrdersSummary.push({ orderNumber: orderNum, customer: cust.fullName, status: 'DELIVERED', rider: rider.fullName, total: '₹217.00 (Cash)' });
  }

  console.log('\n=============================================');
  console.log('🎉 DEMO DATA SEEDED SUCCESSFULLY TO MONGODB!');
  console.log('=============================================');
  console.log('\n5 CUSTOMERS (Password: Customer@123):');
  DEMO_CUSTOMERS.forEach((c) => console.log(`  - ${c.fullName.padEnd(16)} | Phone: ${c.phone} | ${c.address.area}`));
  console.log('\n2 RIDERS (Password: Rider@123):');
  DEMO_RIDERS.forEach((r) => console.log(`  - ${r.fullName.padEnd(16)} | Phone: ${r.phone} | ID: ${r.riderId} | Vehicle: ${r.vehicleNumber}`));
  console.log('\nDEMO MEDICAL ORDERS:');
  seededOrdersSummary.forEach((o) => console.log(`  - ${o.orderNumber} | ${o.status.padEnd(30)} | Customer: ${o.customer}`));
  console.log('=============================================\n');
}

try {
  await seedDemoData();
} catch (err) {
  console.error('Error seeding demo data:', err);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
