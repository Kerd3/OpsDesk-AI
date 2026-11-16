import { Router } from 'express';
import { body, query } from 'express-validator';
import { validate } from '../../middleware/validate.js';
import { paginationRules } from '../../utils/pagination.js';
import { uuidParam, dateQuery } from '../../utils/validators.js';
import { ROLE_VALUES, WEBHOOK_EVENTS } from '../../utils/constants.js';
import * as users from './users.service.js';
import * as audit from '../audit/audit.service.js';
import * as integrations from '../integrations/integrations.service.js';
import * as settings from '../settings/settings.service.js';

// Every route in this router is mounted behind requireRole('admin').
const router = Router();

const passwordRule = (chain) =>
  chain
    .isString()
    .isLength({ min: 10, max: 200 })
    .withMessage('Password must be at least 10 characters')
    .matches(/[A-Za-z]/)
    .withMessage('Password must contain a letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain a number');

// ----- Users -----------------------------------------------------------------
router.get(
  '/users',
  validate([
    ...paginationRules,
    query('role').optional().isIn(ROLE_VALUES),
    query('status').optional().isIn(['active', 'inactive']),
    query('search').optional().isString().trim().isLength({ max: 100 }),
  ]),
  async (req, res) => {
    const { items, meta } = await users.listUsers(req.validated.query);
    res.json({ data: items, meta });
  },
);

router.post(
  '/users',
  validate([
    body('email').isEmail().withMessage('Enter a valid email address').normalizeEmail({ gmail_remove_dots: false }),
    body('fullName').isString().trim().isLength({ min: 2, max: 120 }).withMessage('Full name must be 2–120 characters'),
    body('role').isIn(ROLE_VALUES).withMessage('Choose a valid role'),
    body('department').optional().isString().trim().isLength({ max: 120 }),
    body('jobTitle').optional().isString().trim().isLength({ max: 120 }),
    passwordRule(body('password')),
  ]),
  async (req, res) => {
    res.status(201).json({ data: await users.createUser(req.validated.body, req.user.id) });
  },
);

router.patch(
  '/users/:id',
  validate([
    uuidParam(),
    body('fullName').optional().isString().trim().isLength({ min: 2, max: 120 }),
    body('role').optional().isIn(ROLE_VALUES),
    body('department').optional().isString().trim().isLength({ max: 120 }),
    body('jobTitle').optional().isString().trim().isLength({ max: 120 }),
    body('isActive').optional().isBoolean({ strict: true }).toBoolean(true),
    passwordRule(body('password').optional()),
  ]),
  async (req, res) => {
    res.json({ data: await users.updateUser(req.validated.params.id, req.validated.body, req.user) });
  },
);

// ----- Audit logs --------------------------------------------------------------
router.get(
  '/audit-logs',
  validate([
    ...paginationRules,
    query('action').optional().isString().trim().isLength({ max: 80 }),
    query('resourceType').optional().isString().trim().isLength({ max: 40 }),
    query('actorId').optional().isUUID(),
    query('search').optional().isString().trim().isLength({ max: 100 }),
    dateQuery('from'),
    dateQuery('to'),
  ]),
  async (req, res) => {
    const { items, meta } = await audit.listAuditLogs(req.validated.query);
    res.json({ data: items, meta });
  },
);

router.get('/audit-logs/actions', async (_req, res) => {
  res.json({ data: await audit.listAuditActions() });
});

// ----- Integrations & settings ----------------------------------------------
router.get('/integrations', async (_req, res) => {
  res.json({ data: await integrations.getIntegrationStatus() });
});

router.get(
  '/integrations/deliveries',
  validate([
    ...paginationRules,
    query('status').optional().isIn(['pending', 'delivering', 'delivered', 'failed', 'skipped']),
    query('eventType').optional().isString().isLength({ max: 60 }),
  ]),
  async (req, res) => {
    const { items, meta } = await integrations.listDeliveries(req.validated.query);
    res.json({ data: items, meta });
  },
);

router.post('/integrations/deliveries/:id/retry', validate([uuidParam()]), async (req, res) => {
  res.json({ data: await integrations.retryDelivery(req.validated.params.id, req.user.id) });
});

router.post('/integrations/test', async (req, res) => {
  res.json({ data: await integrations.sendTestEvent(req.user.id) });
});

router.get('/settings', async (_req, res) => {
  res.json({ data: await settings.getAllSettings() });
});

router.patch(
  '/settings/notifications',
  validate([
    body('enabled').optional().isBoolean({ strict: true }).toBoolean(true),
    body('events').optional().isObject(),
    ...WEBHOOK_EVENTS.map((e) => body(`events.${e.replace('.', '\\.')}`).optional().isBoolean({ strict: true }).toBoolean(true)),
  ]),
  async (req, res) => {
    const patch = {};
    if (req.body.enabled !== undefined) patch.enabled = req.validated.body.enabled;
    // Only known event keys are stored.
    if (req.body.events) {
      patch.events = Object.fromEntries(WEBHOOK_EVENTS.filter((e) => typeof req.body.events[e] === 'boolean').map((e) => [e, req.body.events[e]]));
    }
    res.json({ data: await settings.updateSetting('notifications', patch, req.user.id) });
  },
);

router.patch('/settings/ai', validate([body('enabled').isBoolean({ strict: true }).toBoolean(true)]), async (req, res) => {
  res.json({ data: await settings.updateSetting('ai', { enabled: req.validated.body.enabled }, req.user.id) });
});

export default router;
