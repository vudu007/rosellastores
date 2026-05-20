export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { authWithSession } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateSaleSchema = z.object({
  status: z.enum(['COMPLETED', 'VOIDED', 'HELD']),
});

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await authWithSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        cashier: { select: { id: true, name: true, email: true } },
        items: { include: { product: true } },
      },
    });

    if (!sale || sale.branchId !== session.user.branchId) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    return NextResponse.json(sale);
  } catch (error) {
    console.error('Error fetching sale:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await authWithSession();
    if (!session || !['MANAGER', 'OWNER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!sale || sale.branchId !== session.user.branchId) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    const body = await req.json();
    const validatedData = updateSaleSchema.parse(body);

    if (validatedData.status === 'VOIDED' && sale.status === 'COMPLETED') {
      for (const item of sale.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            stockQty: {
              increment: item.qty,
            },
          },
        });
      }
    }

    const updatedSale = await prisma.sale.update({
      where: { id },
      data: { status: validatedData.status },
      include: {
        customer: true,
        cashier: { select: { id: true, name: true } },
        items: { include: { product: true } },
      },
    });

    return NextResponse.json(updatedSale);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Error updating sale:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
