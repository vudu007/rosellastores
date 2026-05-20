export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authWithSession } from '@/lib/authz';

const isActive = (lastSeenAt: Date, revokedAt: Date | null, expiresAt: Date | null) => {
  if (revokedAt) return false;
  if (expiresAt && expiresAt.getTime() <= Date.now()) return false;
  return lastSeenAt.getTime() >= Date.now() - 5 * 60_000;
};

export async function GET(req: NextRequest) {
  const session = await authWithSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const takeSessions = Math.min(parseInt(searchParams.get('takeSessions') || '100', 10) || 100, 500);
  const takeEvents = Math.min(parseInt(searchParams.get('takeEvents') || '200', 10) || 200, 1000);

  const [sessions, events] = await Promise.all([
    prisma.userSession.findMany({
      orderBy: { createdAt: 'desc' },
      take: takeSessions,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        revokedBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.loginEvent.findMany({
      orderBy: { timestamp: 'desc' },
      take: takeEvents,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    }),
  ]);

  const sessionRows = sessions.map((s) => ({
    id: s.id,
    user: s.user,
    ip: s.ip,
    userAgent: s.userAgent,
    device: s.device,
    createdAt: s.createdAt,
    lastSeenAt: s.lastSeenAt,
    expiresAt: s.expiresAt,
    revokedAt: s.revokedAt,
    revokedBy: s.revokedBy,
    revokeReason: s.revokeReason,
    status: isActive(s.lastSeenAt, s.revokedAt, s.expiresAt) ? 'ACTIVE' : 'INACTIVE',
  }));

  return NextResponse.json({ sessions: sessionRows, events });
}

