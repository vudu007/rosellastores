export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authWithSession } from '@/lib/authz';

const schema = z.object({
  sessionId: z.string().min(1),
  reason: z.string().min(3),
});

export async function POST(req: NextRequest) {
  const session = await authWithSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { sessionId, reason } = schema.parse(body);

  const target = await prisma.userSession.findUnique({
    where: { id: sessionId },
    select: { id: true, userId: true, revokedAt: true },
  });

  if (!target) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  if (!target.revokedAt) {
    await prisma.userSession.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
        revokedById: session.user.id,
        revokeReason: reason,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'FORCE_LOGOUT',
      entity: 'UserSession',
      entityId: sessionId,
      newValue: JSON.stringify({ reason, targetUserId: target.userId }),
    },
  });

  return NextResponse.json({ ok: true });
}

