import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/pos');
    await expect(page).toHaveURL(/.*\/login\?callbackUrl=.*pos/);
  });

  test('owner should be able to login and access POS and Dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@lefronfood.com');
    await page.fill('input[type="password"]', 'owner123');
    await page.click('button[type="submit"]');

    // Should redirect to POS by default. Note: WebKit might take slightly longer.
    await expect(page).toHaveURL(/.*\/pos/, { timeout: 10000 });

    // Should be able to navigate to dashboard
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*\/dashboard/);
  });

  test('cashier should be able to login and access POS but NOT Dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'cashier@lefronfood.com');
    await page.fill('input[type="password"]', 'cashier123');
    await page.click('button[type="submit"]');

    // Should redirect to POS by default
    await expect(page).toHaveURL(/.*\/pos/, { timeout: 10000 });

    // Dashboard should kick them back
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/.*\/dashboard/);
  });
});
