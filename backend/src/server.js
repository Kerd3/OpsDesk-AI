import { config, assertConfig } from './config/env.js';
import { createApp } from './app.js';
import { pool } from './database/pool.js';
import { startWebhookWorker, stopWebhookWorker, isWebhookConfigured } from './modules/integrations/webhook.service.js';
import { getAiProvider } from './modules/ai/ai.provider.js';

assertConfig();

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`[api] OpsDesk AI API listening on port ${config.port} (${config.nodeEnv})`);
  console.log(`[api] AI assistant: ${getAiProvider().isConfigured() ? `configured (${config.ai.geminiModel})` : 'NOT configured — set GEMINI_API_KEY and GEMINI_MODEL'}`);
  console.log(`[api] n8n webhooks: ${isWebhookConfigured() ? 'configured' : 'not configured — events are recorded as skipped'}`);
  startWebhookWorker();
});

async function shutdown(signal) {
  console.log(`[api] ${signal} received, shutting down`);
  stopWebhookWorker();
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
