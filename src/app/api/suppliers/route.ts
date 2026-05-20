export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { authWithSession } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await authWithSession();
    if (!session || !['ADMIN', 'OWNER', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const suppliers = await prisma.supplier.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(suppliers);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await authWithSession();
    if (!session || !['ADMIN', 'OWNER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, contact, email, phone, address } = body;

    if (!name || !contact || !phone) {
      return NextResponse.json({ error: 'Name, contact person, and phone are required' }, { status: 400 });
    }

    const supplier = await prisma.supplier.create({
      data: { name, contact, email, phone, address },
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    console.error('Error creating supplier:', error);
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
    const { id, name, contact, email, phone, address } = body;

    if (!id) {
      return NextResponse.json({ error: 'Supplier ID is required' }, { status: 400 });
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data: { name, contact, email, phone, address },
    });

    return NextResponse.json(supplier);
  } catch (error) {
    console.error('Error updating supplier:', error);
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
      return NextResponse.json({ error: 'Supplier ID is required' }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const reason = (body?.reason as string | undefined)?.trim();
    if (!reason) {
      return NextResponse.json({ error: 'Deletion reason is required' }, { status: 400 });
    }

    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

    const alreadyDeleted = existing.isActive === false;
    if (!alreadyDeleted) {
      await prisma.supplier.update({
        where: { id },
        data: { isActive: false, deletedAt: new Date(), deletedById: session.user.id },
      });
    }

    const earliestPermanentAt = new Date(Date.now() + 72 * 60 * 60_000);

    const request = await prisma.deletionRequest.create({
      data: {
        entityType: 'SUPPLIER',
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
        entity: 'Supplier',
        entityId: id,
        newValue: JSON.stringify({ reason, deletionRequestId: request.id }),
      },
    });

    return NextResponse.json({ message: 'Supplier soft-deleted', deletionRequestId: request.id });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

