import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  const login = async (page: any, email: string, password: string) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
  };

  test('health endpoint should be reachable', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json?.env?.databaseUrlPresent).toBeTruthy();
    expect(json?.env?.databaseUrlHasQuotes).toBeFalsy();
    expect(json?.db?.connected).toBeTruthy();
    expect(json?.db?.branchCount).toBeGreaterThan(0);
    expect(json?.db?.userCount).toBeGreaterThan(0);
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/pos');
    await expect(page).toHaveURL(/.*\/login\?callbackUrl=.*pos/);
  });

  test('owner should be able to login and access POS and Dashboard', async ({ page }) => {
    await login(page, 'admin@rosellastores.com', 'owner123');

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
    await login(page, 'cashier@rosellastores.com', 'cashier123');

    // Should redirect to POS by default
    await expect(page).toHaveURL(/.*\/pos/, { timeout: 15000 });

    // Dashboard should kick them back
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/.*\/dashboard/);
  });

  test('owner should not be able to manage staff or update business settings', async ({ page }) => {
    await login(page, 'admin@rosellastores.com', 'owner123');
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });

    await page.goto('/dashboard/staff');
    await expect(page.getByText('Admin Only')).toBeVisible();

    const res = await page.request.post('/api/settings', {
      data: { businessName: 'Rosella Stores' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(401);
  });

  test('POS cart should add, update quantity, and remove items', async ({ page }) => {
    test.setTimeout(60000);
    await login(page, 'admin@rosellastores.com', 'owner123');
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });

    const suffix = Date.now().toString();
    const categoryName = `E2E-${suffix}`;
    const sku = `E2E-${suffix}`;
    const productName = `E2E Product ${suffix}`;

    const categoryRes = await page.request.post('/api/categories', {
      data: { name: categoryName },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(categoryRes.ok()).toBeTruthy();
    const category = await categoryRes.json();

    const supplierRes = await page.request.post('/api/suppliers', {
      data: { name: `E2E Supplier ${suffix}`, contact: 'QA', phone: '0000000000' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(supplierRes.ok()).toBeTruthy();
    const supplier = await supplierRes.json();

    const productRes = await page.request.post('/api/products', {
      data: {
        name: productName,
        sku,
        barcodes: [],
        categoryId: category.id,
        supplierId: supplier.id,
        costPrice: 0,
        retailPrice: 1234,
        stockQty: 10,
        unit: 'pcs',
        minOrderQty: 1,
      },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(productRes.ok()).toBeTruthy();
    const product = await productRes.json();

    await page.goto('/pos');
    await expect(page).toHaveURL(/.*\/pos/, { timeout: 15000 });

    await page.getByTestId('pos-search').fill(sku);
    await page.getByTestId(`pos-product-${sku}`).click();

    const cartPanel = page.getByTestId('pos-cart-panel');
    const cartItem = page.getByTestId(`pos-cart-item-${product.id}`);
    await expect(cartPanel).toBeVisible();
    await expect(cartPanel.getByText(productName)).toBeVisible();
    await expect(cartItem.getByTestId(`pos-cart-qty-${product.id}`)).toHaveText('1');

    await cartItem.getByRole('button', { name: `Increase quantity for ${productName}` }).click();
    await expect(cartItem.getByTestId(`pos-cart-qty-${product.id}`)).toHaveText('2');

    await cartItem.getByRole('button', { name: `Decrease quantity for ${productName}` }).click();
    await expect(cartItem.getByTestId(`pos-cart-qty-${product.id}`)).toHaveText('1');

    await cartItem.getByRole('button', { name: `Remove ${productName}` }).click();
    await expect(cartPanel.getByText('Empty Terminal')).toBeVisible();
  });
});
