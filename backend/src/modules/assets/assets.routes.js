import { Router } from 'express';
import { body, query } from 'express-validator';
import { validate } from '../../middleware/validate.js';
import { requireRole } from '../../middleware/auth.js';
import { paginationRules } from '../../utils/pagination.js';
import { listQuery, nullableUuid, uuidParam } from '../../utils/validators.js';
import { ASSET_CATEGORIES, ASSET_CONDITIONS, ASSET_STATUSES, STAFF_ROLES } from '../../utils/constants.js';
import * as assets from './assets.service.js';

const router = Router();
const staffOnly = requireRole(...STAFF_ROLES);

// Optional free-text field: null or an empty string clears the value.
const optionalText = (field, max) =>
  body(field)
    .optional()
    .custom((v) => v === null || (typeof v === 'string' && v.trim().length <= max))
    .withMessage(`${field} must be text of at most ${max} characters`)
    .customSanitizer((v) => (typeof v === 'string' ? v.trim() || null : v));

const assetFields = (optional) => {
  const maybe = (chain) => (optional ? chain.optional() : chain);
  return [
    maybe(body('name').isString().trim().isLength({ min: 2, max: 150 }).withMessage('Name must be 2–150 characters')),
    maybe(body('category').isIn(ASSET_CATEGORIES).withMessage('Choose a valid category')),
    optionalText('manufacturer', 100),
    optionalText('model', 100),
    optionalText('serialNumber', 100),
    optionalText('location', 150),
    optionalText('notes', 5000),
    body('purchaseDate')
      .optional({ values: 'undefined' })
      .custom((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v) <= new Date()))
      .withMessage('Purchase date must be a past date in YYYY-MM-DD format'),
    body('condition').optional().isIn(ASSET_CONDITIONS),
    body('status').optional().isIn(ASSET_STATUSES),
    nullableUuid(body('assignedToId')),
  ];
};

router.get(
  '/',
  validate([
    ...paginationRules,
    listQuery('category', ASSET_CATEGORIES),
    listQuery('status', ASSET_STATUSES),
    query('assignedToId').optional().isUUID(),
    query('search').optional().isString().trim().isLength({ max: 100 }),
    query('sort').optional().isIn(['tag', 'name', 'purchased', 'updated']),
    query('order').optional().isIn(['asc', 'desc']),
  ]),
  async (req, res) => {
    const { items, meta } = await assets.listAssets(req.user, req.validated.query);
    res.json({ data: items, meta });
  },
);

router.post('/', staffOnly, validate(assetFields(false)), async (req, res) => {
  res.status(201).json({ data: await assets.createAsset(req.user, req.validated.body) });
});

router.get('/:id', validate([uuidParam()]), async (req, res) => {
  res.json({ data: await assets.getAsset(req.user, req.validated.params.id) });
});

router.patch('/:id', staffOnly, validate([uuidParam(), ...assetFields(true)]), async (req, res) => {
  res.json({ data: await assets.updateAsset(req.user, req.validated.params.id, req.validated.body) });
});

export default router;
