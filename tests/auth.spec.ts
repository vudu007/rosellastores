import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  const login = async (page: any, email: string, password: string) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
  };

  const formatNGN = (value: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(value);

  const parseNGN = (formatted: string) => {
    const digits = String(formatted).replace(/[^\d.-]/g, '');
    const asNumber = Number(digits);
    return Number.isFinite(asNumber) ? asNumber : 0;
  };

  const createE2EProduct = async (page: any, suffix: string) => {
    const categoryRes = await page.request.post('/api/categories', {
      data: { name: `E2E-${suffix}` },
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

    const sku = `E2E-${suffix}`;
    const productName = `E2E Product ${suffix}`;
    const retailPrice = 1234;

    const productRes = await page.request.post('/api/products', {
      data: {
        name: productName,
        sku,
        barcodes: [],
        categoryId: category.id,
        supplierId: supplier.id,
        costPrice: 0,
        retailPrice,
        stockQty: 10,
        unit: 'pcs',
        minOrderQty: 1,
      },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(productRes.ok()).toBeTruthy();
    const product = await productRes.json();

    return { category, supplier, product, sku, productName, retailPrice };
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
    const { product, sku, productName } = await createE2EProduct(page, suffix);

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

  test('POS search bar text should be readable', async ({ page }) => {
    test.setTimeout(60000);
    await login(page, 'admin@rosellastores.com', 'owner123');
    await page.goto('/pos');

    const search = page.getByTestId('pos-search');
    await expect(search).toBeVisible();
    await expect(search).toHaveAttribute('class', /placeholder:text-slate-500/);
    await expect(search).toHaveCSS('color', 'rgb(15, 23, 42)');
  });

  test('POS barcode scan should add an item to the cart', async ({ page }) => {
    test.setTimeout(90000);
    await login(page, 'admin@rosellastores.com', 'owner123');
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });

    const suffix = Date.now().toString();
    const { product, sku, productName } = await createE2EProduct(page, suffix);

    await page.goto('/pos');
    await page.getByTestId('pos-terminal').click({ position: { x: 10, y: 10 } });
    await page.keyboard.type(sku);
    await page.keyboard.press('Enter');

    await expect(page.getByText(`Scanned: ${productName}`)).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId(`pos-cart-item-${product.id}`)).toBeVisible();
  });

  test('POS should apply line discount percent and reduce row total', async ({ page }) => {
    test.setTimeout(90000);
    await login(page, 'admin@rosellastores.com', 'owner123');
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });

    const suffix = Date.now().toString();
    const { product, sku, retailPrice } = await createE2EProduct(page, suffix);

    await page.goto('/pos');
    await page.getByTestId('pos-search').fill(sku);
    await page.getByTestId(`pos-product-${sku}`).click();

    const rowTotal = page.getByTestId(`pos-cart-rowtotal-${product.id}`);
    const before = parseNGN(await rowTotal.innerText());

    await page.getByTestId(`pos-cart-discount-${product.id}`).fill('10');
    const expected = parseNGN(formatNGN(retailPrice - retailPrice * 0.1));
    await expect(rowTotal).toHaveText(formatNGN(expected));

    const after = parseNGN(await rowTotal.innerText());
    expect(after).toBeLessThan(before);
  });

  test('POS should apply ticket discount and reduce grand total', async ({ page }) => {
    test.setTimeout(90000);
    await login(page, 'admin@rosellastores.com', 'owner123');
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });

    const suffix = Date.now().toString();
    const { sku } = await createE2EProduct(page, suffix);

    await page.goto('/pos');
    await page.getByTestId('pos-search').fill(sku);
    await page.getByTestId(`pos-product-${sku}`).click();

    const totalBefore = parseNGN(await page.getByTestId('pos-total-grand').innerText());
    await page.getByRole('button', { name: 'Discount' }).click();
    await page.getByTestId('pos-ticket-discount-value').fill('100');
    await page.getByTestId('pos-ticket-discount-apply').click();
    await expect(page.getByText('Discount applied')).toBeVisible();

    const totalAfter = parseNGN(await page.getByTestId('pos-total-grand').innerText());
    expect(totalAfter).toBeLessThan(totalBefore);
  });

  test('POS should checkout a cash sale and clear the cart', async ({ page }) => {
    test.setTimeout(120000);
    await login(page, 'admin@rosellastores.com', 'owner123');
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });

    const suffix = Date.now().toString();
    const { sku } = await createE2EProduct(page, suffix);

    await page.goto('/pos');
    await page.getByTestId('pos-search').fill(sku);
    await page.getByTestId(`pos-product-${sku}`).click();

    await page.getByRole('button', { name: 'Pay' }).click();
    await page.getByRole('button', { name: /Confirm Payment/i }).click();

    await expect(page.getByText('Transaction Completed Successfully')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('pos-empty')).toBeVisible({ timeout: 20000 });
  });

  test('POS should hold a sale and recall it', async ({ page }) => {
    test.setTimeout(90000);
    await login(page, 'admin@rosellastores.com', 'owner123');
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });

    const suffix = Date.now().toString();
    const { product, sku } = await createE2EProduct(page, suffix);

    await page.goto('/pos');
    await page.getByTestId('pos-search').fill(sku);
    await page.getByTestId(`pos-product-${sku}`).click();
    await expect(page.getByTestId(`pos-cart-item-${product.id}`)).toBeVisible();

    await page.getByRole('button', { name: 'Save sale' }).click();
    await expect(page.getByTestId('pos-empty')).toBeVisible();

    await page.getByRole('button', { name: 'Unfinished' }).click();
    await expect(page.getByTestId(`pos-cart-item-${product.id}`)).toBeVisible();
  });

  test('POS should open History and Return dialogs', async ({ page }) => {
    test.setTimeout(90000);
    await login(page, 'admin@rosellastores.com', 'owner123');
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });

    await page.goto('/pos');

    await page.getByRole('button', { name: 'History' }).click();
    await expect(page.getByRole('heading', { name: 'Transaction History' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    await page.getByRole('button', { name: 'Return' }).click();
    await expect(page.getByText('Item Return')).toBeVisible();
  });

  test('POS should record Cash IN and Cash OUT', async ({ page }) => {
    test.setTimeout(120000);
    await login(page, 'admin@rosellastores.com', 'owner123');
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });

    await page.goto('/pos');

    await page.getByTestId('pos-btn-cash-in').click();
    await expect(page.getByTestId('pos-cash-modal')).toBeVisible();
    await page.getByTestId('pos-cash-amount').fill('500');
    await page.getByTestId('pos-cash-note').fill('Opening float');
    await page.getByTestId('pos-cash-save').click();
    await expect(page.getByText('Cash in recorded')).toBeVisible({ timeout: 15000 });

    await page.getByTestId('pos-btn-cash-out').click();
    await expect(page.getByTestId('pos-cash-modal')).toBeVisible();
    await page.getByTestId('pos-cash-amount').fill('200');
    await page.getByTestId('pos-cash-note').fill('Petty cash');
    await page.getByTestId('pos-cash-save').click();
    await expect(page.getByText('Cash out recorded')).toBeVisible({ timeout: 15000 });
  });

  test('POS should complete a split payment sale', async ({ page }) => {
    test.setTimeout(120000);
    await login(page, 'admin@rosellastores.com', 'owner123');
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });

    const suffix = Date.now().toString();
    const { sku } = await createE2EProduct(page, suffix);

    await page.goto('/pos');
    await page.getByTestId('pos-search').fill(sku);
    await page.getByTestId(`pos-product-${sku}`).click();

    await page.getByTestId('pos-btn-split').click();
    await expect(page.getByTestId('pos-payment-modal')).toBeVisible();

    const amount = Math.max(0, parseNGN(await page.getByTestId('pos-total-grand').innerText()));

    await page.getByTestId('pos-split-cash').fill(String(amount));
    await page.getByTestId('pos-split-card').fill('0');
    await page.getByTestId('pos-split-transfer').fill('0');
    await page.getByTestId('pos-split-mobile').fill('0');

    await page.getByTestId('pos-payment-confirm').click();
    await expect(page.getByText('Transaction Completed Successfully')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('pos-empty')).toBeVisible({ timeout: 20000 });
  });

  test('POS should open receipt preview after a completed sale', async ({ page }) => {
    test.setTimeout(120000);
    await login(page, 'admin@rosellastores.com', 'owner123');
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });

    const suffix = Date.now().toString();
    const { sku } = await createE2EProduct(page, suffix);

    await page.goto('/pos');
    await page.getByTestId('pos-search').fill(sku);
    await page.getByTestId(`pos-product-${sku}`).click();

    await page.getByTestId('pos-btn-pay').click();
    await page.getByTestId('pos-payment-confirm').click();
    await expect(page.getByText('Transaction Completed Successfully')).toBeVisible({ timeout: 20000 });

    await page.getByTestId('pos-btn-receipt').click();
    await expect(page.getByTestId('pos-receipt-iframe')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('pos-receipt-close').click();
    await expect(page.getByTestId('pos-receipt-iframe')).toBeHidden({ timeout: 15000 });
  });
});
