import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !['OWNER', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const products = await req.json();

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'Invalid or empty bulk data' }, { status: 400 });
    }

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // The user's branch ID
    const branchId = session.user.branchId;
    if (!branchId) {
      return NextResponse.json({ error: 'User does not belong to a branch' }, { status: 400 });
    }

    for (const [index, p] of products.entries()) {
      try {
        if (!p.name || !p.sku || !p.categoryId || !p.supplierId || p.retailPrice === undefined || p.wholesalePrice === undefined) {
          throw new Error('Missing required fields');
        }

        // Check if SKU already exists
        const existing = await prisma.product.findUnique({
          where: { sku: p.sku }
        });

        if (existing) {
          throw new Error(`SKU ${p.sku} already exists`);
        }

        await prisma.product.create({
          data: {
            name: p.name,
            sku: p.sku,
            barcode: p.barcode || null,
            categoryId: p.categoryId,
            supplierId: p.supplierId,
            branchId: branchId,
            retailPrice: parseFloat(p.retailPrice),
            wholesalePrice: parseFloat(p.wholesalePrice),
            stockQty: parseInt(p.stockQty, 10) || 0,
            lowStockThreshold: parseInt(p.lowStockThreshold, 10) || 10,
            unit: p.unit || 'pcs'
          }
        });

        successCount++;
      } catch (err: any) {
        failedCount++;
        errors.push(`Row ${index + 1} (${p.name || p.sku || 'Unknown'}): ${err.message}`);
      }
    }

    return NextResponse.json({
      message: `Bulk import completed. Created: ${successCount}, Failed: ${failedCount}.`,
      successCount,
      failedCount,
      errors
    }, { status: 200 });

  } catch (error: any) {
    console.error('Bulk product import error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
