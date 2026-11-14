import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { sendError } from '../utils/apiResponse.js';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

function createLimiter({ message, ...options }) {
  return rateLimit({
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...options,
    handler: (_req, res) => sendError(res, { statusCode: 429, code: 'RATE_LIMITED', message }),
  });
}

// Mobile networks put many people behind one IP address, so these two limits count
// per IP and account together. One person's mistakes do not lock out their neighbours.
const byIpAndIdentifier = (req) => {
  const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier.trim().toLowerCase() : '';
  return `${ipKeyGenerator(req.ip)}:${identifier}`;
};

export const apiLimiter = createLimiter({
  windowMs: FIFTEEN_MINUTES_MS,
  limit: 300,
  message: 'Too many requests. Please wait a few minutes and try again.',
});

export const loginLimiter = createLimiter({
  windowMs: FIFTEEN_MINUTES_MS,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: byIpAndIdentifier,
  message: 'Too many failed login attempts. Please wait 15 minutes and try again.',
});

export const forgotPasswordLimiter = createLimiter({
  windowMs: FIFTEEN_MINUTES_MS,
  limit: 5,
  keyGenerator: byIpAndIdentifier,
  message: 'Too many reset requests. Please wait 15 minutes and try again.',
});

export const resetPasswordLimiter = createLimiter({
  windowMs: FIFTEEN_MINUTES_MS,
  limit: 20,
  message: 'Too many attempts. Please wait 15 minutes and try again.',
});

export const registerLimiter = createLimiter({
  windowMs: ONE_HOUR_MS,
  limit: 20,
  message: 'Too many sign-ups from this connection. Please try again in an hour.',
});
