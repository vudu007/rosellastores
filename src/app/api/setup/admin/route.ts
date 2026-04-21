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

const ADMIN_EMAIL    = 'admin@mekaerp.com';
const ADMIN_PASSWORD = 'Admin2025!';

export async function GET() {
  try {
    // Delete any existing admin with this email (clears broken entries)
    await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } });

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
        name:     'Super Admin',
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
      password: ADMIN_PASSWORD,
      userId:   admin.id,
    });

  } catch (error: any) {
    console.error('Setup admin error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
