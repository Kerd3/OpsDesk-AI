import { test, expect } from '@playwright/test';
import { login, logout, unique } from './helpers.js';

test('full ticket lifecycle across employee and IT support', async ({ page }) => {
  const subject = unique('Docking station not detecting monitors');

  // 1. Employee creates a ticket.
  await login(page, 'employee');
  await page.getByRole('link', { name: 'New ticket' }).first().click();
  await page.getByLabel('Subject').fill(subject);
  await page.getByLabel('Category').selectOption('hardware');
  await page.getByLabel('Priority').selectOption('high');
  await page.getByLabel('Description').fill('Neither external monitor turns on when I connect the dock this morning.');
  await page.getByRole('button', { name: 'Submit ticket' }).click();

  await expect(page.getByRole('heading', { level: 1, name: subject })).toBeVisible();
  await expect(page.getByText(/Ticket OPS-\d{4}-\d{4} created/)).toBeVisible();
  const ticketUrl = page.url();
  await logout(page);

  // 2. IT support accepts it, adds an internal note and a public reply.
  await login(page, 'support');
  await page.goto(ticketUrl);
  await page.getByRole('button', { name: 'Accept ticket' }).click();
  await expect(page.getByRole('combobox', { name: 'Status' })).toHaveValue('in_progress');

  await page.getByRole('radio', { name: 'Internal note' }).click();
  await page.getByLabel('Internal note').fill('Dock firmware 1.2 is known to be faulty.');
  await page.getByRole('button', { name: 'Add note' }).click();
  await expect(page.getByText('Internal note added')).toBeVisible();

  await page.getByRole('radio', { name: 'Public reply' }).click();
  await page.getByLabel('Reply').fill('Please try the other USB-C port while I prepare a replacement dock.');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Reply sent')).toBeVisible();

  await page.getByRole('combobox', { name: 'Status' }).selectOption('resolved');
  await expect(page.getByText('Ticket updated').first()).toBeVisible();
  await logout(page);

  // 3. Employee sees the reply but never the internal note, then confirms the fix.
  await login(page, 'employee');
  await page.goto(ticketUrl);
  await expect(page.getByText('Please try the other USB-C port')).toBeVisible();
  await expect(page.getByText('Dock firmware 1.2 is known to be faulty.')).toHaveCount(0);
  await expect(page.getByText('IT marked this ticket as resolved')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm resolved' }).click();
  await expect(page.locator('main').getByText('Closed').first()).toBeVisible();

  // Activity history records the lifecycle (without internal entries).
  await page.getByRole('tab', { name: /Activity/ }).click();
  await expect(page.getByText(/created the ticket/)).toBeVisible();
  await expect(page.getByText(/changed status from Resolved to Closed/)).toBeVisible();
  await expect(page.getByText(/added an internal note/)).toHaveCount(0);
});

test("an employee cannot open another employee's ticket by URL", async ({ page }) => {
  await login(page, 'employee2');
  // OPS-xxxx-0001 belongs to Sam Carter in the seed data.
  const year = new Date().getUTCFullYear();
  await page.goto(`/tickets/OPS-${year}-0001`);
  await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible();
  await expect(page.getByText('Laptop cannot connect to HV-Corp Wi-Fi')).toHaveCount(0);
});

test('ticket list search and filters', async ({ page }) => {
  await login(page, 'admin');
  await page.goto('/tickets');
  await page.getByLabel('Search tickets').fill('warehouse');
  await expect(page.getByRole('link', { name: 'Whole warehouse lost network connection' })).toBeVisible();
  await expect(page).toHaveURL(/search=warehouse/);

  await page.getByLabel('Search tickets').fill('');
  await page.getByLabel('Priority').selectOption('urgent');
  await expect(page).toHaveURL(/priority=urgent/);
  const rows = page.locator('tbody tr');
  await expect(rows.first()).toContainText('Urgent');
  await expect(rows.filter({ hasNotText: 'Urgent' })).toHaveCount(0);
});
