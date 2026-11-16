import { Router } from 'express';
import { query } from 'express-validator';
import { validate } from '../../middleware/validate.js';
import { dateQuery } from '../../utils/validators.js';
import * as reports from './reports.service.js';

const router = Router();
const rangeRules = [dateQuery('from'), dateQuery('to')];

router.get('/summary', validate(rangeRules), async (req, res) => {
  res.json({ data: await reports.getSummary(req.validated.query) });
});

router.get('/tickets', validate([...rangeRules, query('interval').optional().isIn(['day', 'week', 'month'])]), async (req, res) => {
  res.json({ data: await reports.getTicketReport(req.validated.query) });
});

export default router;
