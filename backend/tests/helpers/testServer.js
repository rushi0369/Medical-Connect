import { TEST_DB_NAME } from './testEnv.js';
import mongoose from 'mongoose';
import app from '../../src/app.js';
import { ROLES } from '../../src/config/constants.js';
import { openDatabaseConnection } from '../../src/config/db.js';
import { nextSequence } from '../../src/models/Counter.js';
import { User } from '../../src/models/User.js';
import { hashPassword } from '../../src/services/auth.service.js';

export const TEST_PASSWORD = 'TestPass123';

async function dropTestDatabase() {
  // A last safety check: this must never run against the real database.
  if (mongoose.connection.name !== TEST_DB_NAME) {
    throw new Error(`Refusing to drop "${mongoose.connection.name}": it is not the test database.`);
  }
  await mongoose.connection.dropDatabase();
}

/** Connects to a clean test database. */
export async function connectTestDatabase() {
  try {
    await openDatabaseConnection({ serverSelectionTimeoutMS: 15_000 });
  } catch (error) {
    // Without this, every test reports a confusing "cancelled" message instead of the real cause.
    throw new Error(`These tests need the database, and it could not be reached. Run "npm run db:check" for help. (${error.message})`);
  }
  await dropTestDatabase();
  for (const model of Object.values(mongoose.models)) {
    await model.createCollection();
    await model.createIndexes();
  }
}

export async function disconnectTestDatabase() {
  await dropTestDatabase();
  await mongoose.disconnect();
}

export async function startTestServer() {
  await connectTestDatabase();
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });

  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    async stop() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      await disconnectTestDatabase();
    },
  };
}

/** A small browser stand-in that remembers the login cookie between requests. */
export function createClient(baseUrl) {
  let cookie = null;

  async function request(method, path, body, headers = {}) {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body !== undefined && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });

    const setCookies = response.headers.getSetCookie();
    for (const header of setCookies) {
      const pair = header.split(';')[0];
      cookie = pair.endsWith('=') ? null : pair;
    }

    return { status: response.status, body: await response.json(), headers: response.headers, setCookies };
  }

  return {
    get: (path, headers) => request('GET', path, undefined, headers),
    post: (path, body = {}, headers) => request('POST', path, body, headers),
    patch: (path, body = {}, headers) => request('PATCH', path, body, headers),
    delete: (path, headers) => request('DELETE', path, undefined, headers),
    getCookie: () => cookie,
    setCookie: (value) => {
      cookie = value;
    },
  };
}

let uniqueCounter = 0;

export function uniquePhone() {
  uniqueCounter += 1;
  return `9${String(process.pid % 1000).padStart(3, '0')}${String(uniqueCounter).padStart(6, '0')}`;
}

export function uniqueEmail() {
  uniqueCounter += 1;
  return `user${process.pid}${uniqueCounter}@example.com`;
}

export const sampleAddress = {
  fullAddress: '12 Station Road, Near City Hospital',
  area: 'Adajan',
  city: 'Surat',
  state: 'Gujarat',
  pincode: '395009',
};

let riderCounter = 0;

/** Creates a user directly in the database, skipping the API. */
export async function createUser(role, overrides = {}) {
  const fields = {
    fullName: `Test ${role}`,
    phone: uniquePhone(),
    email: uniqueEmail(),
    passwordHash: await hashPassword(overrides.password ?? TEST_PASSWORD),
    role,
    ...overrides,
  };
  delete fields.password;

  if (role === ROLES.CUSTOMER && !fields.addresses) fields.addresses = [{ ...sampleAddress, isDefault: true }];
  if (role === ROLES.RIDER && !fields.riderProfile) {
    fields.riderProfile = { riderId: `RDR-T${process.pid}-${++riderCounter}` };
  }

  return User.create(fields);
}

/** Creates a user and returns a client already logged in as them. */
export async function loginAs(baseUrl, role, overrides = {}) {
  const user = await createUser(role, overrides);
  const client = createClient(baseUrl);
  const response = await client.post('/api/auth/login', {
    identifier: user.phone,
    password: overrides.password ?? TEST_PASSWORD,
  });

  if (response.status !== 200) throw new Error(`Test login failed: ${JSON.stringify(response.body)}`);

  return { user, client };
}
