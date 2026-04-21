/**
 * GET /api/qz/sign?request=<timestamp>
 * Signs the QZ Tray timestamp using the QZ Tray Demo private key (RSA-SHA512).
 * QZ Tray verifies the signature against the official QZ Industries demo cert,
 * which it recognises as trusted — enabling "Remember this decision".
 *
 * Env var: QZ_PRIVATE_KEY  (full PKCS#8 PEM, newlines preserved)
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

  // Normalise newlines — Vercel may store them as literal \n depending on input method
  rawKey = rawKey.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();

  // Re-wrap key body if all newlines were stripped (pasted as single line)
  if (!rawKey.includes('\n')) {
    const m = rawKey.match(/^(-----[^-]+-----)(.+)(-----[^-]+-----)$/s);
    if (m) {
      const lines = m[2].replace(/\s/g, '').match(/.{1,64}/g)?.join('\n') ?? m[2];
      rawKey = `${m[1]}\n${lines}\n${m[3]}`;
    }
  }

  try {
    // Use createPrivateKey() to correctly parse PKCS#8 format
    const privateKey = crypto.createPrivateKey(rawKey);
    const sign = crypto.createSign('RSA-SHA512');
    sign.update(toSign);
    const signature = sign.sign(privateKey, 'base64');

    return new NextResponse(signature, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (err: any) {
    console.error('[QZ Sign] Error:', err.message);
    return new NextResponse('Signing failed: ' + err.message, { status: 500 });
  }
}
