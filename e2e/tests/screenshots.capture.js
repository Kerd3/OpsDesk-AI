// Captures the README screenshots. Run with: npm run screenshots (not part of the test suite).
import { test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { login, logout } from './helpers.js';

const out = (name) => path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/screenshots', `${name}.png`);
const settle = (page) => page.waitForLoadState('networkidle').then(() => page.waitForTimeout(1200)); // let charts finish animating

test.use({ viewport: { width: 1440, height: 900 } });

test('capture documentation screenshots', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/login');
  await page.screenshot({ path: out('01-login') });

  await login(page, 'admin');
  await settle(page);
  await page.screenshot({ path: out('02-admin-dashboard'), fullPage: true });

  await page.goto('/tickets');
  await settle(page);
  await page.screenshot({ path: out('03-ticket-list') });

  const year = new Date().getUTCFullYear();
  await page.goto(`/tickets/OPS-${year}-0001`);
  await settle(page);
  await page.screenshot({ path: out('04-ticket-details'), fullPage: true });

  await page.goto('/reports');
  await settle(page);
  await page.screenshot({ path: out('05-reports'), fullPage: true });

  await page.goto('/knowledge-base');
  await settle(page);
  await page.screenshot({ path: out('06-knowledge-base') });

  await page.goto('/assets');
  await settle(page);
  await page.screenshot({ path: out('07-assets') });

  await page.goto('/settings?tab=integrations');
  await settle(page);
  await page.screenshot({ path: out('08-integrations'), fullPage: true });
  await logout(page);

  await login(page, 'employee');
  await settle(page);
  await page.screenshot({ path: out('09-employee-dashboard'), fullPage: true });
  // 10-ai-assistant.png shows a real Gemini answer, so it is captured from the running
  // app instead (see scripts/capture-live-assistant.js); the test stack uses a mock AI.

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/my-tickets');
  await settle(page);
  await page.screenshot({ path: out('11-mobile-tickets') });
});
