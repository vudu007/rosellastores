export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !['OWNER', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId') || session.user.branchId;

    const query: any = {
      where: { isActive: true }
    };
    if (branchId) {
      query.where.branchId = branchId;
    }

    const products: any[] = await prisma.product.findMany({
      ...query,
      include: {
        category: true,
        supplier: true,
        branch: true
      },
      orderBy: { name: 'asc' }
    });

    const formattedInventory = products.map(p => ({
      sku: p.sku,
      barcode: p.barcode || '',
      name: p.name,
      category: p.category?.name || '',
      supplier: p.supplier?.name || '',
      retailPrice: p.retailPrice,
      wholesalePrice: p.wholesalePrice,
      systemStock: p.stockQty
    }));

    return NextResponse.json({
      date: new Date().toISOString().split('T')[0],
      inventory: formattedInventory
    });
  } catch (error) {
    console.error('Error generating inventory audit:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

