import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-compatible auth config — NO Prisma, NO bcryptjs.
 * Used by middleware.ts which runs on Vercel's Edge Runtime.
 * The full auth.ts extends this with Credentials provider + database calls.
 */
export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage = request.nextUrl.pathname.startsWith('/login');

      // Always let users see the login page — even if a session exists.
      // The login form handles role-based routing after credentials are entered.
      // This ensures the site always shows the login screen on fresh open.
      if (isAuthPage) return true;

      // Not logged in on a protected page → send to login
      if (!isLoggedIn) return false;

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.branchId = (user as any).branchId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as string;
        (session.user as any).branchId = token.branchId as string;
      }
      return session;
    },
  },
  providers: [], // Providers added in auth.ts (Node.js only)
} satisfies NextAuthConfig;
