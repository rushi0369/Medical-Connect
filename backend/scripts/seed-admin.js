// Creates the first admin account. There is deliberately no public admin sign-up.
//
//   npm run seed:admin                     Create the admin, asking each question here
//   npm run seed:admin -- --reset-password Set a new password if the admin is locked out
//
// For hosting, set SEED_ADMIN_NAME, SEED_ADMIN_PHONE, SEED_ADMIN_EMAIL and
// SEED_ADMIN_PASSWORD to skip the questions.

import mongoose from 'mongoose';
import { AUDIT_ACTION, ROLES } from '../src/config/constants.js';
import { disconnectDatabase, openDatabaseConnection } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { recordAudit } from '../src/services/audit.service.js';
import { hashPassword } from '../src/services/auth.service.js';
import { fullNameSchema, newPasswordSchema, phoneSchema, requiredEmailSchema } from '../src/validators/common.js';
import { askHidden, askVisible } from './lib/prompt.js';

const isResetMode = process.argv.includes('--reset-password');

/** Reads a value from the environment, or keeps asking until a valid answer is given. */
async function collect({ envName, schema, ask }) {
  const fromEnvironment = process.env[envName];

  if (fromEnvironment) {
    const result = schema.safeParse(fromEnvironment);
    if (!result.success) throw new Error(`${envName}: ${result.error.issues[0].message}`);
    return result.data;
  }

  if (!process.stdin.isTTY) throw new Error(`${envName} must be set when not running in a terminal.`);

  for (;;) {
    const answer = await ask();
    if (answer === null) throw new Error('Cancelled. Nothing was changed.');

    const result = schema.safeParse(answer);
    if (result.success) return result.data;
    console.log(`  ${result.error.issues[0].message}`);
  }
}

async function collectNewPassword() {
  for (;;) {
    const password = await collect({
      envName: 'SEED_ADMIN_PASSWORD',
      schema: newPasswordSchema,
      ask: () => askHidden('Password (8+ characters, with a letter and a number, shown as *): '),
    });

    if (process.env.SEED_ADMIN_PASSWORD) return password;

    const repeated = await askHidden('Type the password again: ');
    if (repeated === null) throw new Error('Cancelled. Nothing was changed.');
    if (repeated === password) return password;
    console.log('  The two passwords did not match. Please try again.');
  }
}

async function createAdmin() {
  if (await User.exists({ role: ROLES.ADMIN })) {
    console.log('An admin account already exists, so nothing was changed.');
    console.log('If you have lost the password, run: npm run seed:admin -- --reset-password');
    return;
  }

  console.log('Create the MediCare admin account. Press Ctrl+C at any time to cancel.\n');

  const fullName = await collect({
    envName: 'SEED_ADMIN_NAME',
    schema: fullNameSchema,
    ask: () => askVisible('Full name: '),
  });
  const phone = await collect({
    envName: 'SEED_ADMIN_PHONE',
    schema: phoneSchema,
    ask: () => askVisible('Mobile number: '),
  });
  const email = await collect({
    envName: 'SEED_ADMIN_EMAIL',
    schema: requiredEmailSchema,
    ask: () => askVisible('Email (used if you forget your password): '),
  });
  const password = await collectNewPassword();
  const passwordHash = await hashPassword(password);

  await mongoose.connection.transaction(async (session) => {
    const [admin] = await User.create([{ fullName, phone, email, passwordHash, role: ROLES.ADMIN }], { session });
    await recordAudit({
      actor: admin,
      action: AUDIT_ACTION.ADMIN_CREATED,
      entityType: 'User',
      entityId: admin._id,
      metadata: { source: 'seed-script' },
      session,
    });
  });

  console.log('\nThe admin account has been created. You can now log in with your email or mobile number.');
}

async function resetAdminPassword() {
  const email = await collect({
    envName: 'SEED_ADMIN_EMAIL',
    schema: requiredEmailSchema,
    ask: () => askVisible('Admin email: '),
  });

  const admin = await User.findOne({ role: ROLES.ADMIN, email }).select('+tokenVersion +passwordHash');
  if (!admin) throw new Error('No admin account has that email. Nothing was changed.');

  const passwordHash = await hashPassword(await collectNewPassword());

  await mongoose.connection.transaction(async (session) => {
    admin.passwordHash = passwordHash;
    admin.isActive = true;
    admin.mustChangePassword = false;
    admin.tokenVersion += 1;
    await admin.save({ session });
    await recordAudit({
      actor: admin,
      action: AUDIT_ACTION.ADMIN_PASSWORD_RESET,
      entityType: 'User',
      entityId: admin._id,
      metadata: { source: 'seed-script' },
      session,
    });
  });

  console.log('\nThe admin password has been changed. You can now log in.');
}

try {
  await openDatabaseConnection({ serverSelectionTimeoutMS: 15_000 });
  await (isResetMode ? resetAdminPassword() : createAdmin());
} catch (error) {
  const duplicate = error.code === 11000;
  console.error(`\n${duplicate ? 'That mobile number or email is already used by another account.' : error.message}`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
