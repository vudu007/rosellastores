export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  barcodes: z.array(z.string()).optional(),
  categoryId: z.string(),
  costPrice: z.number().nonnegative().optional().default(0),
  retailPrice: z.number().positive(),
  stockQty: z.number().int().nonnegative(),
  lowStockThreshold: z.number().int().optional(),
  supplierId: z.string(),
  imageUrl: z.string().optional(),
  unit: z.string().optional(),
  minOrderQty: z.number().int().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: any = {
      isActive: true,
    };

    if (session.user.branchId) {
      where.branchId = session.user.branchId;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    // ?pos=1 fetches only POS-required fields (skips supplier join — faster)
    const isPosMode = searchParams.get('pos') === '1';
    const pagination = { where, skip: (page - 1) * limit, take: limit, orderBy: { name: 'asc' as const } };

    const [products, total] = await Promise.all([
      isPosMode
        ? prisma.product.findMany({
            ...pagination,
            select: {
              id: true, name: true, sku: true, barcodes: true,
              retailPrice: true, stockQty: true,
              imageUrl: true, isTaxable: true, taxInclusive: true,
              category: { select: { name: true } },
            },
          })
        : prisma.product.findMany({
            ...pagination,
            include: { category: true, supplier: true },
          }),
      prisma.product.count({ where }),
    ]);

    const res = NextResponse.json({
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
    // Allow browser to cache for 30s; CDN must not cache (auth-gated data)
    res.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
    return res;
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !['OWNER', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = createProductSchema.parse(body);

    const product = await prisma.product.create({
      data: {
        ...validatedData,
        branchId: session.user.branchId!,
        lowStockThreshold: validatedData.lowStockThreshold || 10,
        unit: validatedData.unit || 'pcs',
        minOrderQty: validatedData.minOrderQty || 1,
      },
      include: {
        category: true,
        supplier: true,
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
