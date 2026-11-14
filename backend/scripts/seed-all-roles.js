import mongoose from 'mongoose';
import { ROLES, AUDIT_ACTION } from '../src/config/constants.js';
import { disconnectDatabase, openDatabaseConnection } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Counter } from '../src/models/Counter.js';
import { hashPassword } from '../src/services/auth.service.js';

async function seedAccounts() {
  await openDatabaseConnection();
  console.log('Connected to MongoDB. Seeding accounts...');

  const adminPasswordHash = await hashPassword('Admin@123');
  const customerPasswordHash = await hashPassword('Customer@123');
  const riderPasswordHash = await hashPassword('Rider@123');

  // 1. Admin Account
  let admin = await User.findOne({ email: 'admin@medicare.com' });
  if (admin) {
    admin.passwordHash = adminPasswordHash;
    admin.isActive = true;
    admin.mustChangePassword = false;
    admin.tokenVersion = 0;
    await admin.save();
    console.log('Updated existing Admin account');
  } else {
    // Delete if any account holds the phone
    await User.deleteMany({ phone: '9876543210' });
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
  }

  // 2. Customer Account
  let customer = await User.findOne({ email: 'customer@medicare.com' });
  if (customer) {
    customer.passwordHash = customerPasswordHash;
    customer.isActive = true;
    customer.mustChangePassword = false;
    customer.tokenVersion = 0;
    await customer.save();
    console.log('Updated existing Customer account');
  } else {
    await User.deleteMany({ phone: '9876543211' });
    customer = await User.create({
      fullName: 'MediCare Customer',
      phone: '9876543211',
      email: 'customer@medicare.com',
      passwordHash: customerPasswordHash,
      role: ROLES.CUSTOMER,
      isActive: true,
      mustChangePassword: false,
      addresses: [
        {
          label: 'Home',
          fullAddress: 'Flat 101, Sunshine Heights, Linking Road',
          area: 'Bandra West',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400050',
          isDefault: true,
        },
      ],
    });
    console.log('Created Customer account');
  }

  // 3. Rider Account
  let rider = await User.findOne({ email: 'rider@medicare.com' });
  if (rider) {
    rider.passwordHash = riderPasswordHash;
    rider.isActive = true;
    rider.mustChangePassword = false;
    rider.tokenVersion = 0;
    await rider.save();
    console.log('Updated existing Rider account');
  } else {
    await User.deleteMany({ phone: '9876543212' });
    await Counter.findByIdAndUpdate('rider', { $max: { seq: 1 } }, { upsert: true });
    rider = await User.create({
      fullName: 'MediCare Rider',
      phone: '9876543212',
      email: 'rider@medicare.com',
      passwordHash: riderPasswordHash,
      role: ROLES.RIDER,
      isActive: true,
      mustChangePassword: false,
      createdBy: admin._id,
      riderProfile: {
        riderId: 'RDR-0001',
        vehicleNumber: 'MH02AB1234',
        notes: 'Primary delivery rider',
      },
    });
    console.log('Created Rider account');
  }

  console.log('\nAll 3 accounts have been seeded successfully!\n');
}

try {
  await seedAccounts();
} catch (err) {
  console.error('Error seeding accounts:', err);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
