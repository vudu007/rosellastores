/**
 * ONE-TIME admin account creation endpoint.
 * Deletes any broken existing admin and creates a fresh one.
 * Locks itself once a working admin exists (verified by password check).
 *
 * GET  /api/setup/admin  → creates the admin user
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

const ADMIN_EMAIL    = 'superadmin@rosellastores.com';
const ADMIN_PASSWORD = 'admin123';

export async function GET() {
  try {
    const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
    if (existing) {
      return NextResponse.json(
        { error: 'Admin already exists. Use the Admin account to manage staff and settings.' },
        { status: 409 }
      );
    }

    // Find first branch
    const branch = await prisma.branch.findFirst();
    if (!branch) {
      return NextResponse.json(
        { error: 'No branch found. Run the seed first (npm run db:seed).' },
        { status: 400 }
      );
    }

    const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);

    const admin = await prisma.user.create({
      data: {
        name:     'Admin',
        email:    ADMIN_EMAIL,
        password: hashed,
        role:     'ADMIN',
        branchId: branch.id,
      },
    });

    return NextResponse.json({
      success:  true,
      message:  'Admin account created. Login now, then change the password from Settings.',
      email:    ADMIN_EMAIL,
      userId:   admin.id,
    });

  } catch (error: any) {
    console.error('Setup admin error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
