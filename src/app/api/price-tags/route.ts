export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const markPrintedSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !['OWNER', 'MANAGER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'PENDING';
    const take = Math.min(parseInt(searchParams.get('take') || '200'), 500);

    const where: any = {
      branchId: session.user.branchId ?? undefined,
    };

    if (status !== 'ALL') {
      where.status = status;
    }

    const tags = await prisma.priceTag.findMany({
      where,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            barcodes: true,
            retailPrice: true,
            unit: true,
          },
        },
      },
    });

    return NextResponse.json({ tags });
  } catch (error) {
    console.error('Error fetching price tags:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !['OWNER', 'MANAGER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validated = markPrintedSchema.parse(body);

    const result = await prisma.priceTag.updateMany({
      where: {
        id: { in: validated.ids },
        branchId: session.user.branchId!,
        status: 'PENDING',
      },
      data: {
        status: 'PRINTED',
        printedAt: new Date(),
      },
    });

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors.map(e => e.message).join(', ') }, { status: 400 });
    }
    console.error('Error marking price tags printed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

