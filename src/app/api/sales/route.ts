export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { authWithSession } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { startOfDay, endOfDay } from 'date-fns';

const createSaleSchema = z.object({
  clientSaleId: z.string().optional(),
  customerId: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_MONEY', 'SPLIT']),
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
      unitPrice: z.number().positive(),
      discount: z.number().nonnegative().default(0),
    })
  ),
  discount: z.number().nonnegative().default(0),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await authWithSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const paymentMethod = searchParams.get('paymentMethod');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const qRaw = searchParams.get('q') || '';

    const baseWhere: any = {
      branchId: session.user.branchId ?? undefined,
    };

    if (session.user.role === 'CASHIER') {
      baseWhere.cashierId = session.user.id;
    }

    if (status) {
      baseWhere.status = status;
    }

    if (paymentMethod) {
      baseWhere.paymentMethod = paymentMethod;
    }

    if (startDate || endDate) {
      baseWhere.createdAt = {};
      if (startDate) {
        baseWhere.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        baseWhere.createdAt.lte = new Date(endDate);
      }
    }

    const q = qRaw.trim();
    const include = {
      customer: true,
      cashier: { select: { id: true, name: true, email: true } },
      items: { include: { product: true } },
    } as const;

    if (q) {
      const qStripped = q.replace(/^R-/i, '').trim();
      const wantExactId = /^[a-fA-F0-9]{24}$/.test(qStripped);
      const qLower = qStripped.toLowerCase();
      const sample = await prisma.sale.findMany({
        where: baseWhere,
        include,
        orderBy: { createdAt: 'desc' },
        take: 200,
      });

      const filtered = sample.filter((s) => {
        const id = String(s.id || '').toLowerCase();
        const client = String((s as any).clientSaleId || '').toLowerCase();
        if (wantExactId && id === qLower) return true;
        if (qLower.length >= 3 && id.endsWith(qLower)) return true;
        if (qLower.length >= 3 && client.includes(qLower)) return true;
        return false;
      });

      const total = filtered.length;
      const paged = filtered.slice((page - 1) * limit, (page - 1) * limit + limit);
      return NextResponse.json({
        sales: paged,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where: baseWhere,
        include,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.sale.count({ where: baseWhere }),
    ]);

    return NextResponse.json({
      sales,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await authWithSession();
    if (!session || !['CASHIER', 'MANAGER', 'OWNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = createSaleSchema.parse(body);

    const settings = await prisma.setting.findMany({
      where: { key: { in: ['taxRate', 'vatMode'] } },
    });
    const settingsMap = settings.reduce((acc, cur) => {
      acc[cur.key] = cur.value;
      return acc;
    }, {} as Record<string, string>);
    const vatMode = settingsMap.vatMode === 'EXCLUSIVE' ? 'EXCLUSIVE' : 'INCLUSIVE';
    const taxRateRaw = Number(settingsMap.taxRate);
    const taxRate =
      Number.isFinite(taxRateRaw) && taxRateRaw > 0 ? (taxRateRaw > 1 ? taxRateRaw / 100 : taxRateRaw) : 0.075;

    if (validatedData.clientSaleId) {
      const existing = await prisma.sale.findFirst({
        where: {
          clientSaleId: validatedData.clientSaleId,
          branchId: session.user.branchId ?? undefined,
        },
        include: {
          items: { include: { product: true } },
          customer: true,
        },
      });
      if (existing) {
        return NextResponse.json(existing, { status: 200 });
      }
    }

    // Resolve customerId — use provided, or find/create Walk-In Customer for guest checkout
    let customerId = validatedData.customerId;
    if (!customerId) {
      let walkIn = await prisma.customer.findFirst({
        where: { branchId: session.user.branchId!, name: 'Walk-In Customer' },
      });
      if (!walkIn) {
        walkIn = await prisma.customer.create({
          data: {
            name: 'Walk-In Customer',
            branchId: session.user.branchId!,
          },
        });
      }
      customerId = walkIn.id;
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer || customer.branchId !== session.user.branchId) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    let subtotal = 0;
    let tax = 0;
    const saleItems = [];

    for (const item of validatedData.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product || product.branchId !== session.user.branchId) {
        return NextResponse.json({ error: `Product ${item.productId} not found` }, { status: 404 });
      }

      const decrementQty = item.quantity;

      if (product.stockQty < decrementQty) {
        return NextResponse.json(
          { error: `Insufficient stock for ${product.name}. Required: ${decrementQty}, Available: ${product.stockQty}` },
          { status: 400 }
        );
      }

      const itemTotal = item.unitPrice * item.quantity - item.discount;
      subtotal += itemTotal;

      if (product.isTaxable) {
        if (vatMode === 'INCLUSIVE') {
          tax += itemTotal * taxRate / (1 + taxRate);
        } else {
          tax += itemTotal * taxRate;
        }
      }

      saleItems.push({
        productId: item.productId,
        qty: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        total: itemTotal,
      });
    }

    const total = vatMode === 'EXCLUSIVE' ? subtotal + tax - validatedData.discount : subtotal - validatedData.discount;

    const sale = await prisma.sale.create({
      data: {
        ...(validatedData.clientSaleId ? { clientSaleId: validatedData.clientSaleId } : {}),
        customerId,
        cashierId: session.user.id,
        subtotal,
        tax,
        discount: validatedData.discount,
        total,
        paymentMethod: validatedData.paymentMethod,
        status: 'COMPLETED',
        notes: validatedData.notes,
        branchId: session.user.branchId!,
        items: {
          create: saleItems,
        },
      },
      include: {
        items: { include: { product: true } },
        customer: true,
      },
    });

    for (const item of sale.items) {
      const decrementAmount = item.qty;

      await prisma.product.update({
        where: { id: item.productId },
        data: {
          stockQty: {
            decrement: decrementAmount,
          },
        },
      });
    }

    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors.map(e => e.message).join(', ') }, { status: 400 });
    }
    console.error('Error creating sale:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
