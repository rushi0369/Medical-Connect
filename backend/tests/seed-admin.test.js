import { TEST_DB_NAME } from './helpers/testEnv.js';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { AUDIT_ACTION, ROLES } from '../src/config/constants.js';
import { AuditLog, User } from '../src/models/index.js';
import { verifyPassword } from '../src/services/auth.service.js';
import { connectTestDatabase, disconnectTestDatabase, uniqueEmail, uniquePhone } from './helpers/testServer.js';

const backendRoot = fileURLToPath(new URL('..', import.meta.url));
const run = promisify(execFile);

function runSeed(values, args = []) {
  return run(process.execPath, ['scripts/seed-admin.js', ...args], {
    cwd: backendRoot,
    env: { ...process.env, MONGODB_DB_NAME: TEST_DB_NAME, ...values },
  });
}

describe('admin setup script', () => {
  const details = {
    SEED_ADMIN_NAME: 'Store Owner',
    SEED_ADMIN_PHONE: uniquePhone(),
    SEED_ADMIN_EMAIL: uniqueEmail(),
    SEED_ADMIN_PASSWORD: 'OwnerPass123',
  };

  before(connectTestDatabase);
  after(disconnectTestDatabase);

  it('refuses a weak password and creates nothing', async () => {
    await assert.rejects(runSeed({ ...details, SEED_ADMIN_PASSWORD: 'weak' }), (error) => {
      assert.match(error.stderr, /SEED_ADMIN_PASSWORD/);
      return true;
    });
    assert.equal(await User.countDocuments({ role: ROLES.ADMIN }), 0);
  });

  it('creates the admin, with a hashed password and an audit record', async () => {
    const { stdout } = await runSeed(details);
    assert.match(stdout, /admin account has been created/);
    assert.doesNotMatch(stdout, /OwnerPass123/);

    const admin = await User.findOne({ role: ROLES.ADMIN }).select('+passwordHash');
    assert.equal(admin.fullName, 'Store Owner');
    assert.ok(await verifyPassword('OwnerPass123', admin.passwordHash));
    assert.ok(await AuditLog.findOne({ action: AUDIT_ACTION.ADMIN_CREATED, entityId: admin._id }));
  });

  it('never creates a second admin', async () => {
    const { stdout } = await runSeed({ ...details, SEED_ADMIN_PHONE: uniquePhone(), SEED_ADMIN_EMAIL: uniqueEmail() });
    assert.match(stdout, /already exists/);
    assert.equal(await User.countDocuments({ role: ROLES.ADMIN }), 1);
  });

  it('can recover a locked-out admin with the reset option', async () => {
    await runSeed({ ...details, SEED_ADMIN_PASSWORD: 'Recovered456' }, ['--reset-password']);

    const admin = await User.findOne({ role: ROLES.ADMIN }).select('+passwordHash');
    assert.ok(await verifyPassword('Recovered456', admin.passwordHash));
    assert.ok(await AuditLog.findOne({ action: AUDIT_ACTION.ADMIN_PASSWORD_RESET, entityId: admin._id }));
  });

  it('refuses to reset an email that is not the admin', async () => {
    await assert.rejects(
      runSeed({ ...details, SEED_ADMIN_EMAIL: uniqueEmail(), SEED_ADMIN_PASSWORD: 'Recovered789' }, ['--reset-password']),
      (error) => {
        assert.match(error.stderr, /No admin account has that email/);
        return true;
      },
    );
  });
});
