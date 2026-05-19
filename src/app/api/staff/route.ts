export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const where: any = {};
    where.branchId = session.user.branchId ?? undefined;

    const staff = await prisma.user.findMany({
      where,
      include: { branch: true },
      orderBy: { createdAt: 'desc' },
    });

    const safeStaff = staff.map(({ password, ...rest }) => rest);
    return NextResponse.json(safeStaff);
  } catch (error) {
    console.error('Error fetching staff:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, email, password, role, branchId, tempAccount } = body;

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: 'Name, email, password and role are required' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const tempExpiresAt = tempAccount ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;

    const newUser = await prisma.user.create({
      data: {
        name, email,
        password: hashedPassword,
        role,
        branchId: branchId || null,
        ...(tempExpiresAt ? { tempExpiresAt } : {}),
      },
    });

    const { password: _, ...safeUser } = newUser;
    return NextResponse.json(safeUser, { status: 201 });
  } catch (error) {
    console.error('Error creating staff:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, email, password, role, branchId, tempAccount } = body;

    if (!id || !name || !email || !role) {
      return NextResponse.json({ error: 'id, name, email and role are required' }, { status: 400 });
    }

    // Protection for ADMIN accounts
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    if (targetUser.role === 'ADMIN' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only Admins can modify other Admin accounts' }, { status: 403 });
    }

    const updateData: any = { name, email, role, branchId: branchId || null };
    if (password) updateData.password = await bcrypt.hash(password, 10);
    if (tempAccount) {
      updateData.tempExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    } else {
      updateData.tempExpiresAt = null;
    }

    const updated = await prisma.user.update({ where: { id }, data: updateData });
    const { password: _, ...safeUser } = updated;
    return NextResponse.json(safeUser);
  } catch (error) {
    console.error('Error updating staff:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    if (id === session.user.id) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
    }

    // Protection for ADMIN accounts
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (targetUser?.role === 'ADMIN' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only Admins can delete other Admin accounts' }, { status: 403 });
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting staff:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
