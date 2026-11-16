import { Router } from 'express';
import { query as q } from 'express-validator';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { query } from '../database/pool.js';
import { ROLES, STAFF_ROLES } from '../utils/constants.js';
import authRoutes from '../modules/auth/auth.routes.js';
import ticketRoutes from '../modules/tickets/tickets.routes.js';
import kbRoutes from '../modules/knowledge-base/kb.routes.js';
import aiRoutes from '../modules/ai/ai.routes.js';
import assetRoutes from '../modules/assets/assets.routes.js';
import reportRoutes from '../modules/reports/reports.routes.js';
import adminRoutes from '../modules/users/admin.routes.js';
import { getDashboard, getNotifications } from '../modules/dashboard/dashboard.service.js';
import { listDirectory } from '../modules/users/users.service.js';

const router = Router();

router.get('/health', async (_req, res) => {
  const started = Date.now();
  try {
    await query('SELECT 1');
    res.json({ data: { status: 'ok', database: 'ok', latencyMs: Date.now() - started, uptimeSeconds: Math.round(process.uptime()) } });
  } catch {
    res.status(503).json({ data: { status: 'degraded', database: 'unreachable' } });
  }
});

router.use('/auth', authRoutes);

// Everything below requires a signed-in user.
router.use(requireAuth);

router.get('/dashboard', async (req, res) => {
  res.json({ data: await getDashboard(req.user) });
});

router.get('/notifications', async (req, res) => {
  res.json({ data: await getNotifications(req.user) });
});

// People pickers (assignee, asset owner) — staff only.
router.get(
  '/users/directory',
  requireRole(...STAFF_ROLES),
  validate([q('roles').optional().isIn(['staff', 'all'])]),
  async (req, res) => {
    const roles = req.validated.query.roles === 'all' ? Object.values(ROLES) : STAFF_ROLES;
    res.json({ data: await listDirectory({ roles }) });
  },
);

router.use('/tickets', ticketRoutes);
router.use('/knowledge-base', kbRoutes);
router.use('/ai', aiRoutes);
router.use('/assets', assetRoutes);
router.use('/reports', requireRole(ROLES.ADMIN), reportRoutes);
router.use('/admin', requireRole(ROLES.ADMIN), adminRoutes);

export default router;
