import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../../middleware/validate.js';
import { requireRole } from '../../middleware/auth.js';
import { paginationRules } from '../../utils/pagination.js';
import { uuidParam } from '../../utils/validators.js';
import { KB_STATUSES, TICKET_CATEGORIES, STAFF_ROLES } from '../../utils/constants.js';
import * as kb from './kb.service.js';

const router = Router();
const staffOnly = requireRole(...STAFF_ROLES);

const articleFields = (optional) => {
  const maybe = (chain) => (optional ? chain.optional() : chain);
  return [
    maybe(body('title').isString().trim().isLength({ min: 3, max: 200 }).withMessage('Title must be 3–200 characters')),
    body('description').optional().isString().trim().isLength({ max: 500 }).withMessage('Summary must be at most 500 characters'),
    maybe(body('content').isString().trim().isLength({ min: 20, max: 50000 }).withMessage('Content must be 20–50,000 characters')),
    maybe(body('category').isIn(TICKET_CATEGORIES).withMessage('Choose a valid category')),
    body('tags').optional().isArray({ max: 15 }).withMessage('Use at most 15 tags'),
    body('tags.*').optional().isString().trim().isLength({ min: 1, max: 40 }),
    body('status').optional().isIn(KB_STATUSES),
    body('slug')
      .optional()
      .isString()
      .trim()
      .toLowerCase()
      .matches(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .withMessage('Slug may contain lowercase letters, numbers and hyphens'),
  ];
};

router.get(
  '/',
  validate([
    ...paginationRules,
    query('search').optional().isString().trim().isLength({ max: 200 }),
    query('category').optional().isIn(TICKET_CATEGORIES),
    query('status').optional().isIn(KB_STATUSES),
    query('tag').optional().isString().trim().isLength({ max: 40 }),
    query('sort').optional().isIn(['recent', 'popular', 'title']),
  ]),
  async (req, res) => {
    const { items, meta } = await kb.listArticles(req.user, req.validated.query);
    res.json({ data: items, meta });
  },
);

router.get('/tags', async (_req, res) => {
  res.json({ data: await kb.listTags() });
});

router.get(
  '/:id',
  validate([
    param('id').isString().trim().isLength({ min: 1, max: 120 }).matches(/^[a-zA-Z0-9-]+$/).withMessage('Invalid article identifier'),
    query('view').optional().isIn(['0', '1']),
  ]),
  async (req, res) => {
    // The editor loads with view=0 so editing does not inflate view counts.
    const countView = req.validated.query.view !== '0';
    res.json({ data: await kb.getArticle(req.user, req.validated.params.id, { countView }) });
  },
);

router.post('/', staffOnly, validate(articleFields(false)), async (req, res) => {
  res.status(201).json({ data: await kb.createArticle(req.user, req.validated.body) });
});

router.patch('/:id', staffOnly, validate([uuidParam(), ...articleFields(true)]), async (req, res) => {
  res.json({ data: await kb.updateArticle(req.user, req.validated.params.id, req.validated.body) });
});

router.delete(
  '/:id',
  staffOnly,
  validate([uuidParam(), query('permanent').optional().isIn(['true', 'false'])]),
  async (req, res) => {
    const permanent = req.validated.query.permanent === 'true';
    res.json({ data: await kb.deleteArticle(req.user, req.validated.params.id, { permanent }) });
  },
);

export default router;
