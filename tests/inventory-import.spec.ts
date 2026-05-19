import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';

type CsvRow = {
  Name?: string;
  Alias?: string;
  'Under Group'?: string;
};

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const csvPath =
  process.env.INVENTORY_CSV_PATH ??
  path.resolve(process.cwd(), 'ListofItems.csv');
const email = process.env.INVENTORY_IMPORT_EMAIL ?? 'admin@rosellastores.com';
const password = process.env.INVENTORY_IMPORT_PASSWORD ?? 'owner123';

test.use({ baseURL: baseUrl });

const toSkuSafe = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);

const readInventoryCsv = () => {
  const candidates = [
    csvPath,
    'D:\\ListofItems.csv',
    path.resolve(process.cwd(), 'ListofItems.csv'),
  ];
  const resolved = candidates.find((p) => fs.existsSync(p));
  if (!resolved) {
    throw new Error(`CSV file not found. Tried: ${candidates.join(', ')}`);
  }

  const raw = fs.readFileSync(resolved, 'utf8');
  const lines = raw.split(/\r?\n/);
  const startIdx = Math.max(0, lines.findIndex((l) => l.trim().startsWith('Name,Alias,Under Group')));
  const sliced = lines.slice(startIdx).join('\n');
  const parsed = Papa.parse<CsvRow>(sliced, { header: true, skipEmptyLines: true });
  if (parsed.errors?.length) {
    throw new Error(parsed.errors.map((e) => e.message).join('; '));
  }
  return (parsed.data ?? []).filter((r) => (r.Name ?? '').trim().length > 0);
};

const login = async (page: any) => {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 20000 });
};

test('import inventory from CSV into a clean active inventory', async ({ page }) => {
  test.skip(process.env.RUN_INVENTORY_IMPORT !== '1', 'Set RUN_INVENTORY_IMPORT=1 to run.');
  test.setTimeout(15 * 60 * 1000);

  const rows = readInventoryCsv();
  expect(rows.length).toBeGreaterThan(0);

  await login(page);

  const existingSuppliersRes = await page.request.get('/api/suppliers');
  expect(existingSuppliersRes.ok()).toBeTruthy();
  const existingSuppliers = (await existingSuppliersRes.json()) as any[];
  const supplierName = 'Imported Supplier';
  let supplierId = existingSuppliers.find((s) => s?.name === supplierName)?.id as string | undefined;

  if (!supplierId) {
    const supplierRes = await page.request.post('/api/suppliers', {
      data: { name: supplierName, contact: 'Import', phone: '0000000000' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(supplierRes.ok()).toBeTruthy();
    supplierId = (await supplierRes.json())?.id as string | undefined;
  }

  expect(supplierId).toBeTruthy();

  const categoriesRes = await page.request.get('/api/categories');
  expect(categoriesRes.ok()).toBeTruthy();
  const existingCategories = (await categoriesRes.json()) as any[];
  const categoryByName = new Map<string, string>();
  for (const c of existingCategories) {
    if (c?.name && c?.id) categoryByName.set(String(c.name).trim(), String(c.id));
  }

  const uniqueCategoryNames = Array.from(
    new Set(rows.map((r) => String(r['Under Group'] ?? 'General').trim() || 'General'))
  );

  for (const name of uniqueCategoryNames) {
    if (categoryByName.has(name)) continue;
    const res = await page.request.post('/api/categories', {
      data: { name },
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok()) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Failed to create category "${name}": ${err?.error ?? res.status()}`);
    }
    const created = await res.json();
    categoryByName.set(name, created.id);
  }

  const inventoryBefore = await page.request.get('/api/inventory');
  expect(inventoryBefore.ok()).toBeTruthy();
  const clearRes = await page.request.delete('/api/inventory');
  expect(clearRes.ok()).toBeTruthy();

  const inventoryCleared = await page.request.get('/api/inventory');
  expect(inventoryCleared.ok()).toBeTruthy();
  const activeAfterClear = (await inventoryCleared.json()) as any[];
  expect(activeAfterClear.length).toBe(0);

  const runId = Date.now().toString(36).toUpperCase();
  const skuToCategoryName = new Map<string, string>();
  const skuCounts = new Map<string, number>();
  const payload = rows.map((r, idx) => {
    const name = String(r.Name ?? '').trim();
    const alias = String(r.Alias ?? '').trim();
    const group = String(r['Under Group'] ?? 'General').trim() || 'General';

    const base = alias ? toSkuSafe(alias) : `${toSkuSafe(name)}-${idx + 1}`;
    const baseSku = `IMP-${runId}-${base || `ITEM-${idx + 1}`}`;
    const seen = (skuCounts.get(baseSku) ?? 0) + 1;
    skuCounts.set(baseSku, seen);
    const sku = seen > 1 ? `${baseSku}-${seen}` : baseSku;

    const categoryId = categoryByName.get(group) ?? categoryByName.get('General');
    if (!categoryId) {
      throw new Error(`Missing categoryId for "${group}"`);
    }
    skuToCategoryName.set(sku, group);

    return {
      name,
      sku,
      barcodes: alias ? [alias] : [],
      categoryId,
      supplierId,
      retailPrice: '1',
      stockQty: '0',
      lowStockThreshold: '10',
      unit: 'pcs',
    };
  });

  const batchSize = 200;
  for (let i = 0; i < payload.length; i += batchSize) {
    const batch = payload.slice(i, i + batchSize);
    const res = await page.request.post('/api/products/bulk', {
      data: batch,
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok()) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Bulk import failed at batch ${i / batchSize + 1}: ${err?.error ?? res.status()}`);
    }
    const body = await res.json();
    if (body?.failedCount) {
      const sample = Array.isArray(body.errors) ? body.errors.slice(0, 5).join(' | ') : '';
      throw new Error(`Bulk import had failures: ${body.failedCount}. ${sample}`);
    }
  }

  const inventoryAfter = await page.request.get('/api/inventory');
  expect(inventoryAfter.ok()).toBeTruthy();
  const imported = (await inventoryAfter.json()) as any[];
  expect(imported.length).toBe(payload.length);

  const mismatches: string[] = [];
  for (const p of imported) {
    const sku = String(p?.sku ?? '');
    const expectedGroup = skuToCategoryName.get(sku);
    const actualGroup = String(p?.category?.name ?? '');
    if (expectedGroup && expectedGroup !== actualGroup) {
      mismatches.push(`${sku}: expected ${expectedGroup} got ${actualGroup}`);
      if (mismatches.length >= 20) break;
    }
  }

  expect(mismatches).toEqual([]);

  const health = await page.request.get('/api/health');
  expect(health.ok()).toBeTruthy();
  const healthJson = await health.json();
  expect(healthJson?.db?.connected).toBeTruthy();
});
