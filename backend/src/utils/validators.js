import { param, query } from 'express-validator';

/** Accepts `a,b,c` or repeated query params and returns a de-duplicated array of allowed values. */
export const listQuery = (field, allowed) =>
  query(field)
    .optional()
    .customSanitizer((value) => {
      const values = (Array.isArray(value) ? value : String(value).split(',')).map((v) => String(v).trim()).filter(Boolean);
      return [...new Set(values)];
    })
    .custom((values) => values.every((v) => allowed.includes(v)))
    .withMessage(`Allowed values: ${allowed.join(', ')}`);

export const uuidParam = (name = 'id') => param(name).isUUID().withMessage('Invalid identifier');

/** UUID or null (null clears the relation). `undefined` means "not provided". */
export const nullableUuid = (chain) =>
  chain.optional().custom((v) => v === null || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)).withMessage('Must be a valid id or null');

export const dateQuery = (field) => query(field).optional().isISO8601({ strict: true }).withMessage('Use the YYYY-MM-DD format');
