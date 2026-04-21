/**
 * QZ Tray utility — silent direct-to-thermal-printer printing
 *
 * qz-tray is a browser-only global library (window.qz).
 * Loaded via CDN <script> tags at runtime — NOT bundled by webpack.
 * SHA-256 must load before qz-tray.js.
 *
 * Signing flow:
 *   - /api/qz/certificate  → returns the RSA public cert
 *   - /api/qz/sign         → signs QZ Tray's timestamp with RSA-SHA512
 *   This makes QZ Tray show "Trusted website" so "Remember this decision" works.
 *
 * Download QZ Tray desktop app: https://qz.io/download/
 */

const SHA256_CDN = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/dependencies/sha-256.min.js';
const QZTRAY_CDN = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js';

/** Inject a <script> tag and wait for it to load */
function injectScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) { resolve(); return; }
    const s = document.createElement('script');
    s.id  = id;
    s.src = src;
    s.onload  = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.head.appendChild(s);
  });
}

/** Load SHA-256 then qz-tray from CDN (browser only) */
async function loadQZ(): Promise<any> {
  if (typeof window === 'undefined') throw new Error('QZ Tray is browser-only.');
  if ((window as any).qz) return (window as any).qz;
  await injectScript(SHA256_CDN, 'qz-sha256');
  await injectScript(QZTRAY_CDN, 'qz-tray-script');
  if (!(window as any).qz) throw new Error('QZ Tray loaded but window.qz is unavailable.');
  return (window as any).qz;
}

let _connectingPromise: Promise<void> | null = null;

/**
 * Connect to QZ Tray WebSocket (wss://localhost:8181).
 * Uses RSA certificate + server-side signing so QZ Tray shows
 * "Trusted website" and the "Remember this decision" checkbox works.
 */
export async function connectQZ(): Promise<void> {
  const qz = await loadQZ();

  if (qz.websocket.isActive()) return;
  if (_connectingPromise) return _connectingPromise;

  _connectingPromise = (async () => {
    // ── Signed certificate mode ───────────────────────────────────────────────
    // Fetches the public cert from our API; QZ Tray uses it to verify signatures.
    qz.security.setCertificatePromise((resolve: Function, reject: Function) => {
      fetch('/api/qz/certificate', { cache: 'no-store' })
        .then(r => r.ok ? r.text() : Promise.reject('Certificate endpoint error ' + r.status))
        .then(text => resolve(text))
        .catch(err => reject(err));
    });

    // Server signs the QZ Tray timestamp with our RSA private key.
    qz.security.setSignaturePromise((toSign: string) => {
      return (resolve: Function, reject: Function) => {
        fetch(`/api/qz/sign?request=${encodeURIComponent(toSign)}`, { cache: 'no-store' })
          .then(r => r.ok ? r.text() : Promise.reject('Sign endpoint error ' + r.status))
          .then(sig => resolve(sig))
          .catch(err => reject(err));
      };
    });
    // ─────────────────────────────────────────────────────────────────────────

    await qz.websocket.connect({ retries: 1, delay: 1 });
  })().finally(() => {
    _connectingPromise = null;
  });

  return _connectingPromise;
}

/** Returns true if QZ Tray WebSocket is active */
export async function isQZActive(): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false;
    return !!(window as any).qz?.websocket?.isActive();
  } catch { return false; }
}

/**
 * List all printers on this machine via QZ Tray.
 */
export async function getQZPrinters(thermalOnly = false): Promise<string[]> {
  await connectQZ();
  const qz = (window as any).qz;

  const result = await qz.printers.find();

  // Normalise: result can be a string (1 printer) or array or null
  const printers: string[] = Array.isArray(result)
    ? result
    : result ? [String(result)] : [];

  if (!thermalOnly) return printers;

  const keywords = ['thermal', 'pos', 'receipt', 'xprinter', 'epson', 'star', 'citizen', 'bixolon', '58mm', '80mm', 'tm-'];
  return printers.filter(p => keywords.some(k => p.toLowerCase().includes(k)));
}

/**
 * Print an HTML receipt directly to a thermal printer via QZ Tray.
 */
export async function printHTMLWithQZ(html: string, printerName: string): Promise<void> {
  await connectQZ();
  const qz = (window as any).qz;

  const config = qz.configs.create(printerName, {
    size: { width: 80, height: null },
    units: 'mm',
    scaleContent: false,
    rasterize: false,
    copies: 1,
  });

  await qz.print(config, [{
    type: 'pixel',
    format: 'html',
    flavor: 'plain',
    data: html,
    options: { pageWidth: 72, pageHeight: null },
  }]);
}
