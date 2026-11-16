import { expect } from '@playwright/test';

// Local-only password used to seed the throwaway E2E test database.
export const E2E_PASSWORD = 'E2E-Demo-Password-2026';

export const USERS = {
  admin: 'admin@opsdesk.local',
  support: 'support@opsdesk.local',
  employee: 'employee@opsdesk.local',
  employee2: 'employee2@opsdesk.local',
};

export async function login(page, who) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(USERS[who]);
  await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Good (morning|afternoon|evening)/);
}

export async function logout(page) {
  await page.getByRole('button', { name: /account menu/ }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

export const unique = (label) => `${label} ${Date.now().toString(36)}`;
