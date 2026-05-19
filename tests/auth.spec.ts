import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('health endpoint should be reachable', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json?.env?.databaseUrlPresent).toBeTruthy();
    expect(json?.env?.databaseUrlHasQuotes).toBeFalsy();
    expect(json?.db?.connected).toBeTruthy();
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/pos');
    await expect(page).toHaveURL(/.*\/login\?callbackUrl=.*pos/);
  });

  test('owner should be able to login and access POS and Dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@rosellastores.com');
    await page.fill('input[type="password"]', 'owner123');
    await page.click('button[type="submit"]');

    // Default landing for OWNER is Dashboard
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });

    // Should be able to navigate to dashboard
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Should be able to access POS as well
    await page.goto('/pos');
    await expect(page).toHaveURL(/.*\/pos/);
  });

  test('cashier should be able to login and access POS but NOT Dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'cashier@rosellastores.com');
    await page.fill('input[type="password"]', 'cashier123');
    await page.click('button[type="submit"]');

    // Should redirect to POS by default
    await expect(page).toHaveURL(/.*\/pos/, { timeout: 15000 });

    // Dashboard should kick them back
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/.*\/dashboard/);
  });
});
