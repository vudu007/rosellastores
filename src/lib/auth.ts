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
  }

  interface Session {
    user: User;
  }

  // next-auth v5 beta: JWT augmentation lives here, not in 'next-auth/jwt'
  interface JWT {
    id: string;
    role: string;
    branchId: string | null;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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

        // Reject expired temporary accounts
        if ((user as any).tempExpiresAt && new Date() > new Date((user as any).tempExpiresAt)) {
          throw new Error('This temporary account has expired. Contact the administrator.');
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
  trustHost: true,
});
