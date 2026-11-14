import './helpers/testEnv.js';
import assert from 'node:assert/strict';
import { after, before, describe, it, mock } from 'node:test';
import jwt from 'jsonwebtoken';
import { AUDIT_ACTION, ROLES } from '../src/config/constants.js';
import { AuditLog, User } from '../src/models/index.js';
import {
  createClient,
  createUser,
  sampleAddress,
  startTestServer,
  TEST_PASSWORD,
  uniqueEmail,
  uniquePhone,
} from './helpers/testServer.js';

const NEW_PASSWORD = 'BrandNew456';

const registration = (overrides = {}) => ({
  fullName: 'Asha Patel',
  phone: uniquePhone(),
  email: uniqueEmail(),
  password: TEST_PASSWORD,
  address: sampleAddress,
  ...overrides,
});

function sessionCookieOf(response) {
  return response.setCookies.find((header) => header.startsWith('medicare_session='));
}

/** Runs a forgot-password request and returns the token from the printed email. */
async function requestResetToken(client, identifier) {
  const info = mock.method(console, 'info', () => {});
  try {
    const response = await client.post('/api/auth/forgot-password', { identifier });
    assert.equal(response.status, 200);
    await new Promise((resolve) => setImmediate(resolve));
    const printed = info.mock.calls.map((call) => call.arguments.join(' ')).join('\n');
    return printed.match(/reset-password\?token=([a-f\d]{64})/)?.[1] ?? null;
  } finally {
    info.mock.restore();
  }
}

