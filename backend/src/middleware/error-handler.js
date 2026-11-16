import { AppError } from '../utils/errors.js';

// Map PostgreSQL error codes to safe client responses.
const PG_ERRORS = {
  '23505': [409, 'CONFLICT', 'A record with the same unique value already exists'],
  '23503': [409, 'CONFLICT', 'The request references a record that does not exist or is still in use'],
  '23514': [422, 'VALIDATION_ERROR', 'One or more values are not allowed'],
  '22P02': [400, 'BAD_REQUEST', 'Invalid identifier or value format'],
};

export function notFoundHandler(req, _res, next) {
  next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = 500;
  let body = { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred. Please try again later.' };

  if (err instanceof AppError) {
    status = err.status;
    body = { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) };
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    body = { code: 'BAD_REQUEST', message: 'Malformed JSON body' };
  } else if (err.type === 'entity.too.large') {
    status = 413;
    body = { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' };
  } else if (err.code && PG_ERRORS[err.code]) {
    const [s, code, message] = PG_ERRORS[err.code];
    status = s;
    body = { code, message };
  }

  if (status >= 500) {
    // Full details stay in server logs; clients only see the generic message.
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  }
  res.status(status).json({ error: body });
}
