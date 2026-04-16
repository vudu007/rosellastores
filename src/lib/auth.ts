import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';

declare module 'next-auth' {
  interface User {
    id: string;
    email: string;
    name: string;
    role: 'OWNER' | 'MANAGER' | 'CASHIER' | 'WHOLESALE_CUSTOMER';
    branchId: string | null;
  }

  interface Session {
    user: User;
  }

  interface JWT {
    id: string;
    role: string;
    branchId: string | null;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      async authorize(credentials) {
        if (!credentials.email || !credentials.password) {
          throw new Error('Invalid credentials');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) {
          throw new Error('User not found');
        }

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!passwordMatch) {
          throw new Error('Invalid password');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          branchId: user.branchId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.branchId = user.branchId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as any;
        session.user.branchId = token.branchId as string;
      }
      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage = request.nextUrl.pathname.startsWith('/login');

      if (isAuthPage) {
        return !isLoggedIn;
      }

      return isLoggedIn;
    },
  },
  pages: {
    signIn: '/login',
  },
  trustHost: true,
});
