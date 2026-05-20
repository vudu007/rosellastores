import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from '@/auth.config';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';

declare module 'next-auth' {
  interface User {
    id: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'OWNER' | 'MANAGER' | 'CASHIER';
    branchId: string | null;
    sessionId?: string;
  }

  interface Session {
    user: User;
  }

  // next-auth v5 beta: JWT augmentation lives here, not in 'next-auth/jwt'
  interface JWT {
    id: string;
    role: string;
    branchId: string | null;
    sessionId?: string;
  }
}

const parseDevice = (userAgent: string | null) => {
  if (!userAgent) return null;
  const ua = userAgent;

  const os =
    /windows/i.test(ua) ? 'Windows' :
    /android/i.test(ua) ? 'Android' :
    /iphone|ipad|ipod/i.test(ua) ? 'iOS' :
    /mac os x/i.test(ua) ? 'macOS' :
    /linux/i.test(ua) ? 'Linux' :
    'Unknown';

  const browser =
    /edg/i.test(ua) ? 'Edge' :
    /chrome/i.test(ua) && !/edg|opr/i.test(ua) ? 'Chrome' :
    /safari/i.test(ua) && !/chrome/i.test(ua) ? 'Safari' :
    /firefox/i.test(ua) ? 'Firefox' :
    /opr|opera/i.test(ua) ? 'Opera' :
    'Unknown';

  const deviceType = /mobile/i.test(ua) ? 'Mobile' : /tablet|ipad/i.test(ua) ? 'Tablet' : 'Desktop';

  return { os, browser, deviceType };
};

const getIpFromRequest = (req: Request | undefined) => {
  if (!req) return null;
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || null;
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return null;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret:
    process.env.NEXTAUTH_SECRET ??
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV === 'development' ? 'dev-secret' : undefined),
  providers: [
    Credentials({
      async authorize(credentials, req) {
        const email = (credentials.email as string | undefined)?.trim().toLowerCase();
        const password = credentials.password as string | undefined;

        const ip = getIpFromRequest(req);
        const userAgent = req?.headers.get('user-agent') ?? null;
        const device = parseDevice(userAgent);

        if (!email || !password) {
          await prisma.loginEvent.create({
            data: {
              email: email ?? '',
              success: false,
              error: 'Invalid credentials',
              ip,
              userAgent,
              device: device ? JSON.stringify(device) : null,
            },
          });
          throw new Error('Invalid credentials');
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          await prisma.loginEvent.create({
            data: {
              email,
              success: false,
              error: 'User not found',
              ip,
              userAgent,
              device: device ? JSON.stringify(device) : null,
            },
          });
          throw new Error('User not found');
        }

        if ((user as any).tempExpiresAt && new Date() > new Date((user as any).tempExpiresAt)) {
          await prisma.loginEvent.create({
            data: {
              email,
              userId: user.id,
              success: false,
              error: 'Temporary account expired',
              ip,
              userAgent,
              device: device ? JSON.stringify(device) : null,
            },
          });
          throw new Error('This temporary account has expired. Contact the administrator.');
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
          await prisma.loginEvent.create({
            data: {
              email,
              userId: user.id,
              success: false,
              error: 'Invalid password',
              ip,
              userAgent,
              device: device ? JSON.stringify(device) : null,
            },
          });
          throw new Error('Invalid password');
        }

        const createdSession = await prisma.userSession.create({
          data: {
            userId: user.id,
            ip,
            userAgent,
            device: device ? JSON.stringify(device) : null,
          },
        });

        await prisma.loginEvent.create({
          data: {
            email,
            userId: user.id,
            success: true,
            ip,
            userAgent,
            device: device ? JSON.stringify(device) : null,
            sessionId: createdSession.id,
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          branchId: user.branchId,
          sessionId: createdSession.id,
        };
      }
    }),
  ],
  trustHost: true,
});
