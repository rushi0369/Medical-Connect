import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Protects cookie logins from cross-site request forgery. Browsers add an Origin
 * header to these requests, so a request sent from another website is refused.
 */
export function verifyOrigin(req, _res, next) {
  const origin = req.get('origin');

  if (!READ_ONLY_METHODS.has(req.method) && origin && origin !== env.CLIENT_URL) {
    return next(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Requests from this website are not allowed.'));
  }

  return next();
}
