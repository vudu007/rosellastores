export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !['OWNER', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { productId, qty, supplierId, costPerUnit, notes } = body;

    if (!productId || !qty || qty <= 0) {
      return NextResponse.json({ error: 'Product ID and a positive quantity are required' }, { status: 400 });
    }

    // Get the product
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Update stock quantity
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: { stockQty: product.stockQty + qty },
    });

    // Log the restock as an audit entry
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'RESTOCK',
        entity: 'Product',
        entityId: productId,
        oldValue: JSON.stringify({ stockQty: product.stockQty }),
        newValue: JSON.stringify({
          stockQty: updatedProduct.stockQty,
          qtyAdded: qty,
          supplierId: supplierId || null,
          costPerUnit: costPerUnit || null,
          notes: notes || null,
        }),
      },
    });

    return NextResponse.json({
      message: `Restocked ${product.name}: ${product.stockQty} → ${updatedProduct.stockQty} (+${qty})`,
      product: updatedProduct,
    });
  } catch (error) {
    console.error('Error restocking product:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET restock history from audit logs
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !['OWNER', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const restockLogs = await prisma.auditLog.findMany({
      where: { action: 'RESTOCK', entity: 'Product' },
      include: { user: { select: { name: true } } },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    return NextResponse.json(restockLogs);
  } catch (error) {
    console.error('Error fetching restock history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

