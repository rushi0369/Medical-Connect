import { AUDIT_ACTION, ROLES } from '../config/constants.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { recordAudit } from '../services/audit.service.js';
import {
  createPasswordResetOTP,
  createPasswordResetToken,
  endSession,
  hashPassword,
  hashResetToken,
  identifierToQuery,
  PASSWORD_RESET_LIFETIME_MS,
  resolveSession,
  startSession,
  verifyAgainstDummyHash,
  verifyPassword,
} from '../services/auth.service.js';
import { sendPasswordResetEmail } from '../services/email.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { serializeUser } from '../utils/serializeUser.js';

const INVALID_LOGIN_MESSAGE = 'Incorrect email/mobile number or password.';
const FORGOT_PASSWORD_MESSAGE =
  'If that account exists and has an email address, we have sent a reset link to it. The link expires in 1 hour.';

export async function register(req, res) {
  const { fullName, phone, email, password, address } = req.validated.body;

  // Always a customer. The role is set here and nothing the browser sends can change it.
  const user = await User.create({
    fullName,
    phone,
    email,
    passwordHash: await hashPassword(password),
    role: ROLES.CUSTOMER,
    addresses: [{ ...address, isDefault: true }],
    lastLoginAt: new Date(),
  });

  await recordAudit({
    actor: user,
    action: AUDIT_ACTION.CUSTOMER_REGISTERED,
    entityType: 'User',
    entityId: user._id,
    req,
  });

  startSession(res, user, false);

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Your account has been created.',
    data: { user: serializeUser(user) },
  });
}

export async function login(req, res) {
  const { identifier, password, rememberMe } = req.validated.body;
  const query = identifierToQuery(identifier);
  const user = query ? await User.findOne(query).select('+passwordHash +tokenVersion') : null;

  if (!user) {
    await verifyAgainstDummyHash(password);
  }

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await recordAudit({
      action: AUDIT_ACTION.LOGIN_FAILED,
      entityType: user ? 'User' : undefined,
      entityId: user?._id,
      req,
    });
    throw new AppError(401, 'INVALID_CREDENTIALS', INVALID_LOGIN_MESSAGE);
  }

  // Only said after the password is proven correct, so it cannot reveal who has an account.
  if (!user.isActive) {
    throw new AppError(403, 'ACCOUNT_INACTIVE', 'This account has been deactivated. Please contact the store.');
  }

  user.lastLoginAt = new Date();
  await user.save();

  await recordAudit({
    actor: user,
    action: AUDIT_ACTION.LOGIN_SUCCEEDED,
    entityType: 'User',
    entityId: user._id,
    req,
  });

  startSession(res, user, rememberMe);

  return sendSuccess(res, { message: 'You are logged in.', data: { user: serializeUser(user) } });
}

export async function logout(req, res) {
  await recordAudit({
    actor: req.user,
    action: AUDIT_ACTION.LOGOUT,
    entityType: 'User',
    entityId: req.user._id,
    req,
  });

  endSession(res);

  return sendSuccess(res, { message: 'You are logged out.', data: null });
}

/** Tells the website who is logged in. Being logged out is a normal answer, not an error. */
export async function getSession(req, res) {
  const session = await resolveSession(req, res);

  return sendSuccess(res, {
    message: session ? 'You are logged in.' : 'You are not logged in.',
    data: { user: session ? serializeUser(session.user) : null },
  });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.validated.body;
  const user = await User.findById(req.user._id).select('+passwordHash +tokenVersion');

  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please check the highlighted fields.', {
      fieldErrors: { currentPassword: ['Your current password is not correct.'] },
    });
  }

  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  // Signs out every other device, then keeps this one logged in below.
  user.tokenVersion += 1;
  await user.save();

  await recordAudit({
    actor: user,
    action: AUDIT_ACTION.PASSWORD_CHANGED,
    entityType: 'User',
    entityId: user._id,
    req,
  });

  startSession(res, user, req.sessionInfo.rememberMe);

  return sendSuccess(res, { message: 'Your password has been changed.', data: { user: serializeUser(user) } });
}

