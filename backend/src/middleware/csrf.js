import crypto from 'node:crypto';
import { AppError } from '../utils/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Returns the session's CSRF token, creating one when needed. */
export function ensureCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

/**
 * Synchronizer-token CSRF protection. The token lives in the server-side
 * session and must be echoed in the X-CSRF-Token header on every
 * state-changing request. Combined with SameSite=Lax cookies this blocks
 * cross-site form posts and fetches.
 */
export function csrfProtection(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const expected = req.session?.csrfToken;
  const provided = req.get('x-csrf-token');
  if (
    !expected ||
    !provided ||
    expected.length !== provided.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
  ) {
    return next(new AppError(403, 'CSRF_INVALID', 'Your security token is missing or expired. Refresh the page and try again.'));
  }
  return next();
}
