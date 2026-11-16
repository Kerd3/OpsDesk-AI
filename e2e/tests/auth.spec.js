import { test, expect } from '@playwright/test';
import { login, logout, USERS } from './helpers.js';

test('anonymous visitors are redirected to the login page', async ({ page }) => {
  await page.goto('/tickets');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible();
});

test('invalid credentials show an error and do not sign in', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(USERS.employee);
  await page.getByLabel('Password', { exact: true }).fill('definitely-wrong-1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('Invalid email or password');
  await expect(page).toHaveURL(/\/login$/);
});

test('client-side validation for missing credentials', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Email is required')).toBeVisible();
  await expect(page.getByText('Password is required')).toBeVisible();
});

test('employee navigation hides staff and admin areas', async ({ page }) => {
  await login(page, 'employee');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link', { name: 'My Tickets' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'My Equipment' })).toBeVisible();
  for (const hidden of ['All Tickets', 'Reports', 'User Management', 'Audit Logs']) {
    await expect(nav.getByRole('link', { name: hidden })).toHaveCount(0);
  }
  // Typing an admin URL directly shows a restriction instead of data.
  await page.goto('/reports');
  await expect(page.getByText('Access restricted')).toBeVisible();
});

test('administrator sees every section and can sign out', async ({ page }) => {
  await login(page, 'admin');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  for (const name of ['Dashboard', 'All Tickets', 'AI Assistant', 'Knowledge Base', 'IT Assets', 'Reports', 'User Management', 'Audit Logs', 'Settings']) {
    await expect(nav.getByRole('link', { name })).toBeVisible();
  }
  await expect(page.getByText('Total employees')).toBeVisible();
  await logout(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
});
