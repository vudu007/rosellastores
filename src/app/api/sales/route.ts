export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { startOfDay, endOfDay } from 'date-fns';

const createSaleSchema = z.object({
  customerId: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_MONEY']),
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
    const session = await auth();
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

    const where: any = {
      branchId: session.user.branchId ?? undefined,
    };

    if (status) {
      where.status = status;
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          customer: true,
          cashier: { select: { id: true, name: true, email: true } },
          items: { include: { product: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.sale.count({ where }),
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
    const session = await auth();
    if (!session || !['CASHIER', 'MANAGER', 'OWNER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = createSaleSchema.parse(body);

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
            type: 'RETAIL',
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
    const saleItems = [];

    for (const item of validatedData.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product || product.branchId !== session.user.branchId) {
        return NextResponse.json({ error: `Product ${item.productId} not found` }, { status: 404 });
      }

      if (product.stockQty < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for ${product.name}` },
          { status: 400 }
        );
      }

      const itemTotal = item.unitPrice * item.quantity - item.discount;
      subtotal += itemTotal;

      saleItems.push({
        productId: item.productId,
        qty: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        total: itemTotal,
      });
    }

    const taxRate = 0.075;
    const tax = subtotal * taxRate;
    const total = subtotal + tax - validatedData.discount;

    const sale = await prisma.sale.create({
      data: {
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

    for (const item of validatedData.items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: {
          stockQty: {
            decrement: item.quantity,
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

