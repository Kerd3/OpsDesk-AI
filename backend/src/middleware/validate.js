import { validationResult, matchedData } from 'express-validator';
import { AppError } from '../utils/errors.js';

/**
 * Runs express-validator chains, rejects invalid requests with 422 and
 * replaces req.validated with only the fields that were declared and validated.
 * Handlers read input from req.validated so undeclared fields are ignored.
 */
export function validate(rules) {
  return [
    ...rules,
    (req, _res, next) => {
      const result = validationResult(req);
      if (!result.isEmpty()) {
        const details = result.array({ onlyFirstError: true }).map((e) => ({
          field: e.type === 'field' ? e.path : undefined,
          location: e.location,
          message: e.msg,
        }));
        return next(new AppError(422, 'VALIDATION_ERROR', 'Some fields are invalid', details));
      }
      req.validated = {
        body: matchedData(req, { locations: ['body'], includeOptionals: false }),
        query: matchedData(req, { locations: ['query'], includeOptionals: false }),
        params: matchedData(req, { locations: ['params'] }),
      };
      return next();
    },
  ];
}
