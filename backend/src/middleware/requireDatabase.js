import { getDatabaseStatus } from '../config/db.js';
import { AppError } from '../utils/AppError.js';

/** Answers immediately with a clear message when the database is down, rather than hanging. */
export function requireDatabase(_req, _res, next) {
  if (getDatabaseStatus() !== 'connected') {
    return next(
      new AppError(
        503,
        'DATABASE_UNAVAILABLE',
        'We cannot reach the database right now. Please try again in a moment.',
      ),
    );
  }
  return next();
}
