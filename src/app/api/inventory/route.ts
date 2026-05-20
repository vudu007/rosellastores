export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { authWithSession } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const adjustStockSchema = z.object({
  productId: z.string(),
  quantityChange: z.number().int(),
  reason: z.string(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await authWithSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const lowStockOnly = searchParams.get('lowStockOnly') === 'true';
    const search = (searchParams.get('search') || '').trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limitRaw = parseInt(searchParams.get('limit') || '50', 10);
    const limit = Math.min(200, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50));

    const where: any = {
      branchId: session.user.branchId ?? undefined,
      isActive: true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { category: { is: { name: { contains: search, mode: 'insensitive' } } } },
        { supplier: { is: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const select = {
      id: true,
      name: true,
      sku: true,
      barcodes: true,
      stockQty: true,
      lowStockThreshold: true,
      costPrice: true,
      retailPrice: true,
      unit: true,
      categoryId: true,
      supplierId: true,
      isTaxable: true,
      taxInclusive: true,
      category: { select: { name: true } },
      supplier: { select: { name: true } },
    } as const;

    if (lowStockOnly) {
      const all = await prisma.product.findMany({
        where,
        select,
        orderBy: { name: 'asc' },
      });

      const lowStock = all.filter((p) => p.stockQty <= p.lowStockThreshold);
      const total = lowStock.length;
      const pages = Math.max(1, Math.ceil(total / limit));
      const safePage = Math.min(page, pages);
      const slice = lowStock.slice((safePage - 1) * limit, safePage * limit);

      const res = NextResponse.json({
        products: slice,
        pagination: { page: safePage, limit, total, pages },
      });
      res.headers.set('Cache-Control', 'private, max-age=10, stale-while-revalidate=30');
      return res;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    const res = NextResponse.json({
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
    res.headers.set('Cache-Control', 'private, max-age=10, stale-while-revalidate=30');
    return res;
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await authWithSession();
    if (!session || !['MANAGER', 'OWNER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = adjustStockSchema.parse(body);

    const branchId = session.user.branchId ?? undefined;
    if (!branchId) {
      return NextResponse.json({ error: 'User does not belong to a branch' }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: validatedData.productId },
      select: { id: true, branchId: true, stockQty: true },
    });
    if (!product || product.branchId !== branchId) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const newStockQty = product.stockQty + validatedData.quantityChange;

    if (newStockQty < 0) {
      return NextResponse.json(
        { error: 'Stock adjustment would result in negative inventory' },
        { status: 400 }
      );
    }

    const updatedProduct = await prisma.product.update({
      where: { id: validatedData.productId },
      data: { stockQty: { increment: validatedData.quantityChange } },
      select: {
        id: true,
        name: true,
        sku: true,
        barcodes: true,
        stockQty: true,
        lowStockThreshold: true,
        costPrice: true,
        retailPrice: true,
        unit: true,
        categoryId: true,
        supplierId: true,
        isTaxable: true,
        taxInclusive: true,
        category: { select: { name: true } },
        supplier: { select: { name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'STOCK_ADJUSTMENT',
        entity: 'Product',
        entityId: validatedData.productId,
        oldValue: JSON.stringify({ stockQty: product.stockQty }),
        newValue: JSON.stringify({
          stockQty: updatedProduct.stockQty,
          quantityChange: validatedData.quantityChange,
          reason: validatedData.reason,
        }),
      },
    });

    return NextResponse.json(updatedProduct);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Error adjusting stock:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await authWithSession();
    if (!session || !['ADMIN', 'OWNER', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const branchId = session.user.branchId ?? undefined;
    if (!branchId) {
      return NextResponse.json({ error: 'User does not belong to a branch' }, { status: 400 });
    }

    const result = await prisma.product.updateMany({
      where: { branchId, isActive: true },
      data: { isActive: false },
    });

    return NextResponse.json({ cleared: result.count });
  } catch (error) {
    console.error('Error clearing inventory:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
