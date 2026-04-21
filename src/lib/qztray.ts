/**
 * QZ Tray utility — silent direct-to-thermal-printer printing
 *
 * qz-tray is a browser-only global library (window.qz).
 * It must be loaded via CDN <script> tags — NOT bundled by webpack.
 * SHA-256 must be loaded before qz-tray.js.
 *
 * Download QZ Tray desktop app: https://qz.io/download/
 */

const SHA256_CDN = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/dependencies/sha-256.min.js';
const QZTRAY_CDN = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js';

/** Inject a <script> tag and wait for it to load */
function injectScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve(); // already injected
      return;
    }
    const s = document.createElement('script');
    s.id  = id;
    s.src = src;
    s.onload  = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(s);
  });
}

/** Load SHA-256 then qz-tray from CDN (runs only in browser) */
async function loadQZ(): Promise<any> {
  if (typeof window === 'undefined') throw new Error('QZ Tray is only available in the browser.');
  if ((window as any).qz) return (window as any).qz;

  // SHA-256 must be present before qz-tray initialises
  await injectScript(SHA256_CDN, 'qz-sha256');
  await injectScript(QZTRAY_CDN, 'qz-tray-script');

  if (!(window as any).qz) throw new Error('QZ Tray loaded but window.qz is not available.');
  return (window as any).qz;
}

let _connectingPromise: Promise<void> | null = null;

/**
 * Connect to the QZ Tray WebSocket (wss://localhost:8181).
 * Safe to call multiple times — reuses existing connection.
 */
export async function connectQZ(): Promise<void> {
  const qz = await loadQZ();

  if (qz.websocket.isActive()) return;
  if (_connectingPromise) return _connectingPromise;

  _connectingPromise = (async () => {
    // Unsigned mode: QZ Tray shows one-time "Trust this site?" popup on first use.
    qz.security.setCertificatePromise((resolve: Function) => resolve(null));
    qz.security.setSignaturePromise((_toSign: string) => (resolve: Function) => resolve(null));
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
    const qz = (window as any).qz;
    return !!qz?.websocket?.isActive();
  } catch {
    return false;
  }
}

/**
 * List printers available on this machine via QZ Tray.
 * Pass thermalOnly=true to filter to likely thermal printers.
 */
export async function getQZPrinters(thermalOnly = false): Promise<string[]> {
  await connectQZ();
  const qz = (window as any).qz;

  // find() with no argument = all printers; find(string) = matched subset
  const result = await qz.printers.find();

  // Normalise: result may be a string (single printer) or an array
  const printers: string[] = Array.isArray(result)
    ? result
    : result
      ? [result as string]
      : [];

  if (!thermalOnly) return printers;

  const keywords = ['thermal', 'pos', 'receipt', 'xprinter', 'epson', 'star', 'citizen', 'bixolon', '58mm', '80mm', 'tm-'];
  return printers.filter(p => keywords.some(k => p.toLowerCase().includes(k)));
}

/**
 * Print an HTML receipt directly to a thermal printer via QZ Tray.
 * @param html        Full HTML document string
 * @param printerName Exact printer name from getQZPrinters()
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
