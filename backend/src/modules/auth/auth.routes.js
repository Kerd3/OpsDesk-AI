import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { ensureCsrfToken } from '../../middleware/csrf.js';
import { authRateLimiter } from '../../middleware/rate-limit.js';
import { config } from '../../config/env.js';
import { recordAudit } from '../audit/audit.service.js';
import { toUserDto } from '../users/users.service.js';
import { verifyCredentials, changePassword, updateOwnProfile } from './auth.service.js';

export const SESSION_COOKIE = 'opsdesk.sid';
const router = Router();

const regenerate = (req) => new Promise((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));
const save = (req) => new Promise((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));

// Issues the CSRF token the SPA must send with every state-changing request.
router.get('/csrf', (req, res) => {
  res.json({ data: { csrfToken: ensureCsrfToken(req) } });
});

router.post(
  '/login',
  authRateLimiter,
  validate([
    body('email').isString().trim().notEmpty().withMessage('Email is required').bail().isEmail().withMessage('Enter a valid email address').normalizeEmail({ gmail_remove_dots: false }),
    body('password').isString().withMessage('Password is required').bail().notEmpty().withMessage('Password is required').isLength({ max: 200 }),
  ]),
  async (req, res) => {
    const { email, password } = req.validated.body;
    const user = await verifyCredentials(email, password);

    // New session id on sign-in prevents session fixation.
    await regenerate(req);
    req.session.userId = user.id;
    req.session.role = user.role;
    const csrfToken = ensureCsrfToken(req);
    await save(req);

    res.json({ data: { user, csrfToken } });
  },
);

router.post('/logout', async (req, res) => {
  const userId = req.session?.userId;
  await new Promise((resolve) => req.session.destroy(resolve));
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.session.cookieSecure, path: '/' });
  if (userId) await recordAudit({ actorId: userId, action: 'auth.logout', resourceType: 'session', resourceId: userId });
  res.json({ data: { success: true } });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ data: { user: toUserDto(req.user), csrfToken: ensureCsrfToken(req) } });
});

router.patch(
  '/me',
  requireAuth,
  validate([
    body('fullName').optional().isString().trim().isLength({ min: 2, max: 120 }),
    body('department').optional().isString().trim().isLength({ max: 120 }),
    body('jobTitle').optional().isString().trim().isLength({ max: 120 }),
  ]),
  async (req, res) => {
    res.json({ data: { user: await updateOwnProfile(req.user.id, req.validated.body) } });
  },
);

router.post(
  '/change-password',
  requireAuth,
  validate([
    body('currentPassword').isString().notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isString()
      .isLength({ min: 10, max: 200 })
      .withMessage('New password must be at least 10 characters')
      .matches(/[A-Za-z]/)
      .withMessage('New password must contain a letter')
      .matches(/[0-9]/)
      .withMessage('New password must contain a number'),
  ]),
  async (req, res) => {
    const { currentPassword, newPassword } = req.validated.body;
    await changePassword(req.user.id, currentPassword, newPassword, req.sessionID);
    res.json({ data: { success: true } });
  },
);

export default router;
