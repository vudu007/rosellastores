export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authWithSession } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

const bodySchema = z.object({
  confirm: z.literal('CLEAR_ALL_TRANSACTIONS'),
  branchId: z.string().optional().nullable(),
  dryRun: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const session = await authWithSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { branchId, dryRun } = bodySchema.parse(body);

  const saleWhere: any = branchId ? { branchId } : {};
  const returnWhere: any = branchId ? { branchId } : {};
  const saleItemWhere: any = branchId ? { sale: { branchId } } : {};

  const [saleCount, saleItemCount, returnCount] = await Promise.all([
    prisma.sale.count({ where: saleWhere }),
    prisma.saleItem.count({ where: saleItemWhere }),
    prisma.returnRequest.count({ where: returnWhere }),
  ]);

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      scope: branchId ? 'BRANCH' : 'GLOBAL',
      branchId: branchId ?? null,
      counts: {
        sales: saleCount,
        saleItems: saleItemCount,
        returnRequests: returnCount,
      },
    });
  }

  const [deletedReturns, deletedSaleItems] = await Promise.all([
    prisma.returnRequest.deleteMany({ where: returnWhere }),
    prisma.saleItem.deleteMany({ where: saleItemWhere }),
  ]);

  const deletedSales = await prisma.sale.deleteMany({ where: saleWhere });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'ADMIN_CLEAR_TRANSACTIONS',
      entity: 'Sale',
      entityId: branchId ?? 'GLOBAL',
      newValue: JSON.stringify({
        scope: branchId ? 'BRANCH' : 'GLOBAL',
        branchId: branchId ?? null,
        deleted: {
          returnRequests: deletedReturns.count,
          saleItems: deletedSaleItems.count,
          sales: deletedSales.count,
        },
      }),
    },
  });

  return NextResponse.json({
    ok: true,
    scope: branchId ? 'BRANCH' : 'GLOBAL',
    branchId: branchId ?? null,
    deleted: {
      returnRequests: deletedReturns.count,
      saleItems: deletedSaleItems.count,
      sales: deletedSales.count,
    },
    previousCounts: {
      returnRequests: returnCount,
      saleItems: saleItemCount,
      sales: saleCount,
    },
  });
}

