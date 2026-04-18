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

      // Logged-in user on login page → redirect to their role-specific page
      // (Never redirect to '/' — that would loop back here)
      if (isLoggedIn && isAuthPage) {
        const role = (auth?.user as any)?.role;
        if (role === 'CASHIER') return Response.redirect(new URL('/pos', request.nextUrl));
        if (role === 'WHOLESALE_CUSTOMER') return Response.redirect(new URL('/wholesale', request.nextUrl));
        return Response.redirect(new URL('/dashboard', request.nextUrl));
      }

      // Not logged in, not on auth page → redirect to login
      if (!isLoggedIn && !isAuthPage) {
        return false;
      }

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
