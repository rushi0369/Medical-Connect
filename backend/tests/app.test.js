import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const CLIENT_URL = 'http://localhost:5173';

// These override any values in backend/.env. The tests do not need a database.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/medicare-test';
process.env.JWT_SECRET = 'test-only-secret-that-is-long-enough-to-pass';
process.env.CLIENT_URL = `${CLIENT_URL}/`;

const { default: app } = await import('../src/app.js');

describe('MediCare API foundation', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  it('GET /api/health reports a live API without a database as degraded', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.service, 'medicare-api');
    assert.equal(body.data.status, 'degraded');
    assert.equal(body.data.database.status, 'disconnected');
    assert.equal(typeof body.data.uptimeSeconds, 'number');
    assert.ok(!Number.isNaN(Date.parse(body.data.timestamp)));
  });

  it('answers clearly and quickly when the database is unavailable', async () => {
    const startedAt = Date.now();
    const response = await fetch(`${baseUrl}/api/auth/session`);
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.equal(body.error.code, 'DATABASE_UNAVAILABLE');
    assert.ok(Date.now() - startedAt < 1000);
  });

  it('unknown routes return the standard JSON error shape', async () => {
    const response = await fetch(`${baseUrl}/api/does-not-exist`);
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'NOT_FOUND');
    assert.match(body.error.message, /GET \/api\/does-not-exist/);
  });

  it('malformed JSON returns 400 without leaking parser details', async () => {
    const response = await fetch(`${baseUrl}/api/does-not-exist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ not json',
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'INVALID_JSON');
    assert.equal(body.error.message, 'The request body is not valid JSON.');
  });

  it('oversized bodies return 413', async () => {
    const response = await fetch(`${baseUrl}/api/does-not-exist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ padding: 'x'.repeat(200 * 1024) }),
    });
    const body = await response.json();

    assert.equal(response.status, 413);
    assert.equal(body.error.code, 'PAYLOAD_TOO_LARGE');
  });

  it('CORS allows only CLIENT_URL, with credentials, ignoring a trailing slash in .env', async () => {
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://evil.example' },
    });

    assert.equal(response.headers.get('access-control-allow-origin'), CLIENT_URL);
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  });

  it('sets security headers and hides the Express signature', async () => {
    const response = await fetch(`${baseUrl}/api/health`);

    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(response.headers.get('strict-transport-security'));
    assert.equal(response.headers.get('x-powered-by'), null);
  });

  it('exempts the health check from rate limiting', async () => {
    const response = await fetch(`${baseUrl}/api/health`);

    assert.equal(response.headers.get('ratelimit'), null);
  });

  // Keep this test last: it uses up the limit for the rest of this file.
  it('rate limits other API routes with the standard error shape', async () => {
    let response;
    for (let requestNumber = 0; requestNumber < 301; requestNumber += 1) {
      response = await fetch(`${baseUrl}/api/does-not-exist`);
      await response.arrayBuffer();
    }

    assert.equal(response.status, 429);
    const retried = await fetch(`${baseUrl}/api/does-not-exist`);
    const body = await retried.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'RATE_LIMITED');
  });
});

describe('environment validation', () => {
  const backendRoot = fileURLToPath(new URL('..', import.meta.url));
  const run = promisify(execFile);
  const loadEnvWith = (overrides) =>
    run(process.execPath, ['--input-type=module', '-e', "import './src/config/env.js'"], {
      cwd: backendRoot,
      env: { ...process.env, ...overrides },
    });

  it('refuses to start with bad settings and names each one', async () => {
    await assert.rejects(
      loadEnvWith({
        MONGODB_URI: 'not-a-mongo-address',
        JWT_SECRET: 'replace_with_long_random_secret',
        CLIENT_URL: 'nope',
      }),
      (error) => {
        assert.equal(error.code, 1);
        assert.match(error.stderr, /MONGODB_URI/);
        assert.match(error.stderr, /JWT_SECRET/);
        assert.match(error.stderr, /CLIENT_URL/);
        return true;
      },
    );
  });

  it('rejects an Atlas address with no database name', async () => {
    await assert.rejects(
      loadEnvWith({
        MONGODB_URI: 'mongodb+srv://user:pass@cluster0.example.mongodb.net/?retryWrites=true&w=majority',
      }),
      (error) => {
        assert.match(error.stderr, /must include the database name/);
        return true;
      },
    );
  });

  it('accepts both an Atlas address with a database name and the local default', async () => {
    await loadEnvWith({
      MONGODB_URI: 'mongodb+srv://user:pass@cluster0.example.mongodb.net/medicare?retryWrites=true&w=majority',
    });
    await loadEnvWith({ MONGODB_URI: 'mongodb://127.0.0.1:27017/medicare' });
  });
});
