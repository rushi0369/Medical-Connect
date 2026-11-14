import { resolveSession } from '../services/auth.service.js';
import { AppError } from '../utils/AppError.js';

/**
 * Requires a valid login. The user and their role are always read fresh from the
 * database, so a deactivated account or a changed role takes effect immediately.
 */
export async function authenticate(req, res, next) {
  const session = await resolveSession(req, res);

  if (!session) {
    throw new AppError(401, 'NOT_AUTHENTICATED', 'Please log in to continue.');
  }

  req.user = session.user;
  req.sessionInfo = { rememberMe: session.rememberMe };
  next();
}

/** Blocks everything except changing the password until a temporary password is replaced. */
export function requirePasswordChanged(req, _res, next) {
  if (req.user.mustChangePassword) {
    return next(new AppError(403, 'PASSWORD_CHANGE_REQUIRED', 'Please choose a new password before continuing.'));
  }
  return next();
}

export function authorize(...allowedRoles) {
  return (req, _res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to do this.'));
    }
    return next();
  };
}

/** Everything a protected route needs, in one step: requireRole(ROLES.ADMIN). */
export function requireRole(...allowedRoles) {
  return [authenticate, requirePasswordChanged, authorize(...allowedRoles)];
}
