export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authWithSession } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  dryRun: z.boolean().optional().default(false),
  maxProducts: z.number().int().positive().optional().default(10000),
  maxEntities: z.number().int().positive().optional().default(2000),
  cursor: z.string().optional().nullable(),
  batchSize: z.number().int().positive().max(500).optional().default(300),
});

const isRecordNotFound = (err: any) => {
  const code = (err as any)?.code as string | undefined;
  if (code === 'P2025') return true;
  const msg = String((err as any)?.message || '');
  return msg.includes('Record to delete does not exist') || msg.includes('required but not found');
};

export async function POST(req: NextRequest) {
  const session = await authWithSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { dryRun, maxProducts, maxEntities, cursor, batchSize } = schema.parse(body);
  const branchId = session.user.branchId ?? undefined;

  const supplierPatterns = ['E2E', 'Imported'];
  const categoryPatterns = ['E2E'];
  const productNamePatterns = ['E2E'];
  const productSkuPrefixes = ['IMP-'];

  const supplierWhere: any = {
    OR: supplierPatterns.map((p) => ({ name: { startsWith: p, mode: 'insensitive' as const } })),
  };
  const categoryWhere: any = {
    OR: categoryPatterns.map((p) => ({ name: { startsWith: p, mode: 'insensitive' as const } })),
  };

  const [suppliers, categories] = await Promise.all([
    prisma.supplier.findMany({ where: supplierWhere, select: { id: true, name: true }, take: maxEntities }),
    prisma.category.findMany({ where: categoryWhere, select: { id: true, name: true, parentId: true }, take: maxEntities }),
  ]);

  const supplierIds = suppliers.map((s) => s.id);
  const categoryIds = categories.map((c) => c.id);

  const productWhere: any = {
    OR: [
      ...(supplierIds.length ? [{ supplierId: { in: supplierIds } }] : []),
      ...(categoryIds.length ? [{ categoryId: { in: categoryIds } }] : []),
      ...productSkuPrefixes.map((p) => ({ sku: { startsWith: p, mode: 'insensitive' as const } })),
      ...productNamePatterns.map((p) => ({ name: { startsWith: p, mode: 'insensitive' as const } })),
    ],
  };
  if (branchId) productWhere.branchId = branchId;

  if (dryRun) {
    const [matchedProducts, matchedSuppliers, matchedCategories] = await Promise.all([
      prisma.product.count({ where: productWhere }),
      prisma.supplier.count({ where: supplierWhere }),
      prisma.category.count({ where: categoryWhere }),
    ]);

    return NextResponse.json({
      ok: true,
      dryRun: true,
      matched: {
        suppliers: Math.min(matchedSuppliers, maxEntities),
        categories: Math.min(matchedCategories, maxEntities),
        products: Math.min(matchedProducts, maxProducts),
      },
    });
  }

  const take = Math.min(batchSize, maxProducts);
  const batch = await prisma.product.findMany({
    where: productWhere,
    select: { id: true },
    orderBy: { id: 'asc' },
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take,
  });

  const productIds = batch.map((p) => p.id);
  const saleItems = productIds.length
    ? await prisma.saleItem.findMany({ where: { productId: { in: productIds } }, select: { productId: true } })
    : [];
  const protectedProductIds = new Set(saleItems.map((s) => s.productId));
  const deletableProductIds = productIds.filter((id) => !protectedProductIds.has(id));

  const deleted: any = {
    products: 0,
    priceTags: 0,
    categories: 0,
    suppliers: 0,
  };

  if (deletableProductIds.length) {
    const pt = await prisma.priceTag.deleteMany({ where: { productId: { in: deletableProductIds } } });
    deleted.priceTags += pt.count;
    const pr = await prisma.product.deleteMany({ where: { id: { in: deletableProductIds } } });
    deleted.products += pr.count;
  }

  const blocked: any = {
    productsWithSales: protectedProductIds.size,
    categoriesWithProducts: [] as Array<{ id: string; name: string; productCount: number }>,
    categoriesWithChildren: [] as Array<{ id: string; name: string; childCount: number }>,
    suppliersWithProducts: [] as Array<{ id: string; name: string; productCount: number }>,
  };

  const categoriesById = new Map(categories.map((c) => [c.id, c]));

  const doneProducts = batch.length < take;
  if (doneProducts) {
    if (categories.length) {
      const pending = new Set(categories.map((c) => c.id));
      for (let pass = 0; pass < 10 && pending.size > 0; pass++) {
        let progress = 0;
        for (const id of Array.from(pending)) {
          const productCount = await prisma.product.count({ where: { categoryId: id } });
          if (productCount > 0) continue;
          const childCount = await prisma.category.count({ where: { parentId: id } });
          if (childCount > 0) continue;
          try {
            await prisma.category.delete({ where: { id } });
          } catch (e: any) {
            if (!isRecordNotFound(e)) throw e;
          }
          pending.delete(id);
          deleted.categories += 1;
          progress += 1;
        }
        if (progress === 0) break;
      }

      for (const id of Array.from(pending)) {
        const c = categoriesById.get(id);
        const productCount = await prisma.product.count({ where: { categoryId: id } });
        const childCount = await prisma.category.count({ where: { parentId: id } });
        if (productCount > 0 && c) blocked.categoriesWithProducts.push({ id, name: c.name, productCount });
        if (childCount > 0 && c) blocked.categoriesWithChildren.push({ id, name: c.name, childCount });
      }
    }

    if (suppliers.length) {
      for (const s of suppliers) {
        const productCount = await prisma.product.count({ where: { supplierId: s.id } });
        if (productCount > 0) {
          blocked.suppliersWithProducts.push({ id: s.id, name: s.name, productCount });
          continue;
        }
        try {
          await prisma.supplier.delete({ where: { id: s.id } });
        } catch (e: any) {
          if (!isRecordNotFound(e)) throw e;
        }
        deleted.suppliers += 1;
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'PERMANENT_DELETE',
        entity: 'DUMMY_PURGE',
        entityId: session.user.branchId ?? 'GLOBAL',
        newValue: JSON.stringify({
          deleted,
          blocked,
        }),
      },
    });
  }

  return NextResponse.json({
    ok: true,
    done: doneProducts,
    nextCursor: doneProducts ? null : batch[batch.length - 1]?.id ?? null,
    deleted,
    blocked,
  });
}
