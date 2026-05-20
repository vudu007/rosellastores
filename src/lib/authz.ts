import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const authWithSession = async () => {
  const session = await auth();
  if (!session?.user) return null;

  const sessionId = (session.user as any).sessionId as string | undefined;
  if (!sessionId) return session;

  const record = await prisma.userSession.findUnique({
    where: { id: sessionId },
    select: { revokedAt: true, userId: true },
  });

  if (!record || record.revokedAt || record.userId !== session.user.id) return null;

  return session;
};

