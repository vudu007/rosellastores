import type { Metadata, Viewport } from 'next';
import { SessionProvider } from 'next-auth/react';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'MekaERP - Management System',
  description: 'Complete ERP management system with POS, inventory, and reporting',
  applicationName: 'MekaERP',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MekaERP',
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0b1220',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
        <SessionProvider>{children}</SessionProvider>
        <Script id="sw-register" strategy="afterInteractive">
          {`if ("serviceWorker" in navigator) { window.addEventListener("load", function () { navigator.serviceWorker.register("/sw.js").catch(function () {}); }); }`}
        </Script>
      </body>
    </html>
  );
}
