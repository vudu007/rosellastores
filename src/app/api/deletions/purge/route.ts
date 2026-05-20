export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authWithSession } from '@/lib/authz';

const purgeSchema = z.object({
  entityTypes: z.array(z.enum(['PRODUCT', 'CATEGORY', 'SUPPLIER'])).optional(),
  includeOrphans: z.boolean().optional().default(true),
});

type PurgeResult = {
  entityType: 'PRODUCT' | 'CATEGORY' | 'SUPPLIER';
  entityId: string;
  deletionRequestId: string | null;
  ok: boolean;
  error?: string;
};

export async function POST(req: NextRequest) {
  const session = await authWithSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { entityTypes, includeOrphans } = purgeSchema.parse(body);
  const types = entityTypes?.length ? entityTypes : (['PRODUCT', 'CATEGORY', 'SUPPLIER'] as const);

  const existingRequests = await prisma.deletionRequest.findMany({
    where: {
      entityType: { in: types as any },
      status: { in: ['SOFT_DELETED', 'APPROVED'] },
    },
    select: {
      id: true,
      entityType: true,
      entityId: true,
      reason: true,
    },
    orderBy: { requestedAt: 'asc' },
    take: 2000,
  });

  const requestKeys = new Set(existingRequests.map((r) => `${r.entityType}:${r.entityId}`));

  const orphanCandidates: Array<{ entityType: 'PRODUCT' | 'CATEGORY' | 'SUPPLIER'; entityId: string }> = [];
  if (includeOrphans) {
    if (types.includes('PRODUCT')) {
      const products = await prisma.product.findMany({
        where: { isActive: false, deletedAt: { not: null } },
        select: { id: true },
        take: 2000,
      });
      for (const p of products) {
        const key = `PRODUCT:${p.id}`;
        if (!requestKeys.has(key)) orphanCandidates.push({ entityType: 'PRODUCT', entityId: p.id });
      }
    }
    if (types.includes('CATEGORY')) {
      const categories = await prisma.category.findMany({
        where: { isActive: false, deletedAt: { not: null } },
        select: { id: true },
        take: 2000,
      });
      for (const c of categories) {
        const key = `CATEGORY:${c.id}`;
        if (!requestKeys.has(key)) orphanCandidates.push({ entityType: 'CATEGORY', entityId: c.id });
      }
    }
    if (types.includes('SUPPLIER')) {
      const suppliers = await prisma.supplier.findMany({
        where: { isActive: false, deletedAt: { not: null } },
        select: { id: true },
        take: 2000,
      });
      for (const s of suppliers) {
        const key = `SUPPLIER:${s.id}`;
        if (!requestKeys.has(key)) orphanCandidates.push({ entityType: 'SUPPLIER', entityId: s.id });
      }
    }
  }

  const results: PurgeResult[] = [];

  const runDelete = async (entityType: PurgeResult['entityType'], entityId: string, deletionRequestId: string | null, reason: string) => {
    if (entityType === 'PRODUCT') {
      const saleItemCount = await prisma.saleItem.count({ where: { productId: entityId } });
      if (saleItemCount > 0) throw new Error(`Cannot permanently delete product: linked to ${saleItemCount} sale item(s).`);
      await prisma.product.delete({ where: { id: entityId } });
    } else if (entityType === 'CATEGORY') {
      const softProducts = await prisma.product.findMany({
        where: { categoryId: entityId },
        select: { id: true },
        take: 2000,
      });
      for (const p of softProducts) {
        const saleItemCount = await prisma.saleItem.count({ where: { productId: p.id } });
        if (saleItemCount === 0) {
          await prisma.product.delete({ where: { id: p.id } });
        }
      }

      const productCount = await prisma.product.count({ where: { categoryId: entityId } });
      if (productCount > 0) throw new Error(`Cannot permanently delete category: ${productCount} product(s) still reference it (some may be active or have sales history).`);
      const childCount = await prisma.category.count({ where: { parentId: entityId } });
      if (childCount > 0) throw new Error(`Cannot permanently delete category: ${childCount} sub-category(ies) still reference it.`);
      await prisma.category.delete({ where: { id: entityId } });
    } else if (entityType === 'SUPPLIER') {
      const softProducts = await prisma.product.findMany({
        where: { supplierId: entityId },
        select: { id: true },
        take: 2000,
      });
      for (const p of softProducts) {
        const saleItemCount = await prisma.saleItem.count({ where: { productId: p.id } });
        if (saleItemCount === 0) {
          await prisma.product.delete({ where: { id: p.id } });
        }
      }

      const productCount = await prisma.product.count({ where: { supplierId: entityId } });
      if (productCount > 0) throw new Error(`Cannot permanently delete supplier: ${productCount} product(s) still reference it (some may be active or have sales history).`);
      await prisma.supplier.delete({ where: { id: entityId } });
    } else {
      throw new Error('Unsupported entity type');
    }

    if (deletionRequestId) {
      await prisma.deletionRequest.update({
        where: { id: deletionRequestId },
        data: { status: 'PERMANENT_DELETED', executedById: session.user.id, executedAt: new Date() },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'PERMANENT_DELETE',
        entity: entityType,
        entityId,
        newValue: JSON.stringify({ deletionRequestId, reason, mode: 'ADMIN_PURGE' }),
      },
    });
  };

  const orderedTypes: PurgeResult['entityType'][] = ['PRODUCT', 'CATEGORY', 'SUPPLIER'];
  for (const t of orderedTypes) {
    if (!types.includes(t)) continue;

    const reqs = existingRequests.filter((r) => r.entityType === t);
    for (const r of reqs) {
      try {
        await runDelete(r.entityType as any, r.entityId, r.id, r.reason);
        results.push({ entityType: r.entityType as any, entityId: r.entityId, deletionRequestId: r.id, ok: true });
      } catch (e: any) {
        results.push({
          entityType: r.entityType as any,
          entityId: r.entityId,
          deletionRequestId: r.id,
          ok: false,
          error: e?.message || 'Failed',
        });
      }
    }

    const orphans = orphanCandidates.filter((o) => o.entityType === t);
    for (const o of orphans) {
      try {
        await runDelete(o.entityType, o.entityId, null, 'Orphan soft delete purge');
        results.push({ entityType: o.entityType, entityId: o.entityId, deletionRequestId: null, ok: true });
      } catch (e: any) {
        results.push({
          entityType: o.entityType,
          entityId: o.entityId,
          deletionRequestId: null,
          ok: false,
          error: e?.message || 'Failed',
        });
      }
    }
  }

  const ok = results.filter((x) => x.ok).length;
  const failed = results.length - ok;

  return NextResponse.json({
    ok: true,
    summary: { attempted: results.length, deleted: ok, failed },
    results,
  });
}
