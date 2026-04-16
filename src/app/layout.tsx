import type { Metadata } from 'next';
import { SessionProvider } from 'next-auth/react';
import './globals.css';

export const metadata: Metadata = {
  title: 'RetailPro - Management System',
  description: 'Complete retail management system with POS, inventory, and reporting',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
