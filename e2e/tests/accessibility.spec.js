import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login } from './helpers.js';

// Automated WCAG 2.1 A/AA scan (axe-core) of every page, in the states users actually see.
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Each test scans many pages and a full axe run takes a few seconds per page,
// so the default 30 s per-test budget is too tight.
test.describe.configure({ timeout: 90_000 });

async function scan(page, label) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600); // let charts and transitions settle
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const summary = violations.map((v) => `${v.id} (${v.impact}, ${v.nodes.length}x): ${v.help}\n      e.g. ${v.nodes[0].target.join(' ')}`);
  // Soft assertion: report every page's violations, not just the first failing page.
  expect.soft(summary, `${label} has accessibility violations`).toEqual([]);
}

const year = new Date().getUTCFullYear();

test('sign-in page', async ({ page }) => {
  await page.goto('/login');
  await scan(page, '/login');
  // Error state too.
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Email is required')).toBeVisible();
  await scan(page, '/login (validation errors)');
});

test('employee pages', async ({ page }) => {
  await login(page, 'employee');
  for (const path of ['/', '/my-tickets', `/tickets/OPS-${year}-0001`, '/tickets/new', '/knowledge-base', '/knowledge-base/connect-to-office-wifi', '/assets', '/profile', '/settings']) {
    await page.goto(path);
    await scan(page, path);
  }
  // Assistant with an answer and its source links visible.
  await page.goto('/assistant');
  await scan(page, '/assistant (empty)');
  await page.getByRole('button', { name: "Why can't my computer connect to Wi-Fi?" }).click();
  await expect(page.getByRole('button', { name: 'Create ticket from chat' })).toBeVisible();
  await scan(page, '/assistant (with answer)');
  // Notification menu and user menu open.
  await page.getByRole('button', { name: /^Notifications/ }).click();
  await scan(page, 'notifications menu');
});

test('staff and administrator pages', async ({ page }) => {
  await login(page, 'admin');
  for (const path of ['/', '/tickets', `/tickets/OPS-${year}-0001`, '/knowledge-base/new', '/assets', '/reports', '/admin/users', '/admin/audit-logs', '/settings?tab=integrations']) {
    await page.goto(path);
    await scan(page, path);
  }
  await page.goto('/assets');
  await page.getByRole('button', { name: 'Register asset' }).click();
  await expect(page.getByRole('dialog', { name: 'Register asset' })).toBeVisible();
  await scan(page, 'register asset dialog');
});

test('mobile navigation drawer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'employee');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await scan(page, 'mobile navigation');
});
