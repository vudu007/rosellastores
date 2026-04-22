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
  let cert = process.env.QZ_CERTIFICATE ?? '';

  if (!cert) {
    return new NextResponse('QZ_CERTIFICATE env var is not set.', { status: 500 });
  }

  // Normalise: Vercel may store newlines as literal \n or strip them entirely (spaces)
  cert = cert.replace(/\\n/g, '\n');

  // If the cert body has no real newlines (all on one line or space-separated),
  // re-wrap it into proper 64-char PEM lines so QZ Tray can parse it
  if (!cert.includes('\n') || cert.split('\n').some(l => l.length > 80 && !l.startsWith('---'))) {
    const m = cert.replace(/\s+/g, ' ').match(/-----BEGIN CERTIFICATE-----\s*(.+?)\s*-----END CERTIFICATE-----/);
    if (m) {
      const body = m[1].replace(/\s/g, '').match(/.{1,64}/g)?.join('\n') ?? m[1];
      cert = `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----\n`;
    }
  }

  return new NextResponse(cert, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
