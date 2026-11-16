import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../../middleware/validate.js';
import { aiRateLimiter } from '../../middleware/rate-limit.js';
import { config } from '../../config/env.js';
import * as ai from './ai.service.js';

const router = Router();
const { maxMessageLength } = config.ai;

const historyRules = (field, { min = 0 } = {}) => [
  body(field).optional({ values: 'undefined' }).isArray({ min, max: 30 }).withMessage(`${field} must be a list of at most 30 messages`),
  body(`${field}.*.role`).isIn(['user', 'assistant']).withMessage('Message role must be user or assistant'),
  body(`${field}.*.content`).isString().trim().isLength({ min: 1, max: maxMessageLength * 2 }).withMessage('Message content is invalid'),
];

router.get('/status', async (_req, res) => {
  res.json({ data: await ai.getAiStatus() });
});

router.post(
  '/chat',
  aiRateLimiter,
  validate([
    body('message').isString().withMessage('Message is required').bail().trim().isLength({ min: 2, max: maxMessageLength }).withMessage(`Message must be 2–${maxMessageLength} characters`),
    ...historyRules('history'),
  ]),
  async (req, res) => {
    res.json({ data: await ai.chat(req.user, req.validated.body) });
  },
);

router.post(
  '/ticket-assist',
  aiRateLimiter,
  validate([body('messages').exists().withMessage('messages is required'), ...historyRules('messages', { min: 1 })]),
  async (req, res) => {
    res.json({ data: await ai.draftTicket(req.user, req.validated.body) });
  },
);

export default router;
