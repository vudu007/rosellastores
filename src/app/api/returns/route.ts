export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authWithSession } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

const createReturnSchema = z.object({
  saleId: z.string().min(1),
  reason: z.string().min(3),
  items: z.array(z.object({ productId: z.string().min(1), qty: z.number().int().positive() })).optional(),
});

export async function GET(req: NextRequest) {
  const session = await authWithSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const branchId = session.user.branchId ?? undefined;
  if (!branchId) return NextResponse.json({ error: 'User does not belong to a branch' }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const take = Math.min(parseInt(searchParams.get('take') || '200', 10) || 200, 500);
  const status = searchParams.get('status') || '';

  const where: any = { branchId };
  if (status) where.status = status;

  const requests = await prisma.returnRequest.findMany({
    where,
    orderBy: { requestedAt: 'desc' },
    take,
    include: {
      sale: {
        include: {
          customer: true,
          cashier: { select: { id: true, name: true, email: true, role: true } },
          items: { include: { product: true } },
        },
      },
      requestedBy: { select: { id: true, name: true, email: true, role: true } },
      ownerApprovedBy: { select: { id: true, name: true, email: true, role: true } },
      adminApprovedBy: { select: { id: true, name: true, email: true, role: true } },
      executedBy: { select: { id: true, name: true, email: true, role: true } },
      rejectedBy: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  return NextResponse.json({ requests });
}

export async function POST(req: NextRequest) {
  try {
    const session = await authWithSession();
    if (!session || session.user.role !== 'CASHIER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const branchId = session.user.branchId ?? undefined;
    if (!branchId) return NextResponse.json({ error: 'User does not belong to a branch' }, { status: 400 });

    const body = await req.json();
    const { saleId, reason, items } = createReturnSchema.parse(body);

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true },
    });
    if (!sale || sale.branchId !== branchId) return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    if (sale.status !== 'COMPLETED') return NextResponse.json({ error: 'Only COMPLETED sales can be returned' }, { status: 400 });

    const saleItemByProductId = new Map<string, number>();
    for (const it of sale.items) saleItemByProductId.set(String(it.productId), Number(it.qty) || 0);

    const normalizedItems =
      Array.isArray(items) && items.length > 0
        ? items.map((x) => ({ productId: String(x.productId), qty: Number(x.qty) }))
        : null;

    if (normalizedItems) {
      for (const it of normalizedItems) {
        const soldQty = saleItemByProductId.get(it.productId) ?? 0;
        if (!soldQty) return NextResponse.json({ error: 'Return item not found in sale' }, { status: 400 });
        if (it.qty > soldQty) return NextResponse.json({ error: 'Return qty cannot exceed sold qty' }, { status: 400 });
      }
    }

    const existing = await prisma.returnRequest.findUnique({ where: { saleId } });
    if (existing) return NextResponse.json({ error: 'A return request already exists for this sale' }, { status: 400 });

    const requestRow = await prisma.returnRequest.create({
      data: {
        saleId,
        branchId,
        reason: reason.trim(),
        ...(normalizedItems ? { items: normalizedItems as any } : {}),
        requestedById: session.user.id,
        status: 'REQUESTED',
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'RETURN_REQUESTED',
        entity: 'Sale',
        entityId: saleId,
        newValue: JSON.stringify({ returnRequestId: requestRow.id, reason: reason.trim(), items: normalizedItems }),
      },
    });

    return NextResponse.json(requestRow, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors.map(e => e.message).join(', ') }, { status: 400 });
    }
    console.error('Error creating return request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
