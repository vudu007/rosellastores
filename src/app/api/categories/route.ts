import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const categories = await prisma.category.findMany({
      include: {
        _count: { select: { products: true } },
        parent: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
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
    const { name, parentId } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    // Check for duplicate
    const existing = await prisma.category.findUnique({ where: { name: name.trim() } });
    if (existing) {
      return NextResponse.json({ error: 'A category with this name already exists' }, { status: 400 });
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        parentId: parentId || undefined,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !['OWNER', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, parentId } = body;

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    // Check for duplicate name (excluding self)
    if (name) {
      const existing = await prisma.category.findFirst({
        where: { name: name.trim(), NOT: { id } },
      });
      if (existing) {
        return NextResponse.json({ error: 'A category with this name already exists' }, { status: 400 });
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        name: name?.trim(),
        parentId: parentId === '' ? null : parentId || undefined,
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    const productCount = await prisma.product.count({ where: { categoryId: id } });
    if (productCount > 0) {
      return NextResponse.json({ error: `Cannot delete: ${productCount} products are in this category. Move them first.` }, { status: 400 });
    }

    const childCount = await prisma.category.count({ where: { parentId: id } });
    if (childCount > 0) {
      return NextResponse.json({ error: `Cannot delete: this category has ${childCount} sub-categories. Delete them first.` }, { status: 400 });
    }

    await prisma.category.delete({ where: { id } });

    return NextResponse.json({ message: 'Category deleted' });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
