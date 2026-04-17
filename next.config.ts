import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep pdfkit out of the Next.js bundle — it uses dynamic requires that
  // confuse the webpack bundler when running server-side.
  // Keep Node.js-only packages out of the bundle — they break on Vercel edge/serverless
  serverExternalPackages: ['pdfkit', 'node-cron', '@prisma/client', 'prisma'],
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
