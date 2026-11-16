// Captures docs/screenshots/10-ai-assistant.png from a RUNNING OpsDesk instance with a real
// GEMINI_API_KEY (e.g. the Docker app), so the README shows a genuine grounded answer.
//
//   BASE_URL=http://localhost:8080 DEMO_PASSWORD=<SEED_DEMO_PASSWORD> node scripts/capture-live-assistant.js
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const baseUrl = process.env.BASE_URL ?? 'http://localhost:8080';
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/screenshots/10-ai-assistant.png');
if (!process.env.DEMO_PASSWORD) throw new Error('Set DEMO_PASSWORD to the SEED_DEMO_PASSWORD of the running instance');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${baseUrl}/login`);
await page.getByLabel('Email address').fill('employee@opsdesk.local');
await page.getByLabel('Password', { exact: true }).fill(process.env.DEMO_PASSWORD);
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL(`${baseUrl}/`);
await page.goto(`${baseUrl}/assistant`);
const status = await page.evaluate(() => fetch('/api/ai/status').then((r) => r.json()));
if (!status.data.available || status.data.provider !== 'gemini') throw new Error(`Gemini is not available: ${JSON.stringify(status.data)}`);

await page.getByLabel('Message the AI assistant').fill("My laptop won't connect to the office Wi-Fi since this morning");
await page.getByRole('button', { name: 'Send message' }).click();
await page.getByRole('button', { name: 'Create ticket from chat' }).waitFor({ timeout: 30_000 });
await page.waitForTimeout(800);
await page.screenshot({ path: out });
console.log(`saved ${out} (model: ${status.data.model})`);
await browser.close();
