import mongoose from 'mongoose';
import '../models/index.js';
import { env } from './env.js';

const RETRY_DELAY_MS = 5000;
const SERVER_SELECTION_TIMEOUT_MS = 5000;

const READY_STATE_LABELS = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

let retryTimer = null;
let isShuttingDown = false;
let isConnected = false;

mongoose.connection.on('connected', () => {
  isConnected = true;
  console.log(`MongoDB connected (database: ${mongoose.connection.name})`);
});

mongoose.connection.on('disconnected', () => {
  // A failed first attempt also fires this event, but connectDatabase() already reports that.
  if (isConnected && !isShuttingDown) console.warn('MongoDB disconnected. Waiting for it to come back...');
  isConnected = false;
});

/** Connects once with the app's settings and waits until all indexes exist. */
export async function openDatabaseConnection(options = {}) {
  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
    ...(env.MONGODB_DB_NAME ? { dbName: env.MONGODB_DB_NAME } : {}),
    ...options,
  });
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

/**
 * Connects to MongoDB and keeps retrying until it succeeds.
 *
 * The API stays up in the meantime so /api/health can report the problem. Once
 * a first connection has succeeded, the MongoDB driver handles reconnects itself.
 */
export async function connectDatabase() {
  try {
    await openDatabaseConnection();
  } catch (error) {
    if (isShuttingDown) return;
    console.error(
      `Could not connect to MongoDB (${error.message}). ` +
        `Check MONGODB_URI in backend/.env. For more detail, run: npm run db:check. ` +
        `Retrying in ${RETRY_DELAY_MS / 1000} seconds...`,
    );
    retryTimer = setTimeout(connectDatabase, RETRY_DELAY_MS);
  }
}

export async function disconnectDatabase() {
  isShuttingDown = true;
  clearTimeout(retryTimer);
  await mongoose.disconnect();
}

export function getDatabaseStatus() {
  return READY_STATE_LABELS[mongoose.connection.readyState] ?? 'disconnected';
}
