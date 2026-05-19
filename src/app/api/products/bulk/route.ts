export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
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
    const normalized = products.map((p, index) => {
      const name = p?.name;
      const sku = p?.sku;
      const categoryId = p?.categoryId;
      const supplierId = p?.supplierId;
      const retailPriceRaw = p?.retailPrice;

      if (!name || !sku || !categoryId || !supplierId || retailPriceRaw === undefined) {
        errors.push(`Row ${index + 1} (${name || sku || 'Unknown'}): Missing required fields`);
        return null;
      }

      const skuStr = String(sku).trim();
      skuCounts.set(skuStr, (skuCounts.get(skuStr) ?? 0) + 1);

      const retailPrice = Number.parseFloat(String(retailPriceRaw));
      if (!Number.isFinite(retailPrice) || retailPrice <= 0) {
        errors.push(`Row ${index + 1} (${name || skuStr || 'Unknown'}): Invalid retailPrice`);
        return null;
      }

      return {
        index,
        data: {
          name: String(name),
          sku: skuStr,
          barcodes: p.barcodes ? (Array.isArray(p.barcodes) ? p.barcodes : [p.barcodes]) : [],
          categoryId: String(categoryId),
          supplierId: String(supplierId),
          branchId,
          retailPrice,
          stockQty: Number.parseInt(String(p.stockQty ?? ''), 10) || 0,
          lowStockThreshold: Number.parseInt(String(p.lowStockThreshold ?? ''), 10) || 10,
          unit: p.unit || 'pcs'
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

    await prisma.product.createMany({
      data: candidates.map((c) => c.data),
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
