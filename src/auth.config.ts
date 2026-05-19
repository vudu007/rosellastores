import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: { signIn: '/login' },
  // Required on Vercel: trust the host header so JWT verification works in Edge Runtime
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn   = !!auth?.user;
      const pathname     = request.nextUrl.pathname;
      const isAuthPage   = pathname.startsWith('/login');

      // Always let the login page render — no auto-redirect for logged-in users
      if (isAuthPage) return true;

      // Not logged in on a protected page → send to login
      if (!isLoggedIn) return false;

      // Superuser (ADMIN) has access to everything
      const role = (auth?.user as any)?.role;
      if (role === 'ADMIN') return true;

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
