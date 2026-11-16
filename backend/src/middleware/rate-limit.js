import { rateLimit } from 'express-rate-limit';
import { config } from '../config/env.js';

const rateLimitedResponse = (message) => (_req, res, _next, options) =>
  res.status(options.statusCode).json({ error: { code: 'RATE_LIMITED', message } });

/** Brute-force protection for sign-in (per client IP). */
export const authRateLimiter = rateLimit({
  windowMs: config.authRateLimit.windowMs,
  limit: config.authRateLimit.max,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Successful sign-ins do not count against the limit.
  skipSuccessfulRequests: true,
  handler: rateLimitedResponse('Too many sign-in attempts. Please wait a few minutes and try again.'),
});

/** Caps AI requests per signed-in user to control provider cost and abuse. */
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.ai.rateLimitPerMinute,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => `ai:${req.user.id}`,
  handler: rateLimitedResponse('You are sending messages too quickly. Please wait a moment.'),
});

/** General ceiling for the whole API. */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.isTest ? 10000 : 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: rateLimitedResponse('Too many requests. Please slow down.'),
});
