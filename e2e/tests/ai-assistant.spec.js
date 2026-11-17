import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

// The API runs with NODE_ENV=test, so answers come from the deterministic mock
// provider. Retrieval, grounding checks and citations are the real implementation.

test('assistant answers from the knowledge base with source links, and drafts a reviewable ticket', async ({ page }) => {
  await login(page, 'employee');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'AI Assistant' }).click();
  await page.getByRole('button', { name: "Why can't my computer connect to Wi-Fi?" }).click();

  const answer = page.locator('main').getByText('Based on the knowledge base articles provided');
  await expect(answer).toBeVisible();
  // The answer's numbered source link ("1 How to connect…").
  const source = page.getByRole('link', { name: /^1 How to connect to the office Wi-Fi/ });
  await expect(source).toBeVisible();
  await expect(source).toHaveAttribute('href', '/knowledge-base/connect-to-office-wifi');

  // The side panel lists the articles the AI was given, and which one it cited.
  const searched = page.getByRole('complementary', { name: 'How the answer was found' });
  const wifiEntry = searched.getByRole('listitem').filter({ hasText: 'How to connect to the office Wi-Fi' });
  await expect(wifiEntry).toContainText('Cited in the answer');

  // Draft a ticket from the conversation: nothing is submitted until the employee confirms.
  await page.getByRole('button', { name: 'Create ticket from chat' }).click();
  const dialog = page.getByRole('dialog', { name: 'Review your ticket' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Category')).toHaveValue('network');
  await dialog.getByLabel('Subject').fill('Laptop cannot join HV-Corp Wi-Fi after restart');
  await dialog.getByRole('button', { name: 'Submit ticket' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Laptop cannot join HV-Corp Wi-Fi after restart' })).toBeVisible();
  await expect(page.getByText('Drafted with AI')).toBeVisible();
});

test('assistant is honest when the knowledge base has no answer', async ({ page }) => {
  await login(page, 'employee');
  await page.goto('/assistant');
  await page.getByLabel('Message the AI assistant').fill("What is the company's parental leave policy?");
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText(/couldn't find a published knowledge base article/)).toBeVisible();
  await expect(page.getByText('IT support recommended')).toBeVisible();
  await expect(page.getByText('Sources', { exact: true })).toHaveCount(0);
});

test('administrator can disable the assistant and users see a clear message', async ({ page }) => {
  await login(page, 'admin');
  await page.goto('/settings?tab=integrations');
  const toggle = page.getByRole('switch', { name: 'Enable assistant for all users' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(page.getByText('AI assistant disabled')).toBeVisible();

  await page.goto('/assistant');
  await expect(page.getByText('The AI assistant is turned off')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create a support ticket' })).toBeVisible();

  await page.goto('/settings?tab=integrations');
  await page.getByRole('switch', { name: 'Enable assistant for all users' }).click();
  await expect(page.getByText('AI assistant enabled')).toBeVisible();
});
