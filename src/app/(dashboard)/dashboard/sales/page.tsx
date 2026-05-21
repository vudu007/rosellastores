'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Ban, Download, ShoppingBag, ChevronLeft, ChevronRight, Printer, Check, X, RotateCcw } from 'lucide-react';

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

interface ReturnRequest {
  id: string;
  saleId: string;
  reason: string;
  status: string;
  requestedAt: string;
  requestedBy: { id: string; name: string; email: string; role: string } | null;
  ownerApprovedById: string | null;
  ownerApprovedAt: string | null;
  adminApprovedById: string | null;
  adminApprovedAt: string | null;
  executedAt: string | null;
  rejectedAt: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  COMPLETED: 'badge-success',
  VOIDED: 'badge-danger',
  HELD: 'badge-warning',
  RETURNED: 'badge-muted',
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
  const canApproveReturns = ['OWNER', 'ADMIN'].includes(session?.user.role ?? '');
  const canRequestReturn = !!session?.user?.role;

  const [sales, setSales] = useState<Sale[]>([]);
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [returningId, setReturningId] = useState<string | null>(null);
  const [approvingReturnId, setApprovingReturnId] = useState<string | null>(null);
  const [storeSettings, setStoreSettings] = useState<Record<string, string>>({});
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnSaleId, setReturnSaleId] = useState<string | null>(null);

  const returnBySaleId = useMemo(() => {
    const map = new Map<string, ReturnRequest>();
    for (const r of returnRequests) map.set(r.saleId, r);
    return map;
  }, [returnRequests]);

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

  const fetchReturns = async () => {
    try {
      const res = await fetch('/api/returns?take=200');
      if (!res.ok) return;
      const data = await res.json();
      setReturnRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch {
    }
  };

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : {})
      .then(setStoreSettings)
      .catch(() => {});
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchSales(page, status); fetchReturns(); }, [page, status]);

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

  const handleRequestReturn = async () => {
    if (!returnSaleId) return;
    if (!returnReason.trim() || returnReason.trim().length < 3) return;
    setReturningId(returnSaleId);
    try {
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleId: returnSaleId, reason: returnReason.trim() }),
      });
      if (res.ok) {
        setShowReturnModal(false);
        setReturnReason('');
        setReturnSaleId(null);
        await fetchReturns();
        await fetchSales(page, status);
      }
    } finally {
      setReturningId(null);
    }
  };

  const handleApproveReturn = async (returnRequestId: string, decision: 'APPROVE' | 'REJECT') => {
    setApprovingReturnId(returnRequestId);
    try {
      const res = await fetch(`/api/returns/${returnRequestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      if (res.ok) {
        await fetchReturns();
        await fetchSales(page, status);
      }
    } finally {
      setApprovingReturnId(null);
    }
  };

  // ── Print via main-window overlay (same approach as POS) ─────────────────
  // Uses window.print() on the main window so --kiosk-printing works correctly.
  // Guard lives on window so it survives React re-renders.
  const printDoc = (html: string) => {
    if ((window as any).__mekaPrinting) {
      console.log('[Rosella Stores] Print already in progress — ignoring duplicate.');
      return;
    }
    (window as any).__mekaPrinting = true;

    // Reset guard: afterprint fires when print dialog closes / kiosk job sent
    const releaseLock = () => {
      document.getElementById('__meka_receipt__')?.remove();
      document.getElementById('__meka_receipt_style__')?.remove();
      (window as any).__mekaPrinting = false;
    };
    window.addEventListener('afterprint', releaseLock, { once: true });
    // Safety fallback — release after 8 s if afterprint never fires
    setTimeout(() => releaseLock(), 8000);

    const cleanHtml = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    const parser = new DOMParser();
    const parsed = parser.parseFromString(cleanHtml, 'text/html');
    const rcptCSS = parsed.querySelector('style')?.innerHTML ?? '';
    const rcptBody = parsed.body.innerHTML;

    document.getElementById('__meka_receipt__')?.remove();
    document.getElementById('__meka_receipt_style__')?.remove();

    const overlay = document.createElement('div');
    overlay.id = '__meka_receipt__';
    overlay.innerHTML = rcptBody;
    overlay.style.cssText = 'position:fixed;top:-99999px;left:-99999px;width:74mm;';
    document.body.appendChild(overlay);

    const styleTag = document.createElement('style');
    styleTag.id = '__meka_receipt_style__';
    styleTag.innerHTML = `
      @media print {
        @page { size: 80mm auto; margin: 2mm 3mm; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body * { visibility: hidden !important; }
        #__meka_receipt__ {
          visibility: visible !important;
          position: fixed !important;
          top: 0 !important; left: 0 !important;
          width: 74mm !important;
          background: #fff !important;
        }
        #__meka_receipt__ * { visibility: visible !important; color: #000 !important; }
        ${rcptCSS}
      }
    `;
    document.head.appendChild(styleTag);

    setTimeout(() => window.print(), 250);
  };

  const handleReprint = async (sale: Sale) => {
    setPrintingId(sale.id);
    const biz = storeSettings.businessName || 'ROSELLA STORES';
    const receiptNo = `R-${sale.id.slice(-8).toUpperCase()}`;
    const dateStr = new Date(sale.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });

    const payLabel: Record<string, string> = {
      CASH: 'Cash', CARD: 'Card / POS', BANK_TRANSFER: 'Bank Transfer',
      MOBILE_MONEY: 'Mobile Money', SPLIT: 'Split Payment',
    };

    const taxRate = 0.075;
    let taxExclusive = 0;
    let taxInclusive = 0;

    const itemRows = (sale.items || []).map((item) => {
      const name    = item.product.name.slice(0, 24);
      const taxTag  = !item.product.isTaxable
        ? '<span style="font-size:8px;color:#555"> [EX]</span>'
        : item.product.taxInclusive
          ? '<span style="font-size:8px;color:#555"> [TI]</span>'
          : '';
      if (item.product.isTaxable) {
        if (item.product.taxInclusive) taxInclusive += item.total * taxRate / (1 + taxRate);
        else taxExclusive += item.total * taxRate;
      }
      return `
        <tr>
          <td style="padding:2px 0 1px;vertical-align:top">
            <div style="font-weight:700;font-size:11px">${name}${taxTag}</div>
            <div style="font-size:9.5px;color:#333;font-weight:600">${item.qty} × ${formatCurrency(item.unitPrice)}</div>
          </td>
          <td style="text-align:right;vertical-align:top;padding:2px 0 1px;font-size:11px;font-weight:700;white-space:nowrap">${formatCurrency(item.total)}</td>
        </tr>`;
    }).join('');

    const taxAddedHtml  = taxExclusive > 0
      ? `<tr><td style="font-size:10px;color:#333;padding:1px 0;font-weight:600">VAT 7.5% (excl.)</td><td style="text-align:right;font-size:10px;padding:1px 0;font-weight:600">${formatCurrency(taxExclusive)}</td></tr>` : '';
    const taxInclusHtml = taxInclusive > 0
      ? `<tr><td style="font-size:10px;color:#333;padding:1px 0;font-weight:600">VAT (incl. in price)</td><td style="text-align:right;font-size:10px;padding:1px 0;font-weight:600">${formatCurrency(taxInclusive)}</td></tr>` : '';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt ${receiptNo}</title>
  <style>
    @page { size: 80mm auto; margin: 2mm 3mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px; font-weight: 700;
      line-height: 1.4; width: 74mm; color: #000; background: #fff;
    }
    table { width: 100%; border-collapse: collapse; }
    .biz-name { font-size: 16px; font-weight: 900; letter-spacing: 2px; text-align: center; text-transform: uppercase; margin-bottom: 2px; }
    .biz-info { font-size: 9.5px; font-weight: 600; text-align: center; line-height: 1.6; color: #222; }
    .dash  { border: none; border-top: 1px dashed #000; margin: 3px 0; }
    .solid { border: none; border-top: 2px solid  #000; margin: 3px 0; }
    .badge { font-size: 10px; font-weight: 900; letter-spacing: 3px; text-align: center; padding: 2px 0; }
    .reprint { font-size: 9px; font-weight: 900; text-align: center; letter-spacing: 2px; border: 1px dashed #000; padding: 1px 0; margin: 2px 0; }
    .meta td { font-size: 10px; font-weight: 600; padding: 1px 0; }
    .meta td:last-child { text-align: right; font-weight: 700; }
    .col-hdr { font-size: 9px; font-weight: 900; letter-spacing: 1px; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 2px 0; }
    .col-hdr td:last-child { text-align: right; }
    .totals td { padding: 1px 0; font-size: 10.5px; font-weight: 700; }
    .totals td:last-child { text-align: right; }
    .grand td { font-size: 14px; font-weight: 900; padding: 2px 0; }
    .grand td:last-child { text-align: right; }
    .footer { text-align: center; font-size: 9.5px; font-weight: 600; color: #222; line-height: 1.7; margin-top: 3px; }
    .rcpt-id { text-align: center; font-size: 9px; font-weight: 600; letter-spacing: 1px; margin-top: 2px; color: #444; }
  </style>
</head>
<body>
<div class="biz-name">${biz}</div>
<div class="biz-info">
  ${storeSettings.businessAddress ? storeSettings.businessAddress + '<br>' : ''}
  ${storeSettings.businessPhone   ? 'Tel: ' + storeSettings.businessPhone : ''}
  ${storeSettings.businessEmail   ? '<br>' + storeSettings.businessEmail : ''}
</div>
<hr class="solid">
<div class="badge">&#9733; SALES RECEIPT &#9733;</div>
<div class="reprint">-- REPRINT --</div>
<hr class="dash">
<table class="meta">
  <tr><td>Receipt #</td><td>${receiptNo}</td></tr>
  <tr><td>Date</td><td>${dateStr}</td></tr>
  <tr><td>Customer</td><td>${sale.customer?.name || 'Walk-In'}</td></tr>
  <tr><td>Cashier</td><td>${sale.cashier?.name || '-'}</td></tr>
  <tr><td>Payment</td><td>${payLabel[sale.paymentMethod] || sale.paymentMethod}</td></tr>
</table>
<hr class="dash">
<table>
  <tr class="col-hdr">
    <td>ITEM DESCRIPTION</td>
    <td style="text-align:right">AMOUNT</td>
  </tr>
  ${itemRows || '<tr><td colspan="2" style="padding:4px 0;font-size:10px">(no item details)</td></tr>'}
</table>
<hr class="dash">
<table class="totals">
  <tr><td>Subtotal</td><td>${formatCurrency(sale.subtotal)}</td></tr>
  ${taxAddedHtml}${taxInclusHtml}
</table>
<hr class="solid">
<table class="grand">
  <tr><td>TOTAL PAID</td><td>${formatCurrency(sale.total)}</td></tr>
</table>
<hr class="dash">
<div class="footer">
  ${storeSettings.receiptFooter || 'Thank you for your purchase!'}
  <br>Please keep this receipt for your records.
</div>
<hr class="dash">
<div class="rcpt-id">${receiptNo} &bull; ${dateStr}</div>
</body>
</html>`;

    printDoc(html);
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
      {showReturnModal && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-card rounded-2xl p-6 max-w-lg w-full shadow-2xl mt-10 border border-white/10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black tracking-tight">Request Return</h2>
                <p className="text-sm text-muted-foreground">This must be approved by both Owner and Admin.</p>
              </div>
              <button
                onClick={() => { setShowReturnModal(false); setReturnSaleId(null); setReturnReason(''); }}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4">
              <label className="text-xs font-bold text-muted-foreground uppercase">Reason</label>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="input-base mt-2 min-h-[96px]"
                placeholder="Why is this transaction being returned?"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowReturnModal(false); setReturnSaleId(null); setReturnReason(''); }}
                className="flex-1 btn-secondary py-2 h-10"
                disabled={!!returningId}
              >
                Cancel
              </button>
              <button
                onClick={handleRequestReturn}
                className="flex-1 btn-primary py-2 h-10 disabled:opacity-50"
                disabled={!!returningId || returnReason.trim().length < 3}
              >
                {returningId ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

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
          {(['', 'COMPLETED', 'VOIDED', 'HELD', 'RETURNED'] as const).map((s) => (
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
                    <th className="text-center">Return</th>
                    <th className="text-center">Receipt</th>
                    {canVoid && <th className="text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {sales.length === 0 ? (
                    <tr>
                      <td colSpan={canVoid ? 9 : 8} className="py-16 text-center text-muted-foreground">
                        <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="font-medium">No sales found{status ? ` for "${status.toLowerCase()}" status` : ''}.</p>
                      </td>
                    </tr>
                  ) : sales.map((sale) => (
                    <tr key={sale.id} className={sale.status === 'VOIDED' || sale.status === 'RETURNED' ? 'opacity-60' : ''}>
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
                        {(() => {
                          const req = returnBySaleId.get(sale.id);
                          if (!req) {
                            if (!canRequestReturn || sale.status !== 'COMPLETED') return <span className="text-muted-foreground">—</span>;
                            return (
                              <button
                                onClick={() => { setReturnSaleId(sale.id); setReturnReason(''); setShowReturnModal(true); }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-500/15 hover:bg-amber-500/20 rounded-lg transition-colors"
                                title="Request a return (requires Owner + Admin approval)"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Return
                              </button>
                            );
                          }

                          if (req.status === 'COMPLETED' || sale.status === 'RETURNED') {
                            return <span className="badge-muted">Returned</span>;
                          }
                          if (req.status === 'REJECTED') {
                            return <span className="badge-danger">Rejected</span>;
                          }

                          const ownerOk = !!req.ownerApprovedById;
                          const adminOk = !!req.adminApprovedById;
                          const role = session?.user.role ?? '';

                          return (
                            <div className="flex items-center justify-center gap-2 flex-wrap">
                              <span className="text-[11px] font-bold text-muted-foreground">
                                Owner {ownerOk ? '✓' : '—'} • Admin {adminOk ? '✓' : '—'}
                              </span>
                              {canApproveReturns && (
                                <>
                                  {role === 'OWNER' && !ownerOk && (
                                    <button
                                      onClick={() => handleApproveReturn(req.id, 'APPROVE')}
                                      disabled={approvingReturnId === req.id}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-500/15 hover:bg-emerald-500/20 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                      <Check className="w-3 h-3" />
                                      Approve
                                    </button>
                                  )}
                                  {role === 'ADMIN' && !adminOk && (
                                    <button
                                      onClick={() => handleApproveReturn(req.id, 'APPROVE')}
                                      disabled={approvingReturnId === req.id}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-500/15 hover:bg-emerald-500/20 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                      <Check className="w-3 h-3" />
                                      Approve
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleApproveReturn(req.id, 'REJECT')}
                                    disabled={approvingReturnId === req.id}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    <X className="w-3 h-3" />
                                    Reject
                                  </button>
                                </>
                              )}
                            </div>
                          );
                        })()}
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
