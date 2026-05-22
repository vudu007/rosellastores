export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { authWithSession } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const bodySchema = z.object({
  csv: z.string().min(1),
});

const parseYesNo = (v: any) => {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return null;
  if (['yes', 'y', 'true', '1'].includes(s)) return true;
  if (['no', 'n', 'false', '0'].includes(s)) return false;
  return null;
};

const parseNumberLoose = (s: string) => {
  const cleaned = String(s ?? '').trim().replace(/,/g, '');
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
};

const parseIntLoose = (s: string) => {
  const cleaned = String(s ?? '').trim().replace(/,/g, '');
  if (!cleaned) return null;
  const n = Number.parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : null;
};

const smartSplitCostRetail = (tokens: string[]) => {
  if (tokens.length < 2) return null;
  for (let k = 1; k < tokens.length; k++) {
    const left = tokens.slice(0, k).join(',').trim();
    const right = tokens.slice(k).join(',').trim();
    const cost = parseNumberLoose(left);
    const retail = parseNumberLoose(right);
    if (cost === null || retail === null) continue;
    if (cost <= retail) return { cost, retail };
  }
  for (let k = 1; k < tokens.length; k++) {
    const left = tokens.slice(0, k).join(',').trim();
    const right = tokens.slice(k).join(',').trim();
    const cost = parseNumberLoose(left);
    const retail = parseNumberLoose(right);
    if (cost === null || retail === null) continue;
    return { cost, retail };
  }
  return null;
};

type ParsedRow = {
  name: string;
  sku: string;
  barcodes: string[];
  categoryName: string;
  supplierName: string;
  unit: string;
  stockQty: number;
  lowStockThreshold: number;
  costPrice: number;
  retailPrice: number;
  isTaxable: boolean;
  taxInclusive: boolean;
};

const parseCsvLike = (csv: string) => {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rows: ParsedRow[] = [];
  const errors: string[] = [];

  const header = lines[0]?.toLowerCase() ?? '';
  const startIndex = header.includes('name') && header.includes('sku') ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const raw = lines[i];
    const parts = raw.split(',');
    if (parts.length < 12) {
      errors.push(`Line ${i + 1}: Not enough columns`);
      continue;
    }

    const taxInclusiveRaw = parts[parts.length - 1];
    const isTaxableRaw = parts[parts.length - 2];
    const front = parts.slice(0, parts.length - 2);

    if (front.length < 10) {
      errors.push(`Line ${i + 1}: Invalid columns`);
      continue;
    }

    const name = String(front[0] ?? '').trim();
    const sku = String(front[1] ?? '').trim();
    const barcodesRaw = String(front[2] ?? '').trim();
    const categoryName = String(front[3] ?? '').trim() || 'General';
    const supplierName = String(front[4] ?? '').trim() || 'Imported Supplier';
    const unit = String(front[5] ?? '').trim() || 'pcs';
    const stockQty = parseIntLoose(String(front[6] ?? '')) ?? 0;
    const lowStockThreshold = parseIntLoose(String(front[7] ?? '')) ?? 10;

    const costRetailTokens = front.slice(8);
    const costRetail = smartSplitCostRetail(costRetailTokens);
    if (!costRetail) {
      errors.push(`Line ${i + 1} (${sku || name || 'Unknown'}): Could not parse costPrice/retailPrice`);
      continue;
    }

    const isTaxable = parseYesNo(isTaxableRaw) ?? true;
    const taxInclusive = (parseYesNo(taxInclusiveRaw) ?? false) && isTaxable;

    if (!name || !sku) {
      errors.push(`Line ${i + 1}: Missing name or sku`);
      continue;
    }

    const barcodes =
      barcodesRaw.length > 0
        ? barcodesRaw
            .split(/[|,]/)
            .map((x) => x.trim())
            .filter(Boolean)
        : [];

    rows.push({
      name,
      sku,
      barcodes,
      categoryName,
      supplierName,
      unit,
      stockQty,
      lowStockThreshold,
      costPrice: costRetail.cost,
      retailPrice: costRetail.retail,
      isTaxable,
      taxInclusive,
    });
  }

  return { rows, errors };
};

