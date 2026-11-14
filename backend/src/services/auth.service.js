import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { normalizePhone } from '../validators/common.js';

const SESSION_COOKIE = 'medicare_session';
const TOKEN_ISSUER = 'medicare-api';
const STANDARD_SESSION_SECONDS = 24 * 60 * 60;
const REMEMBERED_SESSION_SECONDS = 30 * 24 * 60 * 60;
const TEMPORARY_PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const PASSWORD_RESET_LIFETIME_MS = 60 * 60 * 1000;

export const hashPassword = (password) => bcrypt.hash(password, env.BCRYPT_ROUNDS);
export const verifyPassword = (password, hash) => bcrypt.compare(password, hash);

let dummyHash;

/** Spends the same time as a real check, so response times do not reveal which accounts exist. */
export async function verifyAgainstDummyHash(password) {
  dummyHash ??= await hashPassword(crypto.randomBytes(16).toString('hex'));
  await bcrypt.compare(password, dummyHash);
}

/** Builds a database query from whatever was typed into the "email or mobile" box. */
export function identifierToQuery(identifier) {
  if (identifier.includes('@')) return { email: identifier.trim().toLowerCase() };
  const phone = normalizePhone(identifier);
  return phone ? { phone } : null;
}

export function generateTemporaryPassword(length = 12) {
  const alphabet = TEMPORARY_PASSWORD_ALPHABET;
  for (;;) {
    let password = '';
    for (let index = 0; index < length; index += 1) {
      password += alphabet[crypto.randomInt(alphabet.length)];
    }
    if (/[A-Za-z]/.test(password) && /\d/.test(password)) return password;
  }
}

/** Only a hash of the reset token is stored, so a database leak cannot be used to reset passwords. */
export function createPasswordResetToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, tokenHash: hashResetToken(token) };
}

export function createPasswordResetOTP() {
  const otp = String(crypto.randomInt(100000, 1000000));
  return { otp, otpHash: hashResetToken(otp) };
}

export const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export function startSession(res, user, rememberMe) {
  const lifetime = rememberMe ? REMEMBERED_SESSION_SECONDS : STANDARD_SESSION_SECONDS;

  // The token holds no role. Permissions are always read from the database.
  const token = jwt.sign({ tv: user.tokenVersion, rm: rememberMe ? 1 : 0 }, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: user.id,
    issuer: TOKEN_ISSUER,
    expiresIn: lifetime,
  });

  res.cookie(SESSION_COOKIE, token, {
    ...cookieOptions(),
    // Without "Remember me" the browser forgets the login when it closes.
    ...(rememberMe ? { maxAge: lifetime * 1000 } : {}),
  });
}

export function endSession(res) {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

function cookieOptions() {
  const isCrossSite = env.CLIENT_URL && !env.CLIENT_URL.includes('localhost') && env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: isCrossSite ? 'none' : 'lax',
    path: '/',
  };
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

/** Checks a login token. Returns the user, or null if the token is invalid, expired or ended. */
export async function userFromSessionToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'], issuer: TOKEN_ISSUER });
  } catch {
    return null;
  }

  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user || !user.isActive || user.tokenVersion !== payload.tv) return null;

  return { user, rememberMe: payload.rm === 1 };
}

/** Works out who is logged in. Returns null, and clears a bad cookie, if nobody validly is. */
export async function resolveSession(req, res) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;

  const session = await userFromSessionToken(token);
  if (!session) endSession(res);
  return session;
}
