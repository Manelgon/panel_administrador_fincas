import { test, expect } from '@playwright/test';

test.describe('Panel — Smoke Tests', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/');
    // Should redirect to login or show dashboard
    await expect(page).toHaveURL(/\/(login|dashboard)/);
  });

  test('dashboard loads after auth', async ({ page }) => {
    // This test requires env vars PLAYWRIGHT_EMAIL / PLAYWRIGHT_PASSWORD
    const email = process.env.PLAYWRIGHT_EMAIL;
    const password = process.env.PLAYWRIGHT_PASSWORD;

    if (!email || !password) {
      test.skip();
      return;
    }

    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });

    await expect(page.locator('nav')).toBeVisible();
  });

  test('navbar is responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/dashboard');
    // Nav should still be present and not overflow
    const nav = page.locator('nav[aria-label="Panel de control"]');
    if (await nav.isVisible()) {
      const box = await nav.boundingBox();
      expect(box).toBeTruthy();
      if (box) {
        expect(box.width).toBeLessThanOrEqual(375);
      }
    }
  });
});
