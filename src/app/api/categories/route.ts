export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { authWithSession } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await authWithSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const categories = await prisma.category.findMany({
      where: includeInactive ? {} : { isActive: true },
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
    const session = await authWithSession();
    if (!session || !['ADMIN', 'OWNER', 'MANAGER'].includes(session.user.role)) {
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
    const session = await authWithSession();
    if (!session || !['ADMIN', 'OWNER', 'MANAGER'].includes(session.user.role)) {
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
    const session = await authWithSession();
    if (!session || !['ADMIN', 'OWNER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const reason = (body?.reason as string | undefined)?.trim();
    if (!reason) {
      return NextResponse.json({ error: 'Deletion reason is required' }, { status: 400 });
    }

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

    const alreadyDeleted = existing.isActive === false;
    if (!alreadyDeleted) {
      await prisma.category.update({
        where: { id },
        data: { isActive: false, deletedAt: new Date(), deletedById: session.user.id },
      });
    }

    const earliestPermanentAt = new Date(Date.now() + 72 * 60 * 60_000);

    const request = await prisma.deletionRequest.create({
      data: {
        entityType: 'CATEGORY',
        entityId: id,
        reason,
        earliestPermanentAt,
        requestedById: session.user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'SOFT_DELETE',
        entity: 'Category',
        entityId: id,
        newValue: JSON.stringify({ reason, deletionRequestId: request.id }),
      },
    });

    return NextResponse.json({ message: 'Category soft-deleted', deletionRequestId: request.id });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

