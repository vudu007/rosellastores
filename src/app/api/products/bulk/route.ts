export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { authWithSession } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await authWithSession();
    if (!session || !['ADMIN', 'OWNER', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const products = await req.json();

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'Invalid or empty bulk data' }, { status: 400 });
    }

    // The user's branch ID
    const branchId = session.user.branchId;
    if (!branchId) {
      return NextResponse.json({ error: 'User does not belong to a branch' }, { status: 400 });
    }

    const errors: string[] = [];
    const skuCounts = new Map<string, number>();
    const needsCategoryNames: string[] = [];

    const pickString = (obj: any, keys: string[]) => {
      for (const k of keys) {
        const v = obj?.[k];
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
      return '';
    };

    const pickNumber = (obj: any, keys: string[]) => {
      for (const k of keys) {
        const v = obj?.[k];
        if (v === undefined || v === null) continue;
        const s = String(v).trim();
        if (!s) continue;
        const n = Number.parseFloat(s);
        if (Number.isFinite(n)) return n;
      }
      return null;
    };

    const pickInt = (obj: any, keys: string[]) => {
      for (const k of keys) {
        const v = obj?.[k];
        if (v === undefined || v === null) continue;
        const s = String(v).trim();
        if (!s) continue;
        const n = Number.parseInt(s, 10);
        if (Number.isFinite(n)) return n;
      }
      return null;
    };

    const parseYesNo = (v: any) => {
      const s = String(v ?? '').trim().toLowerCase();
      if (!s) return null;
      if (['yes', 'y', 'true', '1'].includes(s)) return true;
      if (['no', 'n', 'false', '0'].includes(s)) return false;
      return null;
    };

    const getCategoryName = (p: any) =>
      pickString(p, ['category_class', 'categoryClass', 'categoryName', 'category', 'Category', 'CATEGORY']) ||
      'General';

    const getSupplierIdRaw = (p: any) =>
      pickString(p, ['supplierId', 'supplier_id', 'supplier', 'Supplier', 'SUPPLIER']);

    const getRetailPrice = (p: any) => pickNumber(p, ['retailPrice', 'retail_price', 'price', 'Price']) ?? 0;
    const getStockQty = (p: any) => pickInt(p, ['stockQty', 'stock_qty', 'qty', 'quantity']) ?? 0;
    const getLowStock = (p: any) =>
      pickInt(p, ['lowStockThreshold', 'low_stock_threshold', 'lowStock', 'threshold']) ?? 10;
    const getUnit = (p: any) => pickString(p, ['unit', 'Unit']) || 'pcs';

    const getBarcodes = (p: any) => {
      if (Array.isArray(p?.barcodes)) return p.barcodes.map((x: any) => String(x).trim()).filter(Boolean);
      const fromBarcodes = pickString(p, ['barcodes', 'Barcodes']);
      if (fromBarcodes) return fromBarcodes.split(',').map((x) => x.trim()).filter(Boolean);
      const single = pickString(p, ['barcode', 'Barcode', 'bar_code']);
      return single ? [single] : [];
    };

    const getName = (p: any) => pickString(p, ['name', 'Name', 'NAME']);
    const getSku = (p: any) => pickString(p, ['sku', 'SKU', 'Sku']);

    const getIsTaxable = (p: any) => {
      const v = p?.isTaxable ?? p?.taxable ?? p?.Taxable ?? p?.TAXABLE;
      const yn = parseYesNo(v);
      return yn ?? true;
    };

    const defaultSupplierName = 'Imported Supplier';
    const defaultSupplier = await prisma.supplier.findFirst({
      where: { name: { equals: defaultSupplierName, mode: 'insensitive' } },
      select: { id: true },
    });
    const defaultSupplierId =
      defaultSupplier?.id ??
      (await prisma.supplier.create({
        data: { name: defaultSupplierName, contact: 'Import', phone: '0000000000' },
        select: { id: true },
      })).id;

    const normalized = products.map((p, index) => {
      const name = getName(p);
      const sku = getSku(p);
      const categoryId = pickString(p, ['categoryId', 'category_id', 'CategoryId']);
      const categoryName = categoryId ? '' : getCategoryName(p);
      const supplierIdRaw = getSupplierIdRaw(p);
      const supplierId = supplierIdRaw || defaultSupplierId;
      const retailPrice = getRetailPrice(p);

      if (!name || !sku) {
        errors.push(`Row ${index + 1} (${name || sku || 'Unknown'}): Missing required fields`);
        return null;
      }

      const skuStr = sku.trim();
      skuCounts.set(skuStr, (skuCounts.get(skuStr) ?? 0) + 1);

      if (!categoryId) needsCategoryNames.push(categoryName);

      return {
        index,
        data: {
          name,
          sku: skuStr,
          barcodes: getBarcodes(p),
          categoryId: categoryId || categoryName,
          supplierId,
          branchId,
          retailPrice,
          stockQty: getStockQty(p),
          lowStockThreshold: getLowStock(p),
          unit: getUnit(p),
          isTaxable: getIsTaxable(p),
          taxInclusive: false,
        },
      };
    });

    for (const [sku, count] of skuCounts.entries()) {
      if (count > 1) errors.push(`SKU ${sku} appears ${count} times in the import payload`);
    }

    const candidates = normalized.filter(Boolean) as Array<{ index: number; data: any }>;
    const uniqueSkus = Array.from(new Set(candidates.map((c) => c.data.sku)));

    if (uniqueSkus.length > 0) {
      const existing = await prisma.product.findMany({
        where: { sku: { in: uniqueSkus } },
        select: { sku: true },
      });
      const existingSkus = new Set(existing.map((x) => x.sku));
      for (const sku of existingSkus) {
        errors.push(`SKU ${sku} already exists`);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          message: `Bulk import completed. Created: 0, Failed: ${products.length}.`,
          successCount: 0,
          failedCount: products.length,
          errors,
        },
        { status: 422 }
      );
    }

    const usedCategoryNames = Array.from(
      new Set(
        candidates
          .map((c) => String(c.data.categoryId))
          .filter((x) => x && !/^[a-f0-9]{24}$/i.test(x))
      )
    );

    if (usedCategoryNames.length > 0) {
      const existingCats = await prisma.category.findMany({
        where: { name: { in: usedCategoryNames } },
        select: { name: true },
      });
      const existingNames = new Set(existingCats.map((c) => c.name));
      const toCreate = usedCategoryNames.filter((name) => !existingNames.has(name));

      for (const name of toCreate) {
        try {
          await prisma.category.create({ data: { name } });
        } catch (e: any) {
          if ((e as any)?.code !== 'P2002') throw e;
        }
      }
    }

    const categoryRows = usedCategoryNames.length
      ? await prisma.category.findMany({
          where: { name: { in: usedCategoryNames } },
          select: { id: true, name: true },
        })
      : [];
    const categoryMap = new Map(categoryRows.map((c) => [c.name, c.id]));

    const createData = candidates.map((c) => ({
      ...c.data,
      categoryId: /^[a-f0-9]{24}$/i.test(String(c.data.categoryId))
        ? c.data.categoryId
        : categoryMap.get(String(c.data.categoryId)) ?? categoryMap.get('General') ?? c.data.categoryId,
    }));

    await prisma.product.createMany({
      data: createData,
    });

    return NextResponse.json({
      message: `Bulk import completed. Created: ${products.length}, Failed: 0.`,
      successCount: products.length,
      failedCount: 0,
      errors: []
    }, { status: 200 });

  } catch (error: any) {
    console.error('Bulk product import error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
