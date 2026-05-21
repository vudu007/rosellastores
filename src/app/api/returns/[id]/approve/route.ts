export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authWithSession } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

const approveSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
});

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await authWithSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = session.user.role;
    if (!['OWNER', 'ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Only OWNER and ADMIN can approve returns' }, { status: 401 });
    }

    const branchId = session.user.branchId ?? undefined;
    if (!branchId) return NextResponse.json({ error: 'User does not belong to a branch' }, { status: 400 });

    const { id } = await context.params;
    const body = await req.json();
    const { decision } = approveSchema.parse(body);

    const requestRow = await prisma.returnRequest.findUnique({
      where: { id },
      include: { sale: { include: { items: true } } },
    });
    if (!requestRow || requestRow.branchId !== branchId) {
      return NextResponse.json({ error: 'Return request not found' }, { status: 404 });
    }
    if (requestRow.status === 'COMPLETED') return NextResponse.json({ error: 'Return already completed' }, { status: 400 });
    if (requestRow.status === 'REJECTED') return NextResponse.json({ error: 'Return request is rejected' }, { status: 400 });

    if (decision === 'REJECT') {
      const updated = await prisma.returnRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectedById: session.user.id,
          rejectedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'RETURN_REJECTED',
          entity: 'Sale',
          entityId: requestRow.saleId,
          newValue: JSON.stringify({ returnRequestId: id }),
        },
      });

      return NextResponse.json(updated);
    }

    if (requestRow.ownerApprovedById || requestRow.adminApprovedById) {
      return NextResponse.json({ error: 'Return request is already approved' }, { status: 400 });
    }

    const patch: any = {};
    if (role === 'OWNER') {
      patch.ownerApprovedById = session.user.id;
      patch.ownerApprovedAt = new Date();
    } else {
      patch.adminApprovedById = session.user.id;
      patch.adminApprovedAt = new Date();
    }

    const updated = await prisma.returnRequest.update({
      where: { id },
      data: patch,
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: role === 'OWNER' ? 'RETURN_OWNER_APPROVED' : 'RETURN_ADMIN_APPROVED',
        entity: 'Sale',
        entityId: requestRow.saleId,
        newValue: JSON.stringify({ returnRequestId: id }),
      },
    });

    if (!requestRow.sale) return NextResponse.json({ error: 'Sale not found for return request' }, { status: 404 });
    if (requestRow.sale.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Sale is not eligible for return' }, { status: 400 });
    }

    for (const item of requestRow.sale.items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stockQty: { increment: item.qty } },
      });
    }

    await prisma.sale.update({
      where: { id: requestRow.saleId },
      data: { status: 'RETURNED' },
    });

    const completed = await prisma.returnRequest.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        executedById: session.user.id,
        executedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'RETURN_COMPLETED',
        entity: 'Sale',
        entityId: requestRow.saleId,
        newValue: JSON.stringify({ returnRequestId: id }),
      },
    });

    return NextResponse.json(completed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors.map(e => e.message).join(', ') }, { status: 400 });
    }
    console.error('Return approval error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
