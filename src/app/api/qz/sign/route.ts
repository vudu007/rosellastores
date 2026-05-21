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
export const runtime = 'nodejs';

function normalisePrivateKey(rawKey: string): string {
  if (!rawKey) {
    return '';
  }

  // Normalise newlines — Vercel may store them as literal \n depending on input method
  rawKey = rawKey.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();

  const m = rawKey
    .replace(/\s+/g, ' ')
    .match(/(-----BEGIN (?:RSA )?PRIVATE KEY-----)\s*(.+?)\s*(-----END (?:RSA )?PRIVATE KEY-----)/);
  if (m) {
    const body = m[2].replace(/\s/g, '').match(/.{1,64}/g)?.join('\n') ?? m[2];
    rawKey = `${m[1]}\n${body}\n${m[3]}\n`;
  } else if (!rawKey.includes('\n')) {
    const m2 = rawKey.match(/^(-----[^-]+-----)(.+)(-----[^-]+-----)$/s);
    if (m2) {
      const lines = m2[2].replace(/\s/g, '').match(/.{1,64}/g)?.join('\n') ?? m2[2];
      rawKey = `${m2[1]}\n${lines}\n${m2[3]}\n`;
    }
  }

  return rawKey;
}

function normaliseCertificate(rawCert: string): string {
  if (!rawCert) return '';
  let cert = rawCert.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();

  if (!cert.includes('BEGIN CERTIFICATE')) return cert;

  if (!cert.includes('\n') || cert.split('\n').some(l => l.length > 80 && !l.startsWith('---'))) {
    const m = cert
      .replace(/\s+/g, ' ')
      .match(/-----BEGIN CERTIFICATE-----\s*(.+?)\s*-----END CERTIFICATE-----/);
    if (m) {
      const body = m[1].replace(/\s/g, '').match(/.{1,64}/g)?.join('\n') ?? m[1];
      cert = `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----\n`;
    }
  }

  return cert;
}

function keyMatchesCertificate(privateKeyPem: string, certificatePem: string): boolean {
  const priv = crypto.createPrivateKey(privateKeyPem);
  const pubFromPriv = crypto.createPublicKey(priv).export({ type: 'spki', format: 'der' }) as Buffer;
  const pubFromCert = new crypto.X509Certificate(certificatePem).publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
  return Buffer.compare(pubFromPriv, pubFromCert) === 0;
}

function signRequest(toSign: string, rawKey: string): string {
  const privateKey = crypto.createPrivateKey(rawKey);
  const sign = crypto.createSign('RSA-SHA512');
  sign.update(toSign);
  return sign.sign(privateKey, 'base64');
}

async function handleSign(toSign: string) {
  if (!toSign) return new NextResponse('Missing signing payload', { status: 400 });

  const rawKey = normalisePrivateKey(process.env.QZ_PRIVATE_KEY ?? '');
  if (!rawKey) return new NextResponse('QZ_PRIVATE_KEY env var is not set', { status: 500 });

  const rawCert = normaliseCertificate(process.env.QZ_CERTIFICATE ?? '');
  if (rawCert) {
    try {
      if (!keyMatchesCertificate(rawKey, rawCert)) {
        return new NextResponse('Signing failed: QZ_PRIVATE_KEY does not match QZ_CERTIFICATE', { status: 500 });
      }
    } catch (err: any) {
      const message = String(err?.message ?? err);
      return new NextResponse(`Signing failed: Unable to validate key/cert pair. ${message}`, { status: 500 });
    }
  }

  try {
    const signature = signRequest(toSign, rawKey);
    return new NextResponse(signature, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (err: any) {
    const message = String(err?.message ?? err);
    console.error('[QZ Sign] Error:', message);
    return new NextResponse(`Signing failed: ${message}`, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const toSign = searchParams.get('request') ?? '';
  return handleSign(toSign);
}

export async function POST(request: Request) {
  const toSign = await request.text();
  return handleSign(toSign);
}
