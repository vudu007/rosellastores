/**
 * QZ Tray utility — silent direct-to-thermal-printer printing
 *
 * QZ Tray is a free desktop middleware that bridges web apps to local printers
 * without browser print dialogs. Download it at https://qz.io/download/
 *
 * This module uses UNSIGNED mode — QZ Tray will show a one-time "Allow?" dialog
 * the first time it's used. After clicking Allow (and optionally "Always"), it
 * prints silently forever.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

type QZType = any;

let _qz: QZType | null = null;
let _connectingPromise: Promise<void> | null = null;

/** Lazy-load the qz-tray browser bundle (safe to call from any client component) */
async function loadQZ(): Promise<QZType> {
  if (_qz) return _qz;
  const mod = await import('qz-tray');
  _qz = (mod as any).default ?? mod;
  return _qz;
}

/**
 * Connect to the QZ Tray WebSocket server (wss://localhost:8181).
 * Safe to call multiple times — subsequent calls reuse the existing connection.
 */
export async function connectQZ(): Promise<void> {
  const qz = await loadQZ();

  // Already connected — nothing to do
  if (qz.websocket.isActive()) return;

  // If a connection attempt is already in flight, wait for it
  if (_connectingPromise) return _connectingPromise;

  _connectingPromise = (async () => {
    // ── Unsigned mode ────────────────────────────────────────────────────────
    // Pass empty/null for both certificate and signature.
    // QZ Tray will show a one-time "Trust this site?" popup on the first use.
    qz.security.setCertificatePromise((resolve: (v: any) => void) => {
      resolve(undefined);
    });

    qz.security.setSignaturePromise((toSign: string) => {
      return (resolve: (v: any) => void) => resolve(null);
    });
    // ────────────────────────────────────────────────────────────────────────

    await qz.websocket.connect();
  })().finally(() => {
    _connectingPromise = null;
  });

  return _connectingPromise;
}

/** Returns true if QZ Tray is running and the WebSocket is connected */
export async function isQZActive(): Promise<boolean> {
  try {
    const qz = await loadQZ();
    return qz.websocket.isActive();
  } catch {
    return false;
  }
}

/**
 * List all printers available on this machine via QZ Tray.
 * Filters to likely thermal printers when `thermalOnly` is true (default: false).
 */
export async function getQZPrinters(thermalOnly = false): Promise<string[]> {
  await connectQZ();
  const qz = await loadQZ();

  const printers: string[] = await qz.printers.find('');
  if (!thermalOnly) return printers;

  // Heuristic filter — thermal printers often contain these keywords
  const keywords = ['thermal', 'pos', 'receipt', 'xprinter', 'epson', 'star', 'citizen', 'bixolon', '58mm', '80mm', 'tm-'];
  return printers.filter(p =>
    keywords.some(k => p.toLowerCase().includes(k))
  );
}

/**
 * Print an HTML receipt string directly to a thermal printer via QZ Tray.
 * The HTML should already be formatted for 72mm / 80mm thermal paper.
 *
 * @param html        Full HTML document string (including <html>, <head>, <body>)
 * @param printerName Exact printer name as returned by getQZPrinters()
 */
export async function printHTMLWithQZ(html: string, printerName: string): Promise<void> {
  await connectQZ();
  const qz = await loadQZ();

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
