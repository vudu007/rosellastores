/**
 * GET /api/qz/sign?request=<timestamp>
 * Signs the QZ Tray timestamp with our RSA private key (SHA-512).
 * QZ Tray verifies the signature against the certificate — this proves
 * the site is trusted, enabling "Remember this decision" to work.
 *
 * Env var: QZ_PRIVATE_KEY  (the full PEM string, newlines as \n)
 */
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const toSign = searchParams.get('request');

  if (!toSign) {
    return new NextResponse('Missing ?request= parameter', { status: 400 });
  }

  const rawKey = process.env.QZ_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!rawKey) {
    return new NextResponse('QZ_PRIVATE_KEY env var is not set.', { status: 500 });
  }

  try {
    const sign = crypto.createSign('SHA512');
    sign.update(toSign);
    const signature = sign.sign(rawKey, 'base64');

    return new NextResponse(signature, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (err: any) {
    console.error('[QZ Sign] Error signing message:', err.message);
    return new NextResponse('Signing failed: ' + err.message, { status: 500 });
  }
}
