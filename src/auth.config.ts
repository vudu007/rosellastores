import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: { signIn: '/login' },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn   = !!auth?.user;
      const pathname     = request.nextUrl.pathname;
      const isAuthPage   = pathname.startsWith('/login');
      const isSettings   = pathname.startsWith('/dashboard/settings');

      // Always let the login page render — no auto-redirect for logged-in users
      if (isAuthPage) return true;

      // Not logged in on a protected page → send to login
      if (!isLoggedIn) return false;

      // OWNER cannot access Settings — redirect to dashboard
      const role = (auth?.user as any)?.role;
      if (isSettings && role === 'OWNER') {
        return Response.redirect(new URL('/dashboard', request.nextUrl));
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id       = user.id;
        token.role     = (user as any).role;
        token.branchId = (user as any).branchId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id       = token.id as string;
        (session.user as any).role     = token.role as string;
        (session.user as any).branchId = token.branchId as string;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
