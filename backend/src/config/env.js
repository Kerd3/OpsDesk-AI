import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Load the repository-level .env for local development. In Docker the
// variables are injected by docker compose, so the file is optional.
const rootEnv = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env');
if (existsSync(rootEnv) && !process.env.OPSDESK_SKIP_ENV_FILE) {
  process.loadEnvFile(rootEnv);
}

const str = (name, fallback = '') => (process.env[name] ?? fallback).trim();
const int = (name, fallback) => {
  const raw = process.env[name];
  const value = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(value) ? value : fallback;
};
const bool = (name, fallback = false) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
};

const nodeEnv = str('NODE_ENV', 'development');
const isTest = nodeEnv === 'test';
const isProduction = nodeEnv === 'production';

export const config = {
  nodeEnv,
  isTest,
  isProduction,
  port: int('PORT', 4000),
  databaseUrl: isTest ? str('TEST_DATABASE_URL') : str('DATABASE_URL'),
  session: {
    secret: str('SESSION_SECRET'),
    maxAgeMs: int('SESSION_MAX_AGE_HOURS', 8) * 60 * 60 * 1000,
    cookieSecure: bool('COOKIE_SECURE', isProduction),
  },
  // Number of reverse proxies in front of the API ("true" = 1). Needed so req.ip is the
  // real client (rate limiting) and HTTPS is detected for Secure cookies.
  trustProxy: /^\d+$/.test(str('TRUST_PROXY')) ? int('TRUST_PROXY', 0) : bool('TRUST_PROXY', false) ? 1 : 0,
  corsOrigins: str('CORS_ORIGINS', 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  appBaseUrl: str('APP_BASE_URL', 'http://localhost:5173').replace(/\/$/, ''),
  seedDemoPassword: str('SEED_DEMO_PASSWORD'),
  ai: {
    // The mock provider exists only for automated tests and cannot be enabled elsewhere.
    provider: isTest ? str('AI_PROVIDER', 'mock') : 'gemini',
    geminiApiKey: str('GEMINI_API_KEY'),
    geminiModel: str('GEMINI_MODEL'),
    timeoutMs: int('AI_TIMEOUT_MS', 20000),
    rateLimitPerMinute: int('AI_RATE_LIMIT_PER_MINUTE', 15),
    maxHistoryMessages: 10,
    maxMessageLength: 2000,
    maxContextArticles: 4,
    maxArticleChars: 3500,
  },
  webhook: {
    url: str('N8N_WEBHOOK_URL'),
    secret: str('N8N_WEBHOOK_SECRET'),
    timeoutMs: int('WEBHOOK_TIMEOUT_MS', 5000),
    maxAttempts: int('WEBHOOK_MAX_ATTEMPTS', 5),
    pollIntervalMs: int('WEBHOOK_POLL_INTERVAL_MS', 5000),
  },
  authRateLimit: {
    max: int('AUTH_RATE_LIMIT_MAX', 10),
    windowMs: int('AUTH_RATE_LIMIT_WINDOW_MINUTES', 15) * 60 * 1000,
  },
};

/** Fail fast on configuration that would make the server insecure or unusable. */
export function assertConfig() {
  const problems = [];
  if (!config.databaseUrl) problems.push(isTest ? 'TEST_DATABASE_URL is required' : 'DATABASE_URL is required');
  if (!config.session.secret || config.session.secret.length < 32) {
    problems.push('SESSION_SECRET must be set to at least 32 characters');
  }
  if (isProduction && !config.session.cookieSecure) {
    problems.push('COOKIE_SECURE must be true in production');
  }
  if (problems.length) {
    throw new Error(`Invalid configuration:\n - ${problems.join('\n - ')}`);
  }
}
