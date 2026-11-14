// Tests the MongoDB connection in backend/.env and explains any problem in plain
// language. Run with: npm run db:check
//
// It writes one temporary record inside a transaction, because later phases rely
// on transactions for billing and payments. It removes that record afterwards.

import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

const TEMPORARY_COLLECTION = 'connection_checks';

const KNOWN_PROBLEMS = [
  {
    pattern: /bad auth|authentication failed/i,
    advice:
      'The username or password is wrong. These are the Database User details from Atlas "Database Access", ' +
      'not your Atlas login. Replace any special characters in the password: @ becomes %40, / becomes %2F, ' +
      ': becomes %3A.',
  },
  {
    pattern: /whitelist|ip that isn't|ReplicaSetNoPrimary|Server selection timed out/i,
    advice:
      'The database did not accept the connection. Open https://checkip.amazonaws.com to see the address this ' +
      'computer uses, then in Atlas open "Network Access", click "Add IP Address" and type that exact address. ' +
      'Avoid the "Add Current IP Address" button, because it can add a different address. Wait until it shows ' +
      'Active, give it a minute or two, then try again. Some office or college networks also block port 27017.',
  },
  {
    pattern: /querySrv|ENOTFOUND|EAI_AGAIN/i,
    advice:
      'The cluster address could not be looked up. Check for typos in the address and check your internet ' +
      'connection. If it still fails, your network may block this kind of DNS lookup: try another network, or ' +
      'set your DNS to 8.8.8.8.',
  },
  {
    pattern: /ECONNREFUSED/,
    advice: 'Nothing is running at that address. If you meant to use Atlas, update MONGODB_URI in backend/.env.',
  },
  {
    pattern: /Transaction numbers|replica set/i,
    advice:
      'Connected, but this MongoDB does not support transactions, which MediCare needs. Atlas always supports ' +
      'them. A local MongoDB must be started as a replica set.',
  },
];

try {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 15_000 });

  const { connection } = mongoose;
  const { version } = await connection.db.command({ buildInfo: 1 });
  console.log(`OK   Connected to database "${connection.name}" (MongoDB ${version})`);

  const collection = connection.collection(TEMPORARY_COLLECTION);
  const session = await connection.startSession();
  try {
    await session.withTransaction(async () => {
      const { insertedId } = await collection.insertOne({ checkedAt: new Date() }, { session });
      await collection.deleteOne({ _id: insertedId }, { session });
    });
  } finally {
    await session.endSession();
  }
  await collection.drop();
  console.log('OK   Read, write and transactions all work');
  console.log('\nYour database is ready.');
} catch (error) {
  const known = KNOWN_PROBLEMS.find(({ pattern }) => pattern.test(error.message));
  console.error(`\nFAILED: ${error.message}`);
  if (known) console.error(`\nWhat to do: ${known.advice}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
