import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { StoreSettings } from '../src/models/StoreSettings.js';
import { SINGLETON_KEY } from '../src/config/constants.js';

async function updateStoreLocation() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 15_000 });
    console.log('Connected successfully.');

    const newAddress = {
      fullAddress: 'Mandvi Road, Near Mandvi Bus Depot, Char Rasta, Kim, Gujarat 394110',
      area: 'Char Rasta, Near Mandvi Bus Depot',
      city: 'Kim',
      state: 'Gujarat',
      pincode: '394110',
      location: {
        lat: 21.4035,
        lng: 72.9274,
      },
    };

    const updated = await StoreSettings.findOneAndUpdate(
      { key: SINGLETON_KEY },
      {
        $set: {
          storeName: 'CK Medical',
          address: newAddress,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    console.log('Successfully updated StoreSettings:');
    console.log(JSON.stringify(updated, null, 2));

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Failed to update StoreSettings:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

updateStoreLocation();

