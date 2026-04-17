import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep pdfkit out of the Next.js bundle — it uses dynamic requires that
  // confuse the webpack bundler when running server-side.
  serverExternalPackages: ['pdfkit'],
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
};

export default nextConfig;
