/**
 * NextAuth v5 Middleware — Edge Runtime compatible
 *
 * Uses the Edge-safe authConfig (no Prisma, no bcryptjs).
 * The full auth.ts with Credentials provider runs in Node.js only.
 */
import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image  (image optimisation)
     * - favicon.ico
     * - api/auth     (NextAuth endpoints must always be public)
     * - api/cron     (Vercel Cron endpoints, secured by CRON_SECRET)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/auth|api/cron).*)',
  ],
};
