import { query } from '../database/pool.js';
import { unauthorized, forbidden } from '../utils/errors.js';

/**
 * Loads the session's user on every request so that deactivation or role
 * changes take effect immediately, not when the session expires.
 */
export async function requireAuth(req, _res, next) {
  const userId = req.session?.userId;
  if (!userId) return next(unauthorized());

  const { rows } = await query(
    `SELECT id, email, full_name, role, department, job_title, is_active
       FROM users WHERE id = $1`,
    [userId],
  );
  const user = rows[0];
  if (!user || !user.is_active) {
    await new Promise((resolve) => req.session.destroy(resolve));
    return next(unauthorized('Your session is no longer valid. Please sign in again.'));
  }
  req.user = user;
  return next();
}

/** Restrict a route to the given roles. Must run after requireAuth. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    return next();
  };
}