export async function forgotPassword(req, res) {
  const { identifier } = req.validated.body;
  const query = identifierToQuery(identifier);
  const user = query ? await User.findOne(query) : null;

  if (!user || !user.isActive) {
    throw new AppError(404, 'USER_NOT_FOUND', 'No active account found with that mobile number or email.');
  }

  const { token, tokenHash } = createPasswordResetToken();
  const { otp, otpHash } = createPasswordResetOTP();

  user.passwordReset = {
    tokenHash,
    otpHash,
    expiresAt: new Date(Date.now() + PASSWORD_RESET_LIFETIME_MS),
  };
  await user.save();

  try {
    await recordAudit({
      actor: user,
      action: AUDIT_ACTION.PASSWORD_RESET_REQUESTED,
      entityType: 'User',
      entityId: user._id,
      req,
    });
  } catch (err) {
    console.error('Audit log failed for password reset request:', err.message);
  }

  if (user.email) {
    sendPasswordResetEmail({
      to: user.email,
      fullName: user.fullName,
      resetUrl: `${env.CLIENT_URL}/reset-password?token=${token}`,
    }).catch((error) => console.error(`Could not send password reset email: ${error.message}`));
  }

  const cleanPhone = user.phone ? user.phone.replace(/\D/g, '') : '';
  const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const waMessage = `🔒 *CK MEDICAL* | 🔑 *Password Reset Verification Code*

Hello *${user.fullName}*,
Your password reset verification code is: *${otp}*

Valid for 1 hour. Open the portal to choose a new password:
${env.CLIENT_URL}/forgot-password?identifier=${encodeURIComponent(user.phone || user.email)}`;

  const whatsappUrl = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}` : null;
  const maskedPhone = user.phone ? `+91 ******${user.phone.slice(-4)}` : null;

  return sendSuccess(res, {
    message: `Verification code generated for ${maskedPhone || user.email}.`,
    data: {
      identifier: user.phone || user.email,
      fullName: user.fullName,
      maskedPhone,
      hasEmail: Boolean(user.email),
      otp,
      whatsappUrl,
    },
  });
}

export async function resetPassword(req, res) {
  const { token, identifier, otp, newPassword } = req.validated.body;

  let user = null;

  if (token) {
    user = await User.findOne({
      'passwordReset.tokenHash': hashResetToken(token),
      'passwordReset.expiresAt': { $gt: new Date() },
      isActive: true,
    }).select('+tokenVersion +passwordHash');
  } else if (identifier && otp) {
    const query = identifierToQuery(identifier);
    if (!query) throw new AppError(400, 'INVALID_IDENTIFIER', 'Invalid mobile number or email format.');

    user = await User.findOne({
      ...query,
      isActive: true,
    }).select('+tokenVersion +passwordHash +passwordReset.otpHash +passwordReset.expiresAt');

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'No account found matching this mobile number or email.');
    }

    if (!user.passwordReset?.expiresAt || user.passwordReset.expiresAt < new Date()) {
      throw new AppError(400, 'RESET_CODE_EXPIRED', 'Verification code has expired. Please request a new one.');
    }

    const inputHash = hashResetToken(otp.trim());
    if (user.passwordReset.otpHash !== inputHash) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Please check the highlighted fields.', {
        fieldErrors: { otp: ['Invalid 6-digit verification code. Please check and try again.'] },
      });
    }
  }

  if (!user) {
    throw new AppError(400, 'RESET_LINK_INVALID', 'This reset link or verification code is invalid or has expired. Please request a new one.');
  }

  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  user.tokenVersion += 1;
  user.passwordReset = { tokenHash: undefined, otpHash: undefined, expiresAt: undefined };
  await user.save();

  try {
    await recordAudit({
      actor: user,
      action: AUDIT_ACTION.PASSWORD_RESET_COMPLETED,
      entityType: 'User',
      entityId: user._id,
      req,
    });
  } catch (err) {
    console.error('Audit log failed for password reset completion:', err.message);
  }

  return sendSuccess(res, {
    message: 'Your password has been successfully reset! You can now log in with your new password.',
    data: null,
  });
}
