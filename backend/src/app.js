import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config/env.js';
import { pool } from './database/pool.js';
import { csrfProtection } from './middleware/csrf.js';
import { apiRateLimiter } from './middleware/rate-limit.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { SESSION_COOKIE } from './modules/auth/auth.routes.js';
import apiRoutes from './routes/index.js';

const PgSession = connectPgSimple(session);

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);

  // The API serves JSON only, so the strictest CSP is safe here.
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
    }),
  );
  app.use(express.json({ limit: '200kb' }));

  app.use(
    session({
      name: SESSION_COOKIE,
      store: new PgSession({ pool, tableName: 'session', createTableIfMissing: false, pruneSessionInterval: config.isTest ? false : 15 * 60 }),
      secret: config.session.secret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.session.cookieSecure,
        maxAge: config.session.maxAgeMs,
      },
    }),
  );

  app.use('/api', apiRateLimiter, csrfProtection, apiRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
