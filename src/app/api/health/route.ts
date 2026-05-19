export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const rawDbUrl = process.env.DATABASE_URL;
  const rawAuthUrl = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL;
  const rawAuthSecret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;

  const env = {
    databaseUrlPresent: !!rawDbUrl,
    databaseUrlHasQuotes: !!rawDbUrl && (rawDbUrl.startsWith('"') || rawDbUrl.endsWith('"')),
    nextAuthUrlPresent: !!rawAuthUrl,
    nextAuthUrlHasQuotes: !!rawAuthUrl && (rawAuthUrl.startsWith('"') || rawAuthUrl.endsWith('"')),
    nextAuthSecretPresent: !!rawAuthSecret,
    nextAuthSecretHasQuotes: !!rawAuthSecret && (rawAuthSecret.startsWith('"') || rawAuthSecret.endsWith('"')),
  };

  try {
    const [branchCount, userCount] = await Promise.all([prisma.branch.count(), prisma.user.count()]);
    return NextResponse.json({
      ok: true,
      env,
      db: { connected: true, branchCount, userCount },
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      env,
      db: { connected: false },
      error: error?.message || 'Unknown error',
    });
  }
}

