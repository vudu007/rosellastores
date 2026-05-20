export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authWithSession } from '@/lib/authz';

export async function GET(req: NextRequest) {
  const session = await authWithSession();
  if (!session || !['ADMIN', 'OWNER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const take = Math.min(parseInt(searchParams.get('take') || '200', 10) || 200, 500);
  const status = searchParams.get('status');

  const where: any = {};
  if (status && ['SOFT_DELETED', 'APPROVED', 'PERMANENT_DELETED', 'CANCELLED'].includes(status)) {
    where.status = status;
  }

  const requests = await prisma.deletionRequest.findMany({
    where,
    orderBy: { requestedAt: 'desc' },
    take,
    include: {
      requestedBy: { select: { id: true, name: true, email: true, role: true } },
      approvedBy: { select: { id: true, name: true, email: true, role: true } },
      executedBy: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  const categoryIds = requests.filter((r) => r.entityType === 'CATEGORY').map((r) => r.entityId);
  const supplierIds = requests.filter((r) => r.entityType === 'SUPPLIER').map((r) => r.entityId);
  const productIds = requests.filter((r) => r.entityType === 'PRODUCT').map((r) => r.entityId);

  const [categories, suppliers, products] = await Promise.all([
    categoryIds.length
      ? prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true, isActive: true } })
      : Promise.resolve([]),
    supplierIds.length
      ? prisma.supplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, name: true, isActive: true } })
      : Promise.resolve([]),
    productIds.length
      ? prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, sku: true, isActive: true } })
      : Promise.resolve([]),
  ]);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const supplierMap = new Map(suppliers.map((s) => [s.id, s]));
  const productMap = new Map(products.map((p) => [p.id, p]));

  const enriched = requests.map((r) => {
    const entity =
      r.entityType === 'CATEGORY'
        ? categoryMap.get(r.entityId) ?? null
        : r.entityType === 'SUPPLIER'
          ? supplierMap.get(r.entityId) ?? null
          : productMap.get(r.entityId) ?? null;

    return {
      ...r,
      entity,
    };
  });

  return NextResponse.json({ requests: enriched });
}

