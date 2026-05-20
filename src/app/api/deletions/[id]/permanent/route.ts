export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authWithSession } from '@/lib/authz';

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await authWithSession();
  if (!session || !['ADMIN', 'OWNER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  const requestRow = await prisma.deletionRequest.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      entityType: true,
      entityId: true,
      reason: true,
      requestedById: true,
      approvedById: true,
      earliestPermanentAt: true,
    },
  });

  if (!requestRow) return NextResponse.json({ error: 'Deletion request not found' }, { status: 404 });
  if (session.user.role === 'ADMIN') {
    if (!['SOFT_DELETED', 'APPROVED'].includes(requestRow.status)) {
      return NextResponse.json({ error: 'Deletion request cannot be permanently deleted' }, { status: 400 });
    }
  } else {
    if (requestRow.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Deletion request is not approved' }, { status: 400 });
    }
  }
  if (session.user.role !== 'ADMIN') {
    if (!requestRow.approvedById || requestRow.approvedById === requestRow.requestedById) {
      return NextResponse.json({ error: 'Second-user approval is required' }, { status: 400 });
    }
  }
  if (session.user.role !== 'ADMIN' && new Date() < requestRow.earliestPermanentAt) {
    return NextResponse.json({ error: 'Permanent deletion is locked for 72 hours after soft delete' }, { status: 400 });
  }

  if (requestRow.entityType === 'PRODUCT') {
    const saleItemCount = await prisma.saleItem.count({ where: { productId: requestRow.entityId } });
    if (saleItemCount > 0) {
      return NextResponse.json(
        { error: `Cannot permanently delete product: linked to ${saleItemCount} sale item(s).` },
        { status: 400 }
      );
    }
    await prisma.product.delete({ where: { id: requestRow.entityId } });
  } else if (requestRow.entityType === 'CATEGORY') {
    const productCount = await prisma.product.count({ where: { categoryId: requestRow.entityId } });
    if (productCount > 0) {
      return NextResponse.json(
        { error: `Cannot permanently delete category: ${productCount} product(s) still reference it.` },
        { status: 400 }
      );
    }
    const childCount = await prisma.category.count({ where: { parentId: requestRow.entityId } });
    if (childCount > 0) {
      return NextResponse.json(
        { error: `Cannot permanently delete category: ${childCount} sub-category(ies) still reference it.` },
        { status: 400 }
      );
    }
    await prisma.category.delete({ where: { id: requestRow.entityId } });
  } else if (requestRow.entityType === 'SUPPLIER') {
    const productCount = await prisma.product.count({ where: { supplierId: requestRow.entityId } });
    if (productCount > 0) {
      return NextResponse.json(
        { error: `Cannot permanently delete supplier: ${productCount} product(s) still reference it.` },
        { status: 400 }
      );
    }
    await prisma.supplier.delete({ where: { id: requestRow.entityId } });
  } else {
    return NextResponse.json({ error: 'Unsupported entity type' }, { status: 400 });
  }

  await prisma.deletionRequest.update({
    where: { id },
    data: { status: 'PERMANENT_DELETED', executedById: session.user.id, executedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'PERMANENT_DELETE',
      entity: requestRow.entityType,
      entityId: requestRow.entityId,
      newValue: JSON.stringify({ deletionRequestId: id, reason: requestRow.reason }),
    },
  });

  return NextResponse.json({ ok: true });
}