describe('authentication', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = await startTestServer();
    baseUrl = server.baseUrl;
  });

  after(() => server.stop());

  const newClient = () => createClient(baseUrl);

  describe('customer registration', () => {
    it('creates a customer, logs them in with a secure cookie, and returns no secrets', async () => {
      const client = newClient();
      const response = await client.post('/api/auth/register', registration());

      assert.equal(response.status, 201);
      assert.equal(response.body.data.user.role, ROLES.CUSTOMER);
      assert.equal(response.body.data.user.addresses[0].city, 'Surat');
      assert.equal(response.body.data.user.addresses[0].isDefault, true);

      const serialized = JSON.stringify(response.body);
      assert.doesNotMatch(serialized, /passwordHash|tokenVersion|passwordReset/);
      assert.doesNotMatch(serialized, new RegExp(TEST_PASSWORD));

      const cookie = sessionCookieOf(response);
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /SameSite=Lax/);
      assert.match(cookie, /Path=\//);

      const session = await client.get('/api/auth/session');
      assert.equal(session.body.data.user.id, response.body.data.user.id);
    });

    it('stores a bcrypt hash and never the password itself', async () => {
      const phone = uniquePhone();
      await newClient().post('/api/auth/register', registration({ phone }));

      const user = await User.findOne({ phone }).select('+passwordHash');
      assert.match(user.passwordHash, /^\$2[aby]\$/);
      assert.notEqual(user.passwordHash, TEST_PASSWORD);
    });

    it('ignores any attempt to choose a role or set private fields', async () => {
      const phone = uniquePhone();
      const response = await newClient().post(
        '/api/auth/register',
        registration({ phone, role: ROLES.ADMIN, isActive: false, mustChangePassword: true, tokenVersion: 99 }),
      );

      assert.equal(response.status, 201);
      const user = await User.findOne({ phone }).select('+tokenVersion');
      assert.equal(user.role, ROLES.CUSTOMER);
      assert.equal(user.isActive, true);
      assert.equal(user.mustChangePassword, false);
      assert.equal(user.tokenVersion, 0);
    });

    it('accepts no email, and normalises common phone formats', async () => {
      const digits = uniquePhone();
      const response = await newClient().post(
        '/api/auth/register',
        registration({ phone: `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`, email: '' }),
      );

      assert.equal(response.status, 201);
      assert.equal(response.body.data.user.phone, digits);
      assert.equal(response.body.data.user.email, null);
    });

    it('explains each invalid field', async () => {
      const response = await newClient().post('/api/auth/register', {
        fullName: 'A',
        phone: '123',
        email: 'not-an-email',
        password: 'short',
        address: { ...sampleAddress, pincode: '12' },
      });

      assert.equal(response.status, 422);
      assert.equal(response.body.error.code, 'VALIDATION_ERROR');

      const { fieldErrors } = response.body.error.details;
      for (const field of ['fullName', 'phone', 'email', 'password', 'address.pincode']) {
        assert.ok(fieldErrors[field], `expected an error on ${field}`);
      }
    });

    it('requires both a letter and a number in the password', async () => {
      for (const password of ['onlyletters', '1234567890']) {
        const response = await newClient().post('/api/auth/register', registration({ password }));
        assert.equal(response.status, 422);
        assert.ok(response.body.error.details.fieldErrors.password);
      }
    });

    it('refuses a password longer than bcrypt can read', async () => {
      const response = await newClient().post('/api/auth/register', registration({ password: `a1${'x'.repeat(80)}` }));
      assert.equal(response.status, 422);
    });

    it('refuses a phone or email that is already registered, naming the field', async () => {
      const phone = uniquePhone();
      const email = uniqueEmail();
      await newClient().post('/api/auth/register', registration({ phone, email }));

      const samePhone = await newClient().post('/api/auth/register', registration({ phone }));
      assert.equal(samePhone.status, 409);
      assert.ok(samePhone.body.error.details.fieldErrors.phone);

      const sameEmail = await newClient().post('/api/auth/register', registration({ email: email.toUpperCase() }));
      assert.equal(sameEmail.status, 409);
      assert.ok(sameEmail.body.error.details.fieldErrors.email);
    });
  });

  describe('login', () => {
    it('works with email or mobile, in any common format', async () => {
      const user = await createUser(ROLES.CUSTOMER);

      for (const identifier of [
        user.email,
        user.email.toUpperCase(),
        user.phone,
        `+91${user.phone}`,
        `0${user.phone}`,
        `  ${user.phone}  `,
      ]) {
        const response = await newClient().post('/api/auth/login', { identifier, password: TEST_PASSWORD });
        assert.equal(response.status, 200, `failed for ${identifier}`);
        assert.equal(response.body.data.user.id, user.id);
      }
    });

    it('returns the role from the database for each role', async () => {
      for (const role of Object.values(ROLES)) {
        const user = await createUser(role);
        const response = await newClient().post('/api/auth/login', { identifier: user.phone, password: TEST_PASSWORD });
        assert.equal(response.body.data.user.role, role);
      }
    });

    it('gives the same answer for a wrong password and an unknown account', async () => {
      const user = await createUser(ROLES.CUSTOMER);

      const wrongPassword = await newClient().post('/api/auth/login', { identifier: user.phone, password: 'Wrong12345' });
      const unknownAccount = await newClient().post('/api/auth/login', {
        identifier: uniquePhone(),
        password: 'Wrong12345',
      });

      assert.equal(wrongPassword.status, 401);
      assert.equal(unknownAccount.status, 401);
      assert.deepEqual(wrongPassword.body, unknownAccount.body);
    });

    it('refuses objects where text is expected, which blocks database query injection', async () => {
      for (const body of [
        { identifier: { $ne: null }, password: TEST_PASSWORD },
        { identifier: 'someone@example.com', password: { $ne: null } },
      ]) {
        const response = await newClient().post('/api/auth/login', body);
        assert.equal(response.status, 422);
      }
    });

    it('stays signed in after closing the browser only with Remember me', async () => {
      const user = await createUser(ROLES.CUSTOMER);

      const standard = await newClient().post('/api/auth/login', { identifier: user.phone, password: TEST_PASSWORD });
      assert.doesNotMatch(sessionCookieOf(standard), /Max-Age/);

      const remembered = await newClient().post('/api/auth/login', {
        identifier: user.phone,
        password: TEST_PASSWORD,
        rememberMe: true,
      });
      assert.match(sessionCookieOf(remembered), /Max-Age=2592000/);
    });

    it('only reveals a deactivated account to someone with the right password', async () => {
      const user = await createUser(ROLES.CUSTOMER, { isActive: false });

      const wrong = await newClient().post('/api/auth/login', { identifier: user.phone, password: 'Wrong12345' });
      assert.equal(wrong.status, 401);

      const right = await newClient().post('/api/auth/login', { identifier: user.phone, password: TEST_PASSWORD });
      assert.equal(right.status, 403);
      assert.equal(right.body.error.code, 'ACCOUNT_INACTIVE');
      assert.equal(sessionCookieOf(right), undefined);
    });

    it('locks one account after 10 failed attempts without affecting other accounts', async () => {
      const target = await createUser(ROLES.CUSTOMER);
      const other = await createUser(ROLES.CUSTOMER);
      const client = newClient();

      for (let attempt = 0; attempt < 10; attempt += 1) {
        const failed = await client.post('/api/auth/login', { identifier: target.phone, password: 'Wrong12345' });
        assert.equal(failed.status, 401);
      }

      const blocked = await client.post('/api/auth/login', { identifier: target.phone, password: TEST_PASSWORD });
      assert.equal(blocked.status, 429);
      assert.equal(blocked.body.error.code, 'RATE_LIMITED');

      const unaffected = await client.post('/api/auth/login', { identifier: other.phone, password: TEST_PASSWORD });
      assert.equal(unaffected.status, 200);
    });

    it('records successes and failures in the audit log, without passwords', async () => {
      const user = await createUser(ROLES.CUSTOMER);

      await newClient().post('/api/auth/login', { identifier: user.phone, password: 'Wrong12345' });
      await newClient().post('/api/auth/login', { identifier: user.phone, password: TEST_PASSWORD });

      const failed = await AuditLog.findOne({ action: AUDIT_ACTION.LOGIN_FAILED, entityId: user._id });
      const succeeded = await AuditLog.findOne({ action: AUDIT_ACTION.LOGIN_SUCCEEDED, entityId: user._id });

      assert.ok(failed);
      assert.equal(failed.actor, undefined);
      assert.equal(succeeded.actor.toString(), user.id);
      assert.equal(succeeded.actorRole, ROLES.CUSTOMER);
      assert.ok(succeeded.createdAt);

      assert.doesNotMatch(JSON.stringify([failed, succeeded]), /Wrong12345|TestPass123/);
    });
  });

  describe('sessions', () => {
    it('reports no user when logged out, without treating it as an error', async () => {
      const response = await newClient().get('/api/auth/session');
      assert.equal(response.status, 200);
      assert.equal(response.body.data.user, null);
    });

    it('rejects forged, tampered and expired tokens', async () => {
      const { id } = await createUser(ROLES.ADMIN);
      const claims = { tv: 0, rm: 0 };
      const options = { subject: id, issuer: 'medicare-api' };
      const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
      const valid = jwt.sign(claims, process.env.JWT_SECRET, { ...options, expiresIn: 60 });

      const badTokens = {
        'wrong secret': jwt.sign(claims, 'an-attacker-guessed-this-secret-value-here', { ...options, expiresIn: 60 }),
        'wrong issuer': jwt.sign(claims, process.env.JWT_SECRET, { subject: id, issuer: 'someone-else', expiresIn: 60 }),
        expired: jwt.sign(claims, process.env.JWT_SECRET, { ...options, expiresIn: -10 }),
        'no signature': `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ ...claims, sub: id, iss: 'medicare-api' })}.`,
        tampered: `${valid.slice(0, -4)}abcd`,
      };

      for (const [name, token] of Object.entries(badTokens)) {
        const client = newClient();
        client.setCookie(`medicare_session=${token}`);

        const session = await client.get('/api/auth/session');
        assert.equal(session.body.data.user, null, `${name} token was accepted`);

        client.setCookie(`medicare_session=${token}`);
        const protectedRoute = await client.get('/api/admin/summary');
        assert.equal(protectedRoute.status, 401, `${name} token reached a protected route`);
      }
    });

    it('never needs a role in the token, so an edited token cannot gain access', async () => {
      const customer = await createUser(ROLES.CUSTOMER);
      const client = newClient();
      const token = jwt.sign({ tv: 0, rm: 0, role: ROLES.ADMIN }, process.env.JWT_SECRET, {
        subject: customer.id,
        issuer: 'medicare-api',
        expiresIn: 60,
      });
      client.setCookie(`medicare_session=${token}`);

      const response = await client.get('/api/admin/summary');
      assert.equal(response.status, 403);
    });

    it('logout ends the session', async () => {
      const client = newClient();
      await client.post('/api/auth/register', registration());

      const response = await client.post('/api/auth/logout');
      assert.equal(response.status, 200);
      assert.equal(client.getCookie(), null);

      const session = await client.get('/api/auth/session');
      assert.equal(session.body.data.user, null);
    });

    it('logout needs a login', async () => {
      const response = await newClient().post('/api/auth/logout');
      assert.equal(response.status, 401);
    });
  });

  describe('cross-site protection', () => {
    it('refuses requests sent from another website, and allows the real one', async () => {
      const user = await createUser(ROLES.CUSTOMER);
      const credentials = { identifier: user.phone, password: TEST_PASSWORD };

      const blocked = await newClient().post('/api/auth/login', credentials, { Origin: 'https://evil.example' });
      assert.equal(blocked.status, 403);
      assert.equal(blocked.body.error.code, 'ORIGIN_NOT_ALLOWED');

      const allowed = await newClient().post('/api/auth/login', credentials, { Origin: 'http://localhost:5173' });
      assert.equal(allowed.status, 200);
    });
  });

  describe('changing a password', () => {
    it('needs the correct current password', async () => {
      const client = newClient();
      await client.post('/api/auth/register', registration());

      const response = await client.post('/api/auth/change-password', {
        currentPassword: 'Wrong12345',
        newPassword: NEW_PASSWORD,
      });

      assert.equal(response.status, 422);
      assert.ok(response.body.error.details.fieldErrors.currentPassword);
    });

    it('refuses reusing the same password, and weak new passwords', async () => {
      const client = newClient();
      await client.post('/api/auth/register', registration());

      for (const newPassword of [TEST_PASSWORD, 'weak']) {
        const response = await client.post('/api/auth/change-password', {
          currentPassword: TEST_PASSWORD,
          newPassword,
        });
        assert.equal(response.status, 422);
        assert.ok(response.body.error.details.fieldErrors.newPassword);
      }
    });

    it('keeps this device logged in, signs out other devices, and retires the old password', async () => {
      const phone = uniquePhone();
      const thisDevice = newClient();
      const otherDevice = newClient();
      await thisDevice.post('/api/auth/register', registration({ phone }));
      await otherDevice.post('/api/auth/login', { identifier: phone, password: TEST_PASSWORD });

      const response = await thisDevice.post('/api/auth/change-password', {
        currentPassword: TEST_PASSWORD,
        newPassword: NEW_PASSWORD,
      });
      assert.equal(response.status, 200);

      assert.ok((await thisDevice.get('/api/auth/session')).body.data.user);
      assert.equal((await otherDevice.get('/api/auth/session')).body.data.user, null);

      const oldPassword = await newClient().post('/api/auth/login', { identifier: phone, password: TEST_PASSWORD });
      assert.equal(oldPassword.status, 401);

      const newPassword = await newClient().post('/api/auth/login', { identifier: phone, password: NEW_PASSWORD });
      assert.equal(newPassword.status, 200);
    });

    it('needs a login', async () => {
      const response = await newClient().post('/api/auth/change-password', {
        currentPassword: TEST_PASSWORD,
        newPassword: NEW_PASSWORD,
      });
      assert.equal(response.status, 401);
    });
  });

  describe('forgot password', () => {
    it('gives the same answer whether or not the account exists', async () => {
      const user = await createUser(ROLES.CUSTOMER);

      const known = await newClient().post('/api/auth/forgot-password', { identifier: user.email });
      const unknown = await newClient().post('/api/auth/forgot-password', { identifier: uniqueEmail() });
      const garbage = await newClient().post('/api/auth/forgot-password', { identifier: 'not-a-phone' });

      assert.equal(known.status, 200);
      assert.deepEqual(known.body, unknown.body);
      assert.deepEqual(known.body, garbage.body);
    });

    it('resets the password once, signs out every device, and stores only a hash of the token', async () => {
      const user = await createUser(ROLES.CUSTOMER);
      const device = newClient();
      await device.post('/api/auth/login', { identifier: user.phone, password: TEST_PASSWORD });

      const token = await requestResetToken(newClient(), user.email);
      assert.ok(token, 'the reset email was not produced');

      const stored = await User.findById(user._id).select('+passwordReset.tokenHash +passwordReset.expiresAt');
      assert.ok(stored.passwordReset.tokenHash);
      assert.notEqual(stored.passwordReset.tokenHash, token);

      const reset = await newClient().post('/api/auth/reset-password', { token, newPassword: NEW_PASSWORD });
      assert.equal(reset.status, 200);

      assert.equal((await device.get('/api/auth/session')).body.data.user, null);

      const login = await newClient().post('/api/auth/login', { identifier: user.phone, password: NEW_PASSWORD });
      assert.equal(login.status, 200);

      const reused = await newClient().post('/api/auth/reset-password', { token, newPassword: 'Another789x' });
      assert.equal(reused.status, 400);
      assert.equal(reused.body.error.code, 'RESET_LINK_INVALID');
    });

    it('accepts a mobile number as the identifier, and sends to the email on the account', async () => {
      const user = await createUser(ROLES.CUSTOMER);
      assert.ok(await requestResetToken(newClient(), user.phone));
    });

    it('rejects an expired link and a made-up link', async () => {
      const user = await createUser(ROLES.CUSTOMER);
      const token = await requestResetToken(newClient(), user.email);

      await User.updateOne({ _id: user._id }, { 'passwordReset.expiresAt': new Date(Date.now() - 1000) });

      const expired = await newClient().post('/api/auth/reset-password', { token, newPassword: NEW_PASSWORD });
      assert.equal(expired.status, 400);

      const madeUp = await newClient().post('/api/auth/reset-password', { token: 'a'.repeat(64), newPassword: NEW_PASSWORD });
      assert.equal(madeUp.status, 400);

      const malformed = await newClient().post('/api/auth/reset-password', { token: 'short', newPassword: NEW_PASSWORD });
      assert.equal(malformed.status, 422);
    });

    it('sends nothing for accounts with no email, or that are deactivated', async () => {
      const noEmail = await createUser(ROLES.CUSTOMER, { email: undefined });
      assert.equal(await requestResetToken(newClient(), noEmail.phone), null);

      const inactive = await createUser(ROLES.CUSTOMER, { isActive: false });
      assert.equal(await requestResetToken(newClient(), inactive.email), null);
    });

    it('limits repeated requests for one account', async () => {
      const user = await createUser(ROLES.CUSTOMER);
      const client = newClient();

      for (let attempt = 0; attempt < 5; attempt += 1) {
        assert.equal((await client.post('/api/auth/forgot-password', { identifier: user.email })).status, 200);
      }

      assert.equal((await client.post('/api/auth/forgot-password', { identifier: user.email })).status, 429);
    });
  });
});
