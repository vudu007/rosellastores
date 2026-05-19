export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const adjustStockSchema = z.object({
  productId: z.string(),
  quantityChange: z.number().int(),
  reason: z.string(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const lowStockOnly = searchParams.get('lowStockOnly') === 'true';

    const where: any = {
      branchId: session.user.branchId ?? undefined,
      isActive: true,
    };

    let products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        supplier: true,
      },
      orderBy: { name: 'asc' },
    });

    if (lowStockOnly) {
      products = products.filter((p) => p.stockQty <= p.lowStockThreshold);
    }

    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !['MANAGER', 'OWNER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = adjustStockSchema.parse(body);

    const branchId = session.user.branchId ?? undefined;
    if (!branchId) {
      return NextResponse.json({ error: 'User does not belong to a branch' }, { status: 400 });
    }

    const product = await prisma.product.findUnique({ where: { id: validatedData.productId } });
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
      include: { category: true, supplier: true },
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
    const session = await auth();
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

