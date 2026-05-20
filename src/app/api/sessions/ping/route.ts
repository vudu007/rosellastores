export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { authWithSession } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

export async function POST() {
  const session = await authWithSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sessionId = (session.user as any).sessionId as string | undefined;
  if (!sessionId) {
    return NextResponse.json({ ok: true });
  }

  await prisma.userSession.updateMany({
    where: { id: sessionId, userId: session.user.id },
    data: { lastSeenAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
