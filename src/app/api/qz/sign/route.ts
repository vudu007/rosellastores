/**
 * GET /api/qz/sign?request=<timestamp>
 * Signs the QZ Tray timestamp with our RSA-PKCS#1 private key (SHA-512).
 * QZ Tray verifies this against the certificate → "Trusted website" mode.
 *
 * Env var: QZ_PRIVATE_KEY  (full PEM including headers, newlines preserved)
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

  let rawKey = process.env.QZ_PRIVATE_KEY ?? '';

  if (!rawKey) {
    return new NextResponse('QZ_PRIVATE_KEY env var is not set', { status: 500 });
  }

  // Normalise: Vercel may store newlines as literal \n depending on how the
  // value was entered. Handle both actual newlines and escaped ones.
  rawKey = rawKey
    .replace(/\\n/g, '\n')          // literal \n → real newline
    .replace(/\r\n/g, '\n')         // CRLF → LF
    .trim();

  // Ensure the key has proper PEM line breaks (some UIs strip them)
  if (!rawKey.includes('\n')) {
    // Key pasted as one long line — re-wrap at 64 chars between the headers
    const match = rawKey.match(/^(-----[^-]+-----)(.+)(-----[^-]+-----)$/s);
    if (match) {
      const body = match[2].replace(/\s/g, '');
      const lines = body.match(/.{1,64}/g)?.join('\n') ?? body;
      rawKey = `${match[1]}\n${lines}\n${match[3]}`;
    }
  }

  try {
    const sign = crypto.createSign('RSA-SHA512');
    sign.update(toSign);
    const signature = sign.sign(rawKey, 'base64');

    return new NextResponse(signature, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (err: any) {
    console.error('[QZ Sign] Error:', err.message);
    return new NextResponse('Signing failed: ' + err.message, { status: 500 });
  }
}
