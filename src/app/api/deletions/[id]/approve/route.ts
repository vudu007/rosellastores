export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authWithSession } from '@/lib/authz';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await authWithSession();
  if (!session || !['ADMIN', 'OWNER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  const request = await prisma.deletionRequest.findUnique({
    where: { id },
    select: { id: true, status: true, requestedById: true, entityType: true, entityId: true, reason: true },
  });

  if (!request) return NextResponse.json({ error: 'Deletion request not found' }, { status: 404 });
  if (request.status !== 'SOFT_DELETED') {
    return NextResponse.json({ error: 'Deletion request is not awaiting approval' }, { status: 400 });
  }
  if (request.requestedById === session.user.id) {
    return NextResponse.json({ error: 'A second authorized user must approve this deletion' }, { status: 400 });
  }

  await prisma.deletionRequest.update({
    where: { id },
    data: { status: 'APPROVED', approvedById: session.user.id, approvedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'DELETE_APPROVED',
      entity: request.entityType,
      entityId: request.entityId,
      newValue: JSON.stringify({ deletionRequestId: id, reason: request.reason }),
    },
  });

  return NextResponse.json({ ok: true });
}

