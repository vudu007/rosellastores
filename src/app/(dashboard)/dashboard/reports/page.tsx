'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Mail, FileText, Send, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ReportsPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });

  const sendEOD = async () => {
    setLoading(true);
    setStatus({ type: null, message: '' });
    try {
      const res = await fetch('/api/reports/eod/send', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setStatus({ type: 'success', message: data.message });
      } else {
        setStatus({ type: 'error', message: data.error || 'Failed to send report' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const downloadTaxPDF = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/reports/tax');
      const data = await res.json();
      
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      
      const doc = new jsPDF('landscape');
      doc.setFontSize(18);
      doc.text(`Monthly Tax Summary - ${data.period}`, 14, 22);
      
      const tableColumn = ["Date", "Sale ID", "Customer", "Type", "Payment M.", "Gross Total", "Discount", "Tax Collected", "Net Total"];
      const tableRows = data.sales.map((s: any) => [
        s.date, s.id.substring(0,8)+'...', s.customer, s.type, s.paymentMethod, s.subtotal.toFixed(2), s.discount.toFixed(2), s.tax.toFixed(2), s.total.toFixed(2)
      ]);
      
      tableRows.push(["TOTAL", "", "", "", "", data.summary.totalGross.toFixed(2), "", data.summary.totalTax.toFixed(2), data.summary.totalNet.toFixed(2)]);
      
      autoTable(doc, { head: [tableColumn], body: tableRows, startY: 30 });
      doc.save(`tax-summary-${data.period}.pdf`);
      setStatus({ type: 'success', message: 'Tax PDF downloaded successfully' });
    } catch (e) {
      setStatus({ type: 'error', message: 'Failed to generate Tax PDF' });
    } finally {
      setLoading(false);
    }
  };

  const downloadInventoryPDF = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/reports/inventory');
      const data = await res.json();
      
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      
      const doc = new jsPDF('landscape');
      doc.setFontSize(18);
      doc.text(`Inventory Audit - ${data.date}`, 14, 22);
      
      const tableColumn = ["SKU", "Product Name", "Category", "Supplier", "Retail", "Wholesale", "System Stock", "Phys. Count", "Diff."];
      const tableRows = data.inventory.map((p: any) => [
        p.sku, p.name, p.category, p.supplier, p.retailPrice, p.wholesalePrice, p.systemStock, "", ""
      ]);
      
      autoTable(doc, { head: [tableColumn], body: tableRows, startY: 30 });
      doc.save(`inventory-audit-${data.date}.pdf`);
      setStatus({ type: 'success', message: 'Inventory PDF downloaded successfully' });
    } catch (e) {
      setStatus({ type: 'error', message: 'Failed to generate Inventory PDF' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-8 animate-entrance">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-2">Manage your end-of-day reports and business performance summaries.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="card-premium p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <Mail className="w-6 h-6 text-blue-600" />
            </div>
            <span className="bg-green-100 text-green-700 text-xs px-2.5 py-0.5 rounded-full font-bold">Scheduled: 9:00 PM</span>
          </div>
          <div className="mt-4">
            <h3 className="text-lg font-bold text-foreground">End of Day Report</h3>
            <p className="text-sm text-muted-foreground mt-1">Sends a detailed PDF summary of today's sales, expenses, and top products to your email.</p>
          </div>
          <button
            onClick={sendEOD}
            disabled={loading}
            className="btn-primary w-full mt-6 gap-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Sending...
              </span>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Manual Report Now
              </>
            )}
          </button>
        </div>

        <div className="card-premium p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-lg font-bold text-foreground">Monthly Tax Summary</h3>
            <p className="text-sm text-muted-foreground mt-1">Generate a comprehensive tax-ready report for the current month.</p>
          </div>
          <button onClick={downloadTaxPDF} disabled={loading} className="btn-secondary w-full mt-6 text-center inline-block">
            Download PDF
          </button>
        </div>

        <div className="card-premium p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
              <AlertCircle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-lg font-bold text-foreground">Inventory Audit</h3>
            <p className="text-sm text-muted-foreground mt-1">Export a full inventory snapshot for physical count reconciliation.</p>
          </div>
          <button onClick={downloadInventoryPDF} disabled={loading} className="btn-secondary w-full mt-6 text-center inline-block">
            Export PDF
          </button>
        </div>
      </div>

      {status.type && (
        <div className={`p-4 rounded-lg flex items-center gap-3 animate-slide-up ${
          status.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-medium">{status.message}</span>
        </div>
      )}

      <div className="card-premium overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="font-bold text-foreground text-lg">Recent Report Logs</h3>
        </div>
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Recipient</th>
                <th className="px-6 py-4">Sent At</th>
                <th className="px-6 py-4">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y border-white/5">
              <tr>
                <td className="px-6 py-4">
                  <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Delivered</span>
                </td>
                <td className="px-6 py-4 font-medium text-foreground">{session?.user?.email}</td>
                <td className="px-6 py-4 text-muted-foreground">Yesterday, 9:00 PM</td>
                <td className="px-6 py-4 text-muted-foreground italic">Scheduled Cron</td>
              </tr>
              <tr>
                <td className="px-6 py-4">
                  <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Delivered</span>
                </td>
                <td className="px-6 py-4 font-medium text-foreground">{session?.user?.email}</td>
                <td className="px-6 py-4 text-muted-foreground">2 days ago, 9:00 PM</td>
                <td className="px-6 py-4 text-muted-foreground italic">Scheduled Cron</td>
              </tr>
            </tbody>
          </table>
          <div className="p-4 bg-muted/20 text-center">
            <p className="text-xs text-muted-foreground">Historical logs are stored for 30 days.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
