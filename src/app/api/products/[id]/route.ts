import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
  barcode: z.string().optional(),
  categoryId: z.string().optional(),
  retailPrice: z.number().positive().optional(),
  wholesalePrice: z.number().positive().optional(),
  stockQty: z.number().int().nonnegative().optional(),
  lowStockThreshold: z.number().int().optional(),
  supplierId: z.string().optional(),
  imageUrl: z.string().optional(),
  unit: z.string().optional(),
  minOrderQty: z.number().int().optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        category: true,
        supplier: true,
      },
    });

    if (!product || product.branchId !== session.user.branchId) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session || !['OWNER', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const product = await prisma.product.findUnique({
      where: { id: params.id },
    });

    if (!product || product.branchId !== session.user.branchId) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const body = await req.json();
    const validatedData = updateProductSchema.parse(body);

    const updatedProduct = await prisma.product.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        category: true,
        supplier: true,
      },
    });

    return NextResponse.json(updatedProduct);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Error updating product:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session || !['OWNER', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const product = await prisma.product.findUnique({
      where: { id: params.id },
    });

    if (!product || product.branchId !== session.user.branchId) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    await prisma.product.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
