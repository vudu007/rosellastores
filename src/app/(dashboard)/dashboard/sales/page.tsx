'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Ban, Download, ShoppingBag, ChevronLeft, ChevronRight, Printer } from 'lucide-react';

interface SaleItem {
  id: string;
  qty: number;
  unitPrice: number;
  discount: number;
  total: number;
  product: { name: string; isTaxable: boolean; taxInclusive: boolean };
}

interface Sale {
  id: string;
  customer: { name: string } | null;
  cashier: { name: string };
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: string;
  status: string;
  notes: string | null;
  createdAt: string;
  items: SaleItem[];
}

const STATUS_BADGE: Record<string, string> = {
  COMPLETED: 'badge-success',
  VOIDED: 'badge-danger',
  HELD: 'badge-warning',
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  BANK_TRANSFER: 'Transfer',
  MOBILE_MONEY: 'Mobile',
  CREDIT: 'Credit',
};

export default function SalesPage() {
  const { data: session } = useSession();
  const canVoid = ['OWNER', 'MANAGER'].includes(session?.user.role ?? '');

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [storeSettings, setStoreSettings] = useState<Record<string, string>>({});

  const fetchSales = async (currentPage = page, currentStatus = status) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', '20');
      if (currentStatus) params.append('status', currentStatus);

      const response = await fetch(`/api/sales?${params}`);
      const data = await response.json();
      setSales(data.sales);
      setTotal(data.pagination.total);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : {})
      .then(setStoreSettings)
      .catch(() => {});
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchSales(page, status); }, [page, status]);

  const exportCSV = () => {
    const headers = ['Date', 'Customer', 'Cashier', 'Amount (₦)', 'Payment', 'Status'];
    const rows = sales.map((s) => [
      formatDate(s.createdAt),
      s.customer?.name ?? 'Walk-In Customer',
      s.cashier?.name ?? '-',
      s.total.toFixed(2),
      s.paymentMethod.replace(/_/g, ' '),
      s.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-page${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleVoid = async (id: string, saleTotal: number) => {
    if (!confirm(`Void this sale of ${formatCurrency(saleTotal)}? Stock will be restored.`)) return;
    setVoidingId(id);
    try {
      const res = await fetch(`/api/sales/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'VOIDED' }),
      });
      if (res.ok) fetchSales(page, status);
    } catch (error) {
      console.error('Error voiding sale:', error);
    } finally {
      setVoidingId(null);
    }
  };

  // Print via hidden iframe — no popup blockers
  const printHTML = (html: string) => {
    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, {
      position: 'fixed', top: '-10000px', left: '-10000px',
      width: '320px', height: '600px', border: 'none', visibility: 'hidden',
    });
    document.body.appendChild(iframe);
    const iDoc = iframe.contentDocument!;
    iDoc.open();
    iDoc.write(html);
    iDoc.close();
    setTimeout(() => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
    }, 10000);
  };

  const handleReprint = (sale: Sale) => {
    setPrintingId(sale.id);
    const W = 42;
    const biz = storeSettings.businessName || 'MEKAERP';
    const receiptNo = `R-${sale.id.slice(-8).toUpperCase()}`;
    const dateStr = new Date(sale.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });

    const row = (left: string, right: string) => {
      const gap = W - left.length - right.length;
      return left + (gap > 0 ? ' '.repeat(gap) : ' ') + right;
    };
    const center = (s: string) => {
      const pad = Math.max(0, Math.floor((W - s.length) / 2));
      return ' '.repeat(pad) + s;
    };
    const dash = '-'.repeat(W);
    const dDash = '='.repeat(W);

    const payLabel: Record<string, string> = {
      CASH: 'Cash', CARD: 'Card / POS', BANK_TRANSFER: 'Bank Transfer',
      MOBILE_MONEY: 'Mobile Money', SPLIT: 'Split Payment',
    };

    const taxRate = 0.075;
    let taxExclusive = 0;
    let taxInclusive = 0;

    const itemLines = (sale.items || []).map((item) => {
      const desc = item.product.name.slice(0, 28);
      const qtyPrice = `${item.qty} x ${formatCurrency(item.unitPrice)}`;
      const total = formatCurrency(item.total);
      const taxTag = !item.product.isTaxable ? ' [Exempt]' : item.product.taxInclusive ? ' [Incl.]' : '';
      if (item.product.isTaxable) {
        if (item.product.taxInclusive) taxInclusive += item.total * taxRate / (1 + taxRate);
        else taxExclusive += item.total * taxRate;
      }
      return [`  ${desc}${taxTag}`, row(`  ${qtyPrice}`, total)].join('\n');
    }).join('\n');

    const taxAddedLine = taxExclusive > 0 ? `\n${row('  VAT 7.5% (+tax):', formatCurrency(taxExclusive))}` : '';
    const taxInclusLine = taxInclusive > 0 ? `\n${row('  VAT incl. (in price):', formatCurrency(taxInclusive))}` : '';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt ${receiptNo}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Courier New', Courier, monospace; font-size: 12px; line-height: 1.45; width: 72mm; color: #000; background: #fff; padding: 4mm 0; }
    pre { white-space: pre-wrap; word-break: break-word; font-family: inherit; font-size: inherit; }
    .biz-name { font-size: 18px; font-weight: 900; letter-spacing: 1px; text-align: center; margin-bottom: 2px; }
    .biz-sub  { font-size: 11px; text-align: center; color: #333; }
    .total-line { font-size: 15px; font-weight: 900; }
    .footer { text-align: center; font-size: 11px; margin-top: 8px; color: #333; }
    .reprint-badge { text-align: center; font-size: 10px; font-weight: bold; color: #666; border: 1px dashed #999; padding: 2px 0; margin: 4px 0; }
    @media print { html, body { margin: 0; padding: 0; } body { width: 72mm; } }
  </style>
</head>
<body>
<div class="biz-name">${biz}</div>
${storeSettings.businessAddress ? `<div class="biz-sub">${storeSettings.businessAddress}</div>` : ''}
${storeSettings.businessPhone ? `<div class="biz-sub">Tel: ${storeSettings.businessPhone}</div>` : ''}
${storeSettings.businessEmail ? `<div class="biz-sub">${storeSettings.businessEmail}</div>` : ''}
<div class="reprint-badge">*** REPRINT ***</div>
<pre>
${dash}
${center('*** SALES RECEIPT ***')}
${dash}
${row('Receipt No:', receiptNo)}
${row('Date:', dateStr)}
${row('Customer:', sale.customer?.name || 'Walk-In Customer')}
${row('Cashier:', sale.cashier?.name || '-')}
${row('Payment:', payLabel[sale.paymentMethod] || sale.paymentMethod)}
${dash}
ITEMS
${dash}
${itemLines || '  (no item details available)'}
${dash}
${row('Subtotal:', formatCurrency(sale.subtotal))}${taxAddedLine}${taxInclusLine}
${dDash}
</pre>
<pre class="total-line">${row('  TOTAL PAID:', formatCurrency(sale.total))}</pre>
<pre>
${dDash}
</pre>
<div class="footer">
  ${storeSettings.receiptFooter || 'Thank you for your purchase!'}
  <br>Please keep this receipt for reference.
</div>
<script>
  window.onload = function() {
    setTimeout(function() { window.print(); }, 300);
  };
</script>
</body>
</html>`;

    printHTML(html);
    setTimeout(() => setPrintingId(null), 1000);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(value);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6 md:p-8 space-y-6 animate-entrance">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales History</h1>
          <p className="page-subtitle">Browse and manage all recorded transactions</p>
        </div>
        {sales.length > 0 && (
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {(['', 'COMPLETED', 'VOIDED', 'HELD'] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                status === s
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {s === '' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <p className="text-sm text-muted-foreground whitespace-nowrap shrink-0">
          {total} transaction{total !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent mb-4" />
          <p className="text-muted-foreground font-medium">Loading sales…</p>
        </div>
      ) : (
        <>
          <div className="card-premium overflow-hidden border-none shadow-xl">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Customer</th>
                    <th>Cashier</th>
                    <th className="text-right">Amount</th>
                    <th>Payment</th>
                    <th className="text-center">Status</th>
                    <th className="text-center">Receipt</th>
                    {canVoid && <th className="text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {sales.length === 0 ? (
                    <tr>
                      <td colSpan={canVoid ? 8 : 7} className="py-16 text-center text-muted-foreground">
                        <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="font-medium">No sales found{status ? ` for "${status.toLowerCase()}" status` : ''}.</p>
                      </td>
                    </tr>
                  ) : sales.map((sale) => (
                    <tr key={sale.id} className={sale.status === 'VOIDED' ? 'opacity-60' : ''}>
                      <td>
                        <p className="font-medium text-foreground">{formatDate(sale.createdAt)}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">#{sale.id.slice(-8).toUpperCase()}</p>
                      </td>
                      <td className="text-foreground">{sale.customer?.name ?? <span className="text-muted-foreground">Walk-In</span>}</td>
                      <td className="text-muted-foreground">{sale.cashier?.name ?? '—'}</td>
                      <td className="text-right font-semibold text-foreground">{formatCurrency(sale.total)}</td>
                      <td>
                        <span className="badge-muted capitalize">
                          {PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className={STATUS_BADGE[sale.status] ?? 'badge-muted'}>
                          {sale.status.charAt(0) + sale.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="text-center">
                        <button
                          onClick={() => handleReprint(sale)}
                          disabled={printingId === sale.id || sale.status === 'VOIDED'}
                          title="Reprint receipt on 80mm thermal printer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors disabled:opacity-40"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          {printingId === sale.id ? 'Printing…' : 'Reprint'}
                        </button>
                      </td>
                      {canVoid && (
                        <td className="text-center">
                          {sale.status === 'COMPLETED' ? (
                            <button
                              onClick={() => handleVoid(sale.id, sale.total)}
                              disabled={voidingId === sale.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-lg transition-colors disabled:opacity-40"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              {voidingId === sale.id ? 'Voiding…' : 'Void'}
                            </button>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page <span className="font-semibold text-foreground">{page}</span> of{' '}
                <span className="font-semibold text-foreground">{totalPages}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="btn-secondary h-9 w-9 p-0 flex items-center justify-center disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                  className="btn-secondary h-9 w-9 p-0 flex items-center justify-center disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