export async function POST(req: NextRequest) {
  try {
    const session = await authWithSession();
    if (!session || !['ADMIN', 'OWNER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const branchId = session.user.branchId;
    if (!branchId) return NextResponse.json({ error: 'User does not belong to a branch' }, { status: 400 });

    const body = bodySchema.parse(await req.json().catch(() => ({})));
    const { rows, errors } = parseCsvLike(body.csv);

    if (errors.length > 0) {
      return NextResponse.json({ error: 'Parse failed', details: errors.slice(0, 50) }, { status: 422 });
    }
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid rows found' }, { status: 400 });
    }

    const uniqueSkus = Array.from(new Set(rows.map((r) => r.sku)));
    const uniqueCategoryNames = Array.from(new Set(rows.map((r) => r.categoryName)));
    const uniqueSupplierNames = Array.from(new Set(rows.map((r) => r.supplierName)));

    await prisma.product.updateMany({
      where: { branchId, isActive: true },
      data: { isActive: false },
    });

    if (uniqueCategoryNames.length > 0) {
      const existingCats = await prisma.category.findMany({
        where: { name: { in: uniqueCategoryNames } },
        select: { id: true, name: true },
      });
      const existing = new Set(existingCats.map((c) => c.name));
      const toCreate = uniqueCategoryNames.filter((n) => !existing.has(n));
      for (const name of toCreate) {
        try {
          await prisma.category.create({ data: { name } });
        } catch (e: any) {
          if ((e as any)?.code !== 'P2002') throw e;
        }
      }
    }

    const categories = await prisma.category.findMany({
      where: { name: { in: uniqueCategoryNames } },
      select: { id: true, name: true },
    });
    const categoryMap = new Map(categories.map((c) => [c.name, c.id]));

    const suppliers: Array<{ id: string; name: string }> = [];
    for (const name of uniqueSupplierNames) {
      const existing = await prisma.supplier.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
        select: { id: true, name: true },
      });
      if (existing) {
        suppliers.push(existing);
        continue;
      }
      const created = await prisma.supplier.create({
        data: { name, contact: 'Import', phone: '0000000000' },
        select: { id: true, name: true },
      });
      suppliers.push(created);
    }
    const supplierMap = new Map(suppliers.map((s) => [s.name.toLowerCase(), s.id]));

    const existingProducts = await prisma.product.findMany({
      where: { sku: { in: uniqueSkus } },
      select: { id: true, sku: true, branchId: true, retailPrice: true },
    });
    const existingBySku = new Map(existingProducts.map((p) => [p.sku, p]));

    const badSkus = existingProducts.filter((p) => p.branchId !== branchId).map((p) => p.sku);
    if (badSkus.length > 0) {
      return NextResponse.json(
        { error: 'Some SKUs already exist in another branch', details: badSkus.slice(0, 50) },
        { status: 409 }
      );
    }

    const toCreate = rows.filter((r) => !existingBySku.has(r.sku));
    const toUpdate = rows.filter((r) => existingBySku.has(r.sku));

    if (toCreate.length > 0) {
      await prisma.product.createMany({
        data: toCreate.map((r) => ({
          name: r.name,
          sku: r.sku,
          barcodes: r.barcodes,
          categoryId: categoryMap.get(r.categoryName) ?? categoryMap.get('General')!,
          supplierId: supplierMap.get(r.supplierName.toLowerCase()) ?? supplierMap.get('imported supplier')!,
          branchId,
          unit: r.unit,
          stockQty: r.stockQty,
          lowStockThreshold: r.lowStockThreshold,
          costPrice: r.costPrice,
          retailPrice: r.retailPrice,
          isTaxable: r.isTaxable,
          taxInclusive: r.taxInclusive,
          isActive: true,
        })),
      });
    }

    let updated = 0;
    let priceTagsCreated = 0;
    const chunkSize = 80;
    for (let i = 0; i < toUpdate.length; i += chunkSize) {
      const chunk = toUpdate.slice(i, i + chunkSize);
      const ops: any[] = [];

      for (const r of chunk) {
        const prev = existingBySku.get(r.sku)!;
        const newRetail = r.retailPrice;
        const oldRetail = Number(prev.retailPrice) || 0;
        const productId = prev.id;

        ops.push(
          prisma.product.update({
            where: { sku: r.sku },
            data: {
              name: r.name,
              barcodes: r.barcodes,
              categoryId: categoryMap.get(r.categoryName) ?? categoryMap.get('General')!,
              supplierId: supplierMap.get(r.supplierName.toLowerCase()) ?? supplierMap.get('imported supplier')!,
              unit: r.unit,
              stockQty: r.stockQty,
              lowStockThreshold: r.lowStockThreshold,
              costPrice: r.costPrice,
              retailPrice: newRetail,
              isTaxable: r.isTaxable,
              taxInclusive: r.taxInclusive,
              isActive: true,
              deletedAt: null,
              deletedById: null,
            },
          })
        );

        if (Math.round(oldRetail) !== Math.round(newRetail)) {
          ops.push(
            prisma.priceTag.create({
              data: {
                productId,
                branchId,
                oldPrice: oldRetail,
                newPrice: newRetail,
              },
            })
          );
          priceTagsCreated += 1;
        }
      }

      await prisma.$transaction(ops);
      updated += chunk.length;
    }

    const importedSkuSet = new Set(uniqueSkus);
    const deactivated = await prisma.product.updateMany({
      where: { branchId, sku: { notIn: Array.from(importedSkuSet) }, isActive: true },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'INVENTORY_REBUILD',
        entity: 'Product',
        entityId: branchId,
        newValue: JSON.stringify({
          rows: rows.length,
          created: toCreate.length,
          updated,
          deactivated: deactivated.count,
          priceTagsCreated,
        }),
      },
    });

    return NextResponse.json({
      ok: true,
      rows: rows.length,
      created: toCreate.length,
      updated,
      deactivated: deactivated.count,
      priceTagsCreated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors.map((e) => e.message).join(', ') }, { status: 400 });
    }
    console.error('Error rebuilding inventory:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

