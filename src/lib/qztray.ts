/**
 * QZ Tray utility — silent direct-to-thermal-printer printing
 *
 * qz-tray is a browser-only global library (it sets window.qz).
 * It must be loaded via a <script> CDN tag — NOT bundled by webpack.
 * This module injects the script tag on first use, then uses window.qz.
 *
 * Download QZ Tray desktop app at https://qz.io/download/
 */

const QZ_CDN = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js';

/** Load the qz-tray browser bundle from CDN (injects a <script> tag once) */
function loadQZFromCDN(): Promise<any> {
  return new Promise((resolve, reject) => {
    // Already loaded
    if (typeof window !== 'undefined' && (window as any).qz) {
      resolve((window as any).qz);
      return;
    }

    // Already injected but not yet loaded — wait for it
    const existing = document.getElementById('qz-tray-script');
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).qz));
      existing.addEventListener('error', () => reject(new Error('QZ Tray script failed to load')));
      return;
    }

    const script = document.createElement('script');
    script.id  = 'qz-tray-script';
    script.src = QZ_CDN;
    script.onload = () => {
      if ((window as any).qz) {
        resolve((window as any).qz);
      } else {
        reject(new Error('QZ Tray script loaded but window.qz is not available'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load QZ Tray from CDN. Check your internet connection.'));
    document.head.appendChild(script);
  });
}

let _connectingPromise: Promise<void> | null = null;

/**
 * Connect to the QZ Tray WebSocket server (wss://localhost:8181).
 * Safe to call multiple times — reuses the existing connection.
 */
export async function connectQZ(): Promise<void> {
  const qz = await loadQZFromCDN();

  // Already connected
  if (qz.websocket.isActive()) return;

  // If a connection attempt is in flight, wait for it
  if (_connectingPromise) return _connectingPromise;

  _connectingPromise = (async () => {
    // Unsigned mode — QZ Tray shows a one-time "Trust this site?" popup on first use
    qz.security.setCertificatePromise((resolve: (v: any) => void) => {
      resolve(undefined);
    });

    qz.security.setSignaturePromise((_toSign: string) => {
      return (resolve: (v: any) => void) => resolve(null);
    });

    await qz.websocket.connect();
  })().finally(() => {
    _connectingPromise = null;
  });

  return _connectingPromise;
}

/** Returns true if QZ Tray WebSocket is connected */
export async function isQZActive(): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false;
    const qz = await loadQZFromCDN();
    return qz.websocket.isActive();
  } catch {
    return false;
  }
}

/**
 * List all printers on this machine via QZ Tray.
 */
export async function getQZPrinters(thermalOnly = false): Promise<string[]> {
  await connectQZ();
  const qz = (window as any).qz;

  const printers: string[] = await qz.printers.find('');
  if (!thermalOnly) return printers;

  const keywords = ['thermal', 'pos', 'receipt', 'xprinter', 'epson', 'star', 'citizen', 'bixolon', '58mm', '80mm', 'tm-'];
  return printers.filter((p: string) =>
    keywords.some(k => p.toLowerCase().includes(k))
  );
}

/**
 * Print an HTML receipt string directly to a thermal printer via QZ Tray.
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

  await qz.print(config, [
    {
      type: 'pixel',
      format: 'html',
      flavor: 'plain',
      data: html,
      options: { pageWidth: 72, pageHeight: null },
    },
  ]);
}
