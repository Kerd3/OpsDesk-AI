import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../../middleware/validate.js';
import { paginationRules } from '../../utils/pagination.js';
import { listQuery, nullableUuid, dateQuery } from '../../utils/validators.js';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from '../../utils/constants.js';
import * as tickets from './tickets.service.js';

const router = Router();

// Ticket routes accept either the UUID or the readable number (OPS-2026-0001).
const ticketIdParam = () => param('id')
  .trim()
  .matches(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|OPS-\d{4}-\d{4,})$/i)
  .withMessage('Invalid ticket identifier')
  .customSanitizer((v) => (v.toUpperCase().startsWith('OPS-') ? v.toUpperCase() : v.toLowerCase()));

const subject = () => body('subject').isString().trim().isLength({ min: 3, max: 200 }).withMessage('Subject must be 3–200 characters');
const description = () => body('description').isString().trim().isLength({ min: 10, max: 10000 }).withMessage('Description must be 10–10,000 characters');

router.get(
  '/',
  validate([
    ...paginationRules,
    query('scope').optional().isIn(['all', 'mine', 'assigned', 'unassigned']),
    listQuery('status', TICKET_STATUSES),
    listQuery('priority', TICKET_PRIORITIES),
    listQuery('category', TICKET_CATEGORIES),
    query('assigneeId').optional().isUUID(),
    query('requesterId').optional().isUUID(),
    dateQuery('from'),
    dateQuery('to'),
    query('search').optional().isString().trim().isLength({ max: 200 }),
    query('sort').optional().isIn(['created', 'updated', 'number', 'priority', 'status']),
    query('order').optional().isIn(['asc', 'desc']),
  ]),
  async (req, res) => {
    const { items, meta } = await tickets.listTickets(req.user, req.validated.query);
    res.json({ data: items, meta });
  },
);

router.post(
  '/',
  validate([
    subject(),
    description(),
    body('category').isIn(TICKET_CATEGORIES).withMessage('Choose a valid category'),
    body('priority').optional().isIn(TICKET_PRIORITIES).withMessage('Choose a valid priority'),
    body('source').optional().isIn(['portal', 'ai_assist']),
    body('requesterId').optional().isUUID(),
  ]),
  async (req, res) => {
    const ticket = await tickets.createTicket(req.user, req.validated.body);
    res.status(201).json({ data: ticket });
  },
);

router.get('/:id', validate([ticketIdParam()]), async (req, res) => {
  res.json({ data: await tickets.getTicket(req.user, req.validated.params.id) });
});

router.patch(
  '/:id',
  validate([
    ticketIdParam(),
    subject().optional(),
    description().optional(),
    body('category').optional().isIn(TICKET_CATEGORIES),
    body('priority').optional().isIn(TICKET_PRIORITIES),
    body('status').optional().isIn(TICKET_STATUSES),
    nullableUuid(body('assigneeId')),
  ]),
  async (req, res) => {
    res.json({ data: await tickets.updateTicket(req.user, req.validated.params.id, req.validated.body) });
  },
);

router.post(
  '/:id/comments',
  validate([
    ticketIdParam(),
    body('body').isString().trim().isLength({ min: 1, max: 5000 }).withMessage('Comment must be 1–5,000 characters'),
    body('isInternal').optional().isBoolean({ strict: true }).withMessage('isInternal must be true or false').toBoolean(true),
  ]),
  async (req, res) => {
    const comment = await tickets.addComment(req.user, req.validated.params.id, req.validated.body);
    res.status(201).json({ data: comment });
  },
);

router.get('/:id/activity', validate([ticketIdParam()]), async (req, res) => {
  res.json({ data: await tickets.getTicketActivity(req.user, req.validated.params.id) });
});

export default router;
