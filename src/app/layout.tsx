import type { Metadata, Viewport } from 'next';
import { SessionProvider } from 'next-auth/react';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'Rosella Stores - Kiddies Hub ERP System',
  description: 'Kiddies Hub ERP System with POS, inventory, and reporting',
  applicationName: 'Rosella Stores',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Rosella Stores',
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#e11d48',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <SessionProvider>{children}</SessionProvider>
        <Script id="sw-register" strategy="afterInteractive">
          {`if ("serviceWorker" in navigator) { window.addEventListener("load", function () { navigator.serviceWorker.register("/sw.js").catch(function () {}); }); }`}
        </Script>
      </body>
    </html>
  );
}
