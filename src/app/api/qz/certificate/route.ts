/**
 * GET /api/qz/certificate
 * Returns the QZ Tray RSA public certificate so the browser can pass it
 * to qz.security.setCertificatePromise().
 *
 * Env var: QZ_CERTIFICATE  (the full PEM string, newlines as \n)
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cert = process.env.QZ_CERTIFICATE?.replace(/\\n/g, '\n');

  if (!cert) {
    return new NextResponse('QZ_CERTIFICATE env var is not set.', { status: 500 });
  }

  return new NextResponse(cert, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
