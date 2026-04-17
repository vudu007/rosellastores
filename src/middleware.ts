/**
 * NextAuth v5 Middleware
 * Runs the `authorized` callback from auth.ts on every matched request,
 * redirecting unauthenticated users to /login before the page renders.
 */
export { auth as middleware } from '@/lib/auth';

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image  (image optimisation)
     * - favicon.ico
     * - api/auth     (NextAuth endpoints must always be public)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/auth).*)',
  ],
};
