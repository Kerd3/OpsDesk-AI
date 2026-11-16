import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];

const PAGES = {
  admin: ['/', '/tickets', '/tickets/new', '/knowledge-base', '/knowledge-base/connect-to-office-wifi', '/knowledge-base/new', '/assets', '/reports', '/admin/users', '/admin/audit-logs', '/settings?tab=integrations', '/profile'],
  employee: ['/', '/my-tickets', '/assistant', '/assets'],
};

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name} ${vp.width}px`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const [role, paths] of Object.entries(PAGES)) {
      test(`${role} pages have no horizontal overflow`, async ({ page }) => {
        await login(page, role);
        for (const path of paths) {
          await page.goto(path);
          await page.waitForLoadState('networkidle');
          const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
          expect(scrollWidth, `${path} overflows at ${vp.width}px`).toBeLessThanOrEqual(innerWidth);
        }
      });
    }

    if (vp.width < 1024) {
      test('mobile navigation drawer opens and navigates', async ({ page }) => {
        await login(page, 'employee');
        await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
        await page.getByRole('button', { name: 'Open navigation' }).click();
        await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Knowledge Base' }).click();
        await expect(page.getByRole('heading', { level: 1, name: 'Knowledge base' })).toBeVisible();
        await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
      });
    }
  });
}
