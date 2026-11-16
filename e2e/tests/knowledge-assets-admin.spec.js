import { test, expect } from '@playwright/test';
import { login, logout, unique } from './helpers.js';

test('IT staff write a draft article that employees only see after publishing', async ({ page }) => {
  const title = unique('How to pair a Bluetooth headset');

  await login(page, 'support');
  await page.goto('/knowledge-base');
  await page.getByRole('link', { name: 'New article' }).click();
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Summary').fill('Pair a company headset with a Windows laptop.');
  await page.getByLabel('Category').selectOption('hardware');
  await page.getByLabel('Tags').fill('bluetooth, headset');
  await page.getByLabel('Article content').fill('## Steps\n1. Open **Settings > Bluetooth & devices**.\n2. Choose Add device and select the headset.');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(page.getByText('Draft — not visible to employees')).toBeVisible();
  // Markdown is rendered as structured content.
  await expect(page.getByRole('heading', { level: 2, name: 'Steps' })).toBeVisible();
  const articleUrl = page.url();
  await logout(page);

  await login(page, 'employee');
  await page.goto(articleUrl);
  await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible();
  await logout(page);

  await login(page, 'support');
  await page.goto(articleUrl);
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByText(/Article published/)).toBeVisible();
  await logout(page);

  await login(page, 'employee');
  await page.goto('/knowledge-base');
  await page.getByLabel('Search articles').fill('bluetooth headset');
  await page.getByRole('link', { name: new RegExp(title) }).click();
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
});

test('IT staff register an asset, assign it, and the employee sees it', async ({ page }) => {
  const serial = `E2E-${Date.now()}`;
  await login(page, 'support');
  await page.goto('/assets');
  await page.getByRole('button', { name: 'Register asset' }).click();
  const dialog = page.getByRole('dialog', { name: 'Register asset' });
  await dialog.getByLabel('Asset name').fill('Jabra Evolve2 headset');
  await dialog.getByLabel('Category').selectOption('other');
  await dialog.getByLabel('Serial number').fill(serial);
  await dialog.getByLabel('Status').selectOption('assigned');
  await dialog.getByLabel('Assigned to').selectOption({ label: 'Sam Carter · Finance' });
  await dialog.getByRole('button', { name: 'Register asset' }).click();
  await expect(page.getByText(/AST-\d{4} registered/)).toBeVisible();
  await logout(page);

  await login(page, 'employee');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'My Equipment' }).click();
  await expect(page.getByRole('link', { name: 'Jabra Evolve2 headset' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Register asset' })).toHaveCount(0);
});

test('administrator reviews reports, users and the audit trail', async ({ page }) => {
  await login(page, 'admin');
  await page.goto('/reports');
  await expect(page.getByText('Tickets created', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tickets per IT staff member' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Jordan Reyes' })).toBeVisible();

  await page.goto('/admin/users');
  await page.getByLabel('Search users').fill('Carter');
  await expect(page).toHaveURL(/search=Carter/);
  await expect(page.getByText('employee@opsdesk.local', { exact: true })).toBeVisible();
  await expect(page.getByText('former.employee@opsdesk.local')).toHaveCount(0);

  await page.goto('/admin/audit-logs?action=ticket.created');
  await expect(page.locator('tbody tr').first()).toContainText('ticket.created');
  await page.locator('tbody tr').first().click();
  await expect(page.getByRole('dialog', { name: 'Audit entry' })).toContainText('ticketNumber');
});
