// Import this first in any test that uses the database. It points everything at a
// separate throwaway database, so tests can never touch real data.

import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export const TEST_DB_NAME = 'medicare_test';
export const CLIENT_URL = 'http://localhost:5173';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_TEST_URI ?? process.env.MONGODB_URI;
process.env.MONGODB_DB_NAME = TEST_DB_NAME;
process.env.JWT_SECRET = 'test-only-secret-that-is-long-enough-to-pass';
process.env.CLIENT_URL = CLIENT_URL;
process.env.BCRYPT_ROUNDS = '4';
process.env.SMTP_HOST = '';
