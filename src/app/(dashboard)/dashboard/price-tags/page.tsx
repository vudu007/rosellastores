'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Printer, RefreshCcw, Tag, CheckSquare, Square } from 'lucide-react';

type PriceTagStatus = 'PENDING' | 'PRINTED';

interface PriceTagRow {
  id: string;
  oldPrice: number;
  newPrice: number;
  status: PriceTagStatus;
  printedAt: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
    barcodes: string[];
    retailPrice: number;
    unit: string;
  };
}

type LabelPreset = '50x30' | '58x40' | 'A4';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(value);

const labelDims = (preset: LabelPreset) => {
  if (preset === '58x40') return { w: 58, h: 40 };
  if (preset === 'A4') return { w: 70, h: 35 };
  return { w: 50, h: 30 };
};

export default function PriceTagsPage() {
  const { data: session } = useSession();
  const [tags, setTags] = useState<PriceTagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [printing, setPrinting] = useState(false);
  const [labelPreset, setLabelPreset] = useState<LabelPreset>('50x30');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const selectedIds = useMemo(() => Object.keys(selected).filter(id => selected[id]), [selected]);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/price-tags?status=PENDING&take=500');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setTags(Array.isArray(data.tags) ? data.tags : []);
      setSelected({});
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to load price tags' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const toggleAll = () => {
    const allSelected = selectedIds.length === tags.length && tags.length > 0;
    if (allSelected) {
      setSelected({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const t of tags) next[t.id] = true;
    setSelected(next);
  };

  const toggleOne = (id: string) => {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const buildPrintHtml = (rows: PriceTagRow[], preset: LabelPreset) => {
    const { w, h } = labelDims(preset);
    const pageSize = preset === 'A4' ? 'A4' : `${w}mm ${h}mm`;
    const margin = preset === 'A4' ? '8mm' : '2mm';
    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const labels = rows
      .map(r => {
        const barcode = r.product.barcodes?.[0] || '';
        const name = escapeHtml(r.product.name || '');
        const sku = escapeHtml(r.product.sku || '');
        const price = formatCurrency(r.product.retailPrice);
        const priceSafe = escapeHtml(price);
        const barcodeSafe = escapeHtml(barcode);

        return `
          <div class="label">
            <div class="name">${name}</div>
            <div class="meta">
              <div class="sku">${sku}</div>
              <div class="barcode">${barcodeSafe}</div>
            </div>
            <div class="price">${priceSafe}</div>
          </div>
        `;
      })
      .join('');

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Price Tags</title>
    <style>
      @page { size: ${pageSize}; margin: ${margin}; }
      html, body { height: 100%; }
      body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #0f172a; }
      .sheet { display: flex; flex-wrap: wrap; gap: 2mm; padding: 0; }
      .label {
        width: ${w}mm;
        height: ${h}mm;
        border: 0.25mm solid #e2e8f0;
        border-radius: 2mm;
        padding: 2.5mm;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .name { font-weight: 800; font-size: 9pt; line-height: 1.15; overflow: hidden; max-height: 22mm; }
      .meta { display: flex; justify-content: space-between; gap: 2mm; font-size: 7pt; color: #334155; }
      .sku { font-weight: 700; }
      .barcode { text-align: right; }
      .price { font-weight: 900; font-size: 12pt; color: #ff6a00; }
      @media print { .label { break-inside: avoid; } }
    </style>
  </head>
  <body>
    <div class="sheet">
      ${labels}
    </div>
  </body>
</html>`;
  };

  const printSelected = async () => {
    if (selectedIds.length === 0) {
      setToast({ type: 'error', message: 'Select at least one tag to print' });
      return;
    }

    const rows = tags.filter(t => selected[t.id]);
    const html = buildPrintHtml(rows, labelPreset);
    const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=900');
    if (!w) {
      setToast({ type: 'error', message: 'Popup blocked. Allow popups to print price tags.' });
      return;
    }

    setPrinting(true);
    try {
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve();
        };
        w.onafterprint = finish;
        w.onbeforeunload = finish;
        w.print();
        setTimeout(finish, 15000);
      });
      w.close();

      const res = await fetch('/api/price-tags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark printed');
      setToast({ type: 'success', message: `Printed ${selectedIds.length} tag(s)` });
      await refresh();
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to print' });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-entrance">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Price Tags</h1>
          <p className="text-muted-foreground mt-1">
            Automatically queues tags when prices change, ready to print.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard/inventory" className="btn-secondary h-10 px-4 flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Inventory
          </Link>

          <button onClick={refresh} disabled={loading} className="btn-secondary h-10 px-3 flex items-center gap-2">
            <RefreshCcw className="w-4 h-4" />
          </button>

          <button
            onClick={printSelected}
            disabled={printing || loading || selectedIds.length === 0}
            className="btn-primary h-10 px-4 flex items-center gap-2 shadow-lg hover:shadow-primary/25 transition-all"
          >
            <Printer className="w-4 h-4" />
            Print Selected
          </button>
        </div>
      </div>

      <div className="card-premium p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={toggleAll} className="btn-secondary h-10 px-4 flex items-center gap-2">
            {selectedIds.length === tags.length && tags.length > 0 ? (
              <CheckSquare className="w-4 h-4" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            Select All
          </button>
          <div className="text-sm text-muted-foreground">
            {tags.length} pending • {selectedIds.length} selected
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Label size</span>
          <select
            value={labelPreset}
            onChange={e => setLabelPreset(e.target.value as LabelPreset)}
            className="input-base h-10 px-3 bg-muted/30 border-none shadow-none focus:ring-1"
          >
            <option value="50x30">50mm × 30mm</option>
            <option value="58x40">58mm × 40mm</option>
            <option value="A4">A4 (grid)</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent mb-4"></div>
          <p className="text-muted-foreground font-medium">Loading pending price tags…</p>
        </div>
      ) : tags.length === 0 ? (
        <div className="card-premium p-10 text-center">
          <p className="text-foreground font-semibold">No pending price tags</p>
          <p className="text-muted-foreground mt-1">
            Update a product price in Inventory to automatically queue a tag.
          </p>
        </div>
      ) : (
        <div className="card-premium overflow-hidden border-none shadow-xl">
          <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 md:px-6 py-4 w-12"></th>
                  <th className="px-4 md:px-6 py-4">Product</th>
                  <th className="px-4 md:px-6 py-4">SKU</th>
                  <th className="px-4 md:px-6 py-4 text-right">Old</th>
                  <th className="px-4 md:px-6 py-4 text-right">New</th>
                  <th className="px-4 md:px-6 py-4">Queued</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tags.map(t => (
                  <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 md:px-6 py-4">
                      <button
                        onClick={() => toggleOne(t.id)}
                        className="w-9 h-9 rounded-lg hover:bg-muted flex items-center justify-center"
                      >
                        {selected[t.id] ? (
                          <CheckSquare className="w-5 h-5 text-primary" />
                        ) : (
                          <Square className="w-5 h-5 text-muted-foreground" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <div className="font-semibold text-foreground">{t.product?.name}</div>
                      <div className="text-xs text-muted-foreground">{t.product?.unit}</div>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-sm text-muted-foreground">{t.product?.sku}</td>
                    <td className="px-4 md:px-6 py-4 text-right text-sm text-muted-foreground">
                      {formatCurrency(t.oldPrice)}
                    </td>
                    <td className="px-4 md:px-6 py-4 text-right text-sm font-semibold text-foreground">
                      {formatCurrency(t.newPrice)}
                    </td>
                    <td className="px-4 md:px-6 py-4 text-sm text-muted-foreground">
                      {new Date(t.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={[
            'fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium',
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-destructive/10 text-destructive border-destructive/20',
          ].join(' ')}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
