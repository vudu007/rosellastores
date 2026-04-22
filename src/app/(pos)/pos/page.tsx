'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  Search, ShoppingCart, User, CreditCard, Banknote,
  Smartphone, Trash2, Plus, Minus, CheckCircle,
  ChevronRight, Package, AlertCircle, ArrowLeft, Printer
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
// QZ Tray removed — printing handled via browser iframe + Chrome --kiosk-printing

interface Product {
  id: string;
  name: string;
  sku: string;
  barcodes: string[];
  retailPrice: number;
  wholesalePrice: number;
  stockQty: number;
  category: { name: string };
  imageUrl?: string;
  isTaxable: boolean;
  taxInclusive: boolean;
}

interface Customer {
  id: string;
  name: string;
  type: 'RETAIL' | 'WHOLESALE';
}

interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  isTaxable: boolean;
  taxInclusive: boolean;
}

export default function POSPage() {
  const { data: session } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [pricingMode, setPricingMode] = useState<'RETAIL' | 'WHOLESALE'>('RETAIL');
  const [splitAmounts, setSplitAmounts] = useState({ cash: 0, card: 0, transfer: 0, mobile: 0 });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', email: '', type: 'RETAIL' as 'RETAIL' | 'WHOLESALE' });
  const [lastSale, setLastSale] = useState<any>(null);
  const [lastCompletedSale, setLastCompletedSale] = useState<any>(null);
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const [lastScanTime, setLastScanTime] = useState(0);
  const [storeSettings, setStoreSettings] = useState<any>({});
  const [showMobileCart, setShowMobileCart] = useState(false);

  // QZ Tray thermal printer — saved name comes from Settings page via localStorage
  const [thermalPrinter, setThermalPrinter] = useState<string>('');

  // Restore saved thermal printer from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('meka_thermal_printer');
    if (saved) setThermalPrinter(saved);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsRes, customersRes, settingsRes] = await Promise.all([
          fetch('/api/products?limit=200&pos=1'),
          fetch('/api/customers?limit=200'),
          fetch('/api/settings'),
        ]);

        const productsData = await productsRes.json();
        const customersData = await customersRes.json();
        const settingsData = await settingsRes.json();

        setProducts(productsData.products || []);
        setCustomers(customersData.customers || []);
        if (settingsRes.ok) {
          setStoreSettings(settingsData);
        }

        const uniqueCategories = [
          ...new Set((productsData.products || []).map((p: Product) => p.category?.name).filter(Boolean)),
        ];
        setCategories(uniqueCategories as string[]);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Barcode Scanning Logic - moved to handleKeyDown callback below

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || product.category.name === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const getProductPrice = (product: Product) => {
    return pricingMode === 'WHOLESALE' ? product.wholesalePrice : product.retailPrice;
  };

  useEffect(() => {
    setCart(prev => prev.map(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product) return item;
      const newPrice = pricingMode === 'WHOLESALE' ? product.wholesalePrice : product.retailPrice;
      return { ...item, unitPrice: newPrice, total: newPrice * item.quantity - item.discount };
    }));
  }, [pricingMode, products]);

  const addToCart = useCallback((product: Product) => {
    const price = pricingMode === 'WHOLESALE' ? product.wholesalePrice : product.retailPrice;
    const existingItem = cart.find((item) => item.productId === product.id);

    if (existingItem) {
      if (existingItem.quantity + 1 > product.stockQty) {
        return; // Prevent overstock adding
      }
      setCart((prevCart) =>
        prevCart.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                total: (item.quantity + 1) * item.unitPrice - item.discount,
              }
            : item
        )
      );
    } else {
      setCart((prevCart) => [
        ...prevCart,
        {
          productId: product.id,
          name: product.name,
          quantity: 1,
          unitPrice: price,
          discount: 0,
          total: price,
          isTaxable: product.isTaxable ?? true,
          taxInclusive: product.taxInclusive ?? false,
        },
      ]);
    }
  }, [cart, pricingMode]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const currentTime = Date.now();

    if (currentTime - lastScanTime > 50) {
      setBarcodeBuffer('');
    }

    if (e.key === 'Enter') {
      if (barcodeBuffer.length > 2) {
        const product = products.find(p => 
  p.sku === barcodeBuffer || 
  (p.barcodes && p.barcodes.includes(barcodeBuffer))
);
        if (product) {
          addToCart(product);
          setSuccessMessage(`Scanned: ${product.name}`);
          setTimeout(() => setSuccessMessage(null), 1500);
        }
        setBarcodeBuffer('');
      }
    } else if (e.key.length === 1) {
      setBarcodeBuffer(prev => prev + e.key);
    }

    setLastScanTime(currentTime);
  }, [barcodeBuffer, lastScanTime, products, addToCart]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.productId !== productId));
  }, []);

  const updateCartItem = useCallback((productId: string, quantity: number, discount: number) => {
    const product = products.find(p => p.id === productId);
    if (product && quantity > product.stockQty) return;

    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity,
              discount,
              total: item.unitPrice * quantity - discount,
            }
          : item
      )
    );
  }, [products, removeFromCart]);

  const TAX_RATE = 0.075; // 7.5% VAT

  // Subtotal = sum of item totals as-stated (inclusive or exclusive)
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);

  // Tax breakdown per item:
  // - Not taxable            → taxAmount = 0
  // - Taxable, exclusive     → taxAmount = item.total * TAX_RATE   (added on top)
  // - Taxable, tax-inclusive → taxAmount = item.total * TAX_RATE / (1 + TAX_RATE)  (already in price)
  const taxBreakdown = cart.reduce(
    (acc, item) => {
      if (!item.isTaxable) return acc;
      if (item.taxInclusive) {
        const embedded = item.total * TAX_RATE / (1 + TAX_RATE);
        return { ...acc, inclusive: acc.inclusive + embedded };
      }
      const added = item.total * TAX_RATE;
      return { ...acc, exclusive: acc.exclusive + added };
    },
    { exclusive: 0, inclusive: 0 }
  );

  // Only tax-exclusive items add to what customer pays on top of subtotal
  const tax = taxBreakdown.exclusive;
  const total = subtotal + tax;

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer?.id || undefined,
          paymentMethod,
          notes: paymentMethod === 'SPLIT' ? `Cash: ${splitAmounts.cash}, Card: ${splitAmounts.card}, Transfer: ${splitAmounts.transfer}, Mobile: ${splitAmounts.mobile}` : undefined,
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
          })),
          discount: 0,
        }),
      });

      if (response.ok) {
        // Use actual API response so receipt has real sale ID and server-computed totals
        const savedSale = await response.json();
        const completedSale = {
          id: savedSale.id,
          customerId: selectedCustomer?.id || '',
          customerName: selectedCustomer?.name || 'Walk-In Customer',
          customerType: selectedCustomer?.type || 'RETAIL',
          paymentMethod,
          items: cart.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            total: item.total,
            isTaxable: item.isTaxable,
            taxInclusive: item.taxInclusive,
          })),
          subtotal,
          tax,
          taxInclusive: taxBreakdown.inclusive,
          total,
          date: savedSale.createdAt || new Date().toISOString(),
        };
        setLastSale(completedSale);
        setLastCompletedSale(completedSale);
        setSuccessMessage('Transaction Completed Successfully');
        setCart([]);
        setSelectedCustomer(null);
        setShowPaymentModal(false);
        // Auto-print receipt immediately — no button click needed
        printReceipt(completedSale);
      } else {
        const errData = await response.json().catch(() => ({}));
        setSuccessMessage(`Payment failed: ${errData.error || 'Server error. Please try again.'}`);
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    } catch (error) {
      console.error('Error completing sale:', error);
      setSuccessMessage('Network error. Check your connection and try again.');
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  const handleQuickAddCustomer = async () => {
    if (!customerForm.name) {
      setSuccessMessage('Customer name is required');
      setTimeout(() => setSuccessMessage(null), 2000);
      return;
    }
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customerForm.name,
          type: customerForm.type,
          ...(customerForm.phone ? { phone: customerForm.phone } : {}),
          ...(customerForm.email ? { email: customerForm.email } : {}),
        }),
      });
      if (res.ok) {
        const newCustomer = await res.json();
        setCustomers(prev => [...prev, newCustomer].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedCustomer(newCustomer);
        setPricingMode(newCustomer.type);
        setShowAddCustomerModal(false);
        setCustomerForm({ name: '', phone: '', email: '', type: 'RETAIL' });
        setSuccessMessage(`Customer ${newCustomer.name} added!`);
        setTimeout(() => setSuccessMessage(null), 2000);
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to add customer');
      }
    } catch (e: any) {
      console.error(e);
      setSuccessMessage(e.message || 'Error adding customer');
      setTimeout(() => setSuccessMessage(null), 2000);
    }
  };

  const handleReprint = () => {
    if (!lastCompletedSale) return;
    // Restore last sale into the success notification so all print buttons are available
    setLastSale(lastCompletedSale);
    setSuccessMessage('🖨 Reprinting Last Receipt');
  };


  // ── Print via main-window overlay ────────────────────────────────────────
  // window.print() on the main window is what --kiosk-printing was built for.
  // We inject the receipt into a hidden div, use @media print CSS to make only
  // that div visible, call window.print(), then clean up.
  const printViaIframe = (html: string) => {
    // Strip any old auto-print scripts embedded in the HTML
    const cleanHtml = html.replace(/<script[\s\S]*?<\/script>/gi, '');

    // Parse out the receipt's <style> and <body> separately
    const parser   = new DOMParser();
    const parsed   = parser.parseFromString(cleanHtml, 'text/html');
    const rcptCSS  = parsed.querySelector('style')?.innerHTML ?? '';
    const rcptBody = parsed.body.innerHTML;

    // Inject receipt content as a hidden overlay div
    const overlay = document.createElement('div');
    overlay.id = '__meka_receipt__';
    overlay.innerHTML = rcptBody;
    // Hidden from screen; only shown via @media print below
    overlay.style.cssText = 'display:none;';
    document.body.appendChild(overlay);

    // Inject print styles:
    //  - "body * { visibility:hidden }" hides EVERYTHING in the app
    //  - then we make only #__meka_receipt__ and its children visible
    //  - @page sets 80mm thermal paper size
    const styleTag = document.createElement('style');
    styleTag.id = '__meka_receipt_style__';
    styleTag.innerHTML = `
      @media print {
        @page { size: 80mm auto; margin: 2mm 3mm; }
        body * { visibility: hidden !important; }
        #__meka_receipt__ {
          display: block !important;
          visibility: visible !important;
          position: absolute !important;
          top: 0 !important; left: 0 !important;
          width: 74mm !important;
          background: #fff !important;
        }
        #__meka_receipt__ * { visibility: visible !important; }
        ${rcptCSS}
      }
    `;
    document.head.appendChild(styleTag);

    // Small delay so React finishes any pending renders before we print
    setTimeout(() => {
      console.log('[MekaERP] Sending receipt to printer…');
      window.print();
      // Clean up after the print job is dispatched
      setTimeout(() => {
        document.getElementById('__meka_receipt__')?.remove();
        document.getElementById('__meka_receipt_style__')?.remove();
        console.log('[MekaERP] Print overlay cleaned up.');
      }, 1000);
    }, 250);
  };

  /**
   * Main print dispatcher.
   * 1. If a thermal printer is configured, tries QZ Tray for silent printing.
   * 2. Falls back to iframe printing (shows browser print dialog) on any error.
   */
  const printDoc = async (html: string) => {
    // Uses browser iframe print — silent when Chrome is launched with --kiosk-printing flag
    printViaIframe(html);
  };

  const printReceipt = async (saleData?: any) => {
    const sale = saleData || lastSale;
    if (!sale) return;

    const receiptNo  = `R-${sale.id?.slice(-8).toUpperCase() ?? Date.now().toString(36).toUpperCase()}`;
    const dateObj    = new Date(sale.date);
    const dateStr    = dateObj.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr    = dateObj.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
    const biz        = storeSettings.businessName || 'MEKAERP';
    const cashier    = (session?.user as any)?.name || 'Staff';

    const payLabel: Record<string, string> = {
      CASH: 'Cash', CARD: 'Card / POS', BANK_TRANSFER: 'Bank Transfer',
      MOBILE_MONEY: 'Mobile Money', SPLIT: 'Split Payment',
    };

    const itemRows = sale.items.map((item: any) => {
      const name     = String(item.name).slice(0, 24);
      const taxTag   = !item.isTaxable ? '<span style="font-size:8px;color:#666"> [EX]</span>'
                     : item.taxInclusive ? '<span style="font-size:8px;color:#666"> [TI]</span>' : '';
      const unitP    = formatCurrency(item.unitPrice);
      const tot      = formatCurrency(item.total);
      return `
        <tr>
          <td style="padding:2px 0 1px;vertical-align:top">
            <div style="font-weight:700;font-size:11px">${name}${taxTag}</div>
            <div style="font-size:9.5px;color:#444;font-weight:600">${item.quantity} × ${unitP}</div>
          </td>
          <td style="text-align:right;vertical-align:top;padding:2px 0 1px;font-size:11px;font-weight:700;white-space:nowrap">${tot}</td>
        </tr>`;
    }).join('');

    const taxAddedHtml  = sale.tax > 0
      ? `<tr><td style="font-size:10px;color:#333;padding:1px 0;font-weight:600">VAT 7.5% (excl.)</td><td style="text-align:right;font-size:10px;padding:1px 0;font-weight:600">${formatCurrency(sale.tax)}</td></tr>` : '';
    const taxInclusHtml = sale.taxInclusive > 0
      ? `<tr><td style="font-size:10px;color:#333;padding:1px 0;font-weight:600">VAT (incl. in price)</td><td style="text-align:right;font-size:10px;padding:1px 0;font-weight:600">${formatCurrency(sale.taxInclusive)}</td></tr>` : '';

    const receiptHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt ${receiptNo}</title>
  <style>
    @page { size: 80mm auto; margin: 2mm 3mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.4;
      width: 74mm;
      color: #000;
      background: #fff;
    }
    table { width: 100%; border-collapse: collapse; }
    .biz-name {
      font-size: 16px; font-weight: 900; letter-spacing: 2px;
      text-align: center; text-transform: uppercase; margin-bottom: 2px;
    }
    .biz-info { font-size: 9.5px; font-weight: 600; text-align: center; line-height: 1.6; color: #222; }
    .dash  { border: none; border-top: 1px dashed #000; margin: 3px 0; }
    .solid { border: none; border-top: 2px solid  #000; margin: 3px 0; }
    .badge {
      font-size: 10px; font-weight: 900; letter-spacing: 3px;
      text-align: center; padding: 2px 0;
    }
    .meta td { font-size: 10px; font-weight: 600; padding: 1px 0; }
    .meta td:last-child { text-align: right; font-weight: 700; }
    .col-hdr {
      font-size: 9px; font-weight: 900; letter-spacing: 1px;
      border-top: 1px solid #000; border-bottom: 1px solid #000;
      padding: 2px 0;
    }
    .col-hdr td:last-child { text-align: right; }
    .totals td { padding: 1px 0; font-size: 10.5px; font-weight: 700; }
    .totals td:last-child { text-align: right; }
    .grand td { font-size: 14px; font-weight: 900; padding: 2px 0; }
    .grand td:last-child { text-align: right; }
    .footer { text-align: center; font-size: 9.5px; font-weight: 600; color: #222; line-height: 1.7; margin-top: 3px; }
    .rcpt-id { text-align: center; font-size: 9px; font-weight: 600; letter-spacing: 1px; margin-top: 2px; color: #444; }
    @media print { html, body { margin: 0; width: 74mm; } }
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
<hr class="dash">

<table class="meta">
  <tr><td>Receipt #</td><td>${receiptNo}</td></tr>
  <tr><td>Date</td><td>${dateStr} ${timeStr}</td></tr>
  <tr><td>Customer</td><td>${sale.customerName || 'Walk-In'}</td></tr>
  <tr><td>Cashier</td><td>${cashier}</td></tr>
  <tr><td>Payment</td><td>${payLabel[sale.paymentMethod] || sale.paymentMethod}</td></tr>
</table>

<hr class="dash">
<table>
  <tr class="col-hdr">
    <td>ITEM DESCRIPTION</td>
    <td style="text-align:right">AMOUNT</td>
  </tr>
  ${itemRows}
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

    await printDoc(receiptHtml);
  };

  const printWholesaleReceipt = async () => {
    if (!lastSale) return;

    const invoiceNo = `WS-${new Date(lastSale.date).getFullYear()}${String(new Date(lastSale.date).getMonth()+1).padStart(2,'0')}${String(new Date(lastSale.date).getDate()).padStart(2,'0')}-${lastSale.id?.slice(-5).toUpperCase() ?? Math.floor(Math.random()*99999).toString().padStart(5,'0')}`;
    const dateStr   = new Date(lastSale.date).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
    const biz       = storeSettings.businessName || 'MEKAERP';
    const W         = 42; // 80mm thermal column width

    const row = (left: string, right: string) => {
      const gap = W - left.length - right.length;
      return left + (gap > 0 ? ' '.repeat(gap) : ' ') + right;
    };
    const center = (s: string) => {
      const pad = Math.max(0, Math.floor((W - s.length) / 2));
      return ' '.repeat(pad) + s;
    };
    const dash  = '-'.repeat(W);
    const dDash = '='.repeat(W);

    const payLabel: Record<string, string> = {
      CASH: 'Cash', CARD: 'Card / POS', BANK_TRANSFER: 'Bank Transfer',
      MOBILE_MONEY: 'Mobile Money', SPLIT: 'Split Payment',
    };

    const itemLines = lastSale.items.map((item: any) => {
      const desc     = `${item.name}`.slice(0, 28);
      const qtyPrice = `${item.quantity} x ${formatCurrency(item.unitPrice)}`;
      const total    = formatCurrency(item.total);
      return [
        `  ${desc}`,
        row(`  ${qtyPrice}`, total),
      ].join('\n');
    }).join('\n');

    const discountLine = lastSale.discount > 0 ? `\n${row('  Discount:', `-${formatCurrency(lastSale.discount)}`)}` : '';
    const taxAddedLine = lastSale.tax > 0 ? `\n${row('  VAT 7.5%:', formatCurrency(lastSale.tax))}` : '';

    const receiptHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Wholesale Receipt ${invoiceNo}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      line-height: 1.45;
      width: 72mm;
      color: #000;
      background: #fff;
      padding: 4mm 0;
    }
    pre { white-space: pre-wrap; word-break: break-word; font-family: inherit; font-size: inherit; }
    .biz-name { font-size: 18px; font-weight: 900; letter-spacing: 1px; text-align: center; margin-bottom: 2px; }
    .biz-sub  { font-size: 11px; text-align: center; color: #333; }
    .ws-badge { font-size: 10px; font-weight: 900; letter-spacing: 2px; text-align: center; border: 2px solid #000; padding: 2px 0; margin: 5px 0; }
    .total-line { font-size: 15px; font-weight: 900; }
    .footer { text-align: center; font-size: 11px; margin-top: 8px; color: #333; }
    @media print { html, body { margin: 0; padding: 0; } body { width: 72mm; } }
  </style>
</head>
<body>
<div class="biz-name">${biz}</div>
${storeSettings.businessAddress ? `<div class="biz-sub">${storeSettings.businessAddress}</div>` : ''}
${storeSettings.businessPhone   ? `<div class="biz-sub">Tel: ${storeSettings.businessPhone}</div>` : ''}
${storeSettings.businessEmail   ? `<div class="biz-sub">${storeSettings.businessEmail}</div>` : ''}
<div class="ws-badge">*** WHOLESALE RECEIPT ***</div>
<pre>
${dash}
${row('Invoice No:', invoiceNo)}
${row('Date:', dateStr)}
${row('Customer:', lastSale.customerName || 'Wholesale Customer')}
${row('Payment:', payLabel[lastSale.paymentMethod] || lastSale.paymentMethod)}
${dash}
ITEMS (WHOLESALE PRICING)
${dash}
${itemLines}
${dash}
${row('Subtotal:', formatCurrency(lastSale.subtotal))}${discountLine}${taxAddedLine}
${dDash}
</pre>
<pre class="total-line">${row('  TOTAL PAID:', formatCurrency(lastSale.total))}</pre>
<pre>
${dDash}
${center('** WHOLESALE COPY **')}
${center('Not valid as retail receipt')}
</pre>
<div class="footer">
  ${storeSettings.receiptFooter || 'Thank you for your business!'}
  <br>Please retain for your records.
</div>
</body>
</html>`;

    await printDoc(receiptHtml);
  };

  const generateInvoice = () => {
    if (!lastSale) return;

    const dateObj   = new Date(lastSale.date);
    const dateStr   = dateObj.toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' });
    const invoiceNo = `INV-${dateObj.getFullYear()}${String(dateObj.getMonth()+1).padStart(2,'0')}${String(dateObj.getDate()).padStart(2,'0')}-${lastSale.id?.slice(-5).toUpperCase() ?? Math.floor(Math.random()*99999).toString().padStart(5,'0')}`;
    const biz       = storeSettings.businessName || 'MekaERP';
    const PRIMARY   = [37, 99, 235] as [number, number, number];   // blue-600
    const DARK      = [15, 23, 42]  as [number, number, number];   // slate-900
    const MUTED     = [100, 116, 139] as [number, number, number]; // slate-500
    const doc       = new jsPDF({ unit: 'mm', format: 'a4' });
    const PW        = 210; // page width
    const M         = 14;  // margin

    // ── Header band ──────────────────────────────────────────────────
    doc.setFillColor(...PRIMARY);
    doc.rect(0, 0, PW, 38, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text(biz.toUpperCase(), M, 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(180, 210, 255);
    if (storeSettings.businessAddress) doc.text(storeSettings.businessAddress, M, 22);
    if (storeSettings.businessPhone)   doc.text(`Tel: ${storeSettings.businessPhone}`, M, 27);
    if (storeSettings.businessEmail)   doc.text(storeSettings.businessEmail, M, 32);

    // "INVOICE" title on right of header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(255, 255, 255);
    doc.text('INVOICE', PW - M, 22, { align: 'right' });

    // ── Invoice meta box ─────────────────────────────────────────────
    let y = 48;
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(PW - M - 72, y - 6, 76, 28, 2, 2, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('INVOICE NO',  PW - M - 70, y);
    doc.text('DATE',        PW - M - 70, y + 8);
    doc.text('PAYMENT',     PW - M - 70, y + 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text(invoiceNo, PW - M, y, { align: 'right' });
    doc.text(dateStr,   PW - M, y + 8, { align: 'right' });
    const payLabel: Record<string, string> = {
      CASH: 'Cash', CARD: 'Card / POS Terminal', BANK_TRANSFER: 'Bank Transfer',
      MOBILE_MONEY: 'Mobile Money', SPLIT: 'Split Payment',
    };
    doc.text(payLabel[lastSale.paymentMethod] || lastSale.paymentMethod, PW - M, y + 16, { align: 'right' });

    // ── Bill To ───────────────────────────────────────────────────────
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('BILL TO', M, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...DARK);
    doc.text(lastSale.customerName || 'Walk-in Customer', M, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(lastSale.customerType === 'WHOLESALE' ? 'Wholesale Account' : 'Retail Customer', M, y + 14);

    // ── Items table ───────────────────────────────────────────────────
    y = 84;
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [['#', 'Item Description', 'Tax', 'Qty', 'Unit Price', 'Total']],
      body: lastSale.items.map((item: any, i: number) => [
        String(i + 1),
        item.name,
        !item.isTaxable ? 'Exempt' : item.taxInclusive ? 'Incl.' : '7.5%',
        item.quantity.toString(),
        formatCurrency(item.unitPrice),
        formatCurrency(item.total),
      ]),
      theme: 'grid',
      headStyles: {
        fillColor: PRIMARY,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: 4,
      },
      columnStyles: {
        0: { cellWidth: 8,  halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 16, halign: 'center', fontSize: 8 },
        3: { cellWidth: 12, halign: 'center' },
        4: { cellWidth: 28, halign: 'right' },
        5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 9, cellPadding: 3, textColor: DARK },
    });

    // ── Totals block ──────────────────────────────────────────────────
    const afterTable = (doc as any).lastAutoTable.finalY + 6;
    const totX = PW - M - 68;

    const drawTotalRow = (label: string, value: string, yy: number, bold = false, big = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(big ? 11 : 9);
      doc.setTextColor(...(bold ? DARK : MUTED) as [number, number, number]);
      doc.text(label, totX, yy);
      doc.setTextColor(...DARK);
      doc.text(value, PW - M, yy, { align: 'right' });
    };

    let ty = afterTable;
    doc.setDrawColor(226, 232, 240);
    doc.line(totX, ty - 2, PW - M, ty - 2);

    drawTotalRow('Subtotal',         formatCurrency(lastSale.subtotal), ty);            ty += 6;
    if (lastSale.tax > 0) {
      drawTotalRow('VAT 7.5% (+tax)', formatCurrency(lastSale.tax),     ty);            ty += 6;
    }
    if (lastSale.taxInclusive > 0) {
      drawTotalRow('VAT incl. (in price)', formatCurrency(lastSale.taxInclusive), ty);  ty += 6;
    }

    // Total box
    doc.setFillColor(...PRIMARY);
    doc.roundedRect(totX - 2, ty, PW - M - totX + 4, 12, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL',                  totX + 2,  ty + 8);
    doc.text(formatCurrency(lastSale.total), PW - M - 2, ty + 8, { align: 'right' });
    ty += 18;

    // ── PAID stamp ────────────────────────────────────────────────────
    doc.saveGraphicsState();
    doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(60);
    doc.setTextColor(34, 197, 94); // green-500
    doc.text('PAID', PW / 2, 160, { align: 'center', angle: 35 });
    doc.restoreGraphicsState();

    // ── Notes / Terms ─────────────────────────────────────────────────
    const notesY = Math.max(ty + 6, afterTable + 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('PAYMENT CONFIRMED', M, notesY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK);
    doc.text(`Payment of ${formatCurrency(lastSale.total)} received in full via ${payLabel[lastSale.paymentMethod] || lastSale.paymentMethod}.`, M, notesY + 5);
    doc.text('No further payment is due. This invoice serves as proof of purchase.', M, notesY + 10);

    // ── Footer band ───────────────────────────────────────────────────
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 275, PW, 22, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`${biz} · ${storeSettings.businessAddress || ''} · ${storeSettings.businessPhone || ''}`, PW / 2, 283, { align: 'center' });
    doc.text(invoiceNo, PW / 2, 289, { align: 'center' });

    doc.save(`${invoiceNo}.pdf`);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-4">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground font-medium animate-pulse text-lg">Initializing POS Terminal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-background text-foreground transition-all duration-300 relative">
      {/* Product Catalog Section */}
      <div className={`flex-col p-4 md:p-6 space-y-4 md:space-y-6 overflow-hidden flex-1 ${showMobileCart ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Scan barcode or search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-base pl-10 h-12 bg-card text-lg"
              autoFocus
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-6 py-2 rounded-xl border text-sm font-semibold transition-all ${
                !selectedCategory
                  ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20'
                  : 'bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              All Items
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-6 py-2 rounded-xl border text-sm font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === category
                    ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20'
                    : 'bg-card text-muted-foreground hover:bg-muted'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 flex-1 overflow-y-auto pr-2 content-start">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              disabled={product.stockQty === 0}
              className="card-premium p-2.5 flex flex-col text-left group relative disabled:opacity-40 hover:border-primary/60 transition-all min-h-[88px]"
            >
              {/* Stock status badge — top right */}
              <div className="absolute top-1.5 right-1.5">
                {product.stockQty === 0 ? (
                  <span className="text-[8px] font-black bg-red-100 text-red-500 px-1 py-0.5 rounded leading-none">OUT</span>
                ) : product.stockQty < 10 ? (
                  <AlertCircle className="w-2.5 h-2.5 text-orange-400" />
                ) : null}
              </div>

              {/* Product name */}
              <h4 className="font-semibold text-[11px] leading-tight text-foreground group-hover:text-primary transition-colors line-clamp-2 pr-4 mb-1">
                {product.name}
              </h4>

              {/* SKU */}
              <p className="text-[9px] text-muted-foreground/70 uppercase tracking-wide mb-auto truncate">
                {product.sku}
              </p>

              {/* Price + stock row */}
              <div className="flex items-end justify-between mt-2 pt-1.5 border-t border-border/50">
                <p className="font-black text-xs text-primary leading-none">
                  {formatCurrency(getProductPrice(product))}
                </p>
                <p className={`text-[9px] font-bold leading-none ${product.stockQty < 10 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                  {product.stockQty}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart Section — full-screen on mobile when active, fixed panel on desktop */}
      <div className={`bg-card border-l flex-col shadow-2xl z-10 animate-entrance w-full md:w-[420px] ${showMobileCart ? 'flex' : 'hidden md:flex'}`}>
        <div className="p-6 border-b space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xl flex items-center gap-2">
              {/* Back button — mobile only */}
              <button
                onClick={() => setShowMobileCart(false)}
                className="md:hidden p-1 -ml-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <ShoppingCart className="w-5 h-5 text-primary" />
              Current Order
            </h3>
            <button
              onClick={() => setCart([])}
              className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>

          <div className="relative group flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <select
                value={selectedCustomer?.id || ''}
                onChange={(e) => {
                  const customer = customers.find((c) => c.id === e.target.value);
                  setSelectedCustomer(customer || null);
                  if (customer && customer.type === 'WHOLESALE') {
                    setPricingMode('WHOLESALE');
                  } else {
                    setPricingMode('RETAIL');
                  }
                }}
                className="input-base pl-10 appearance-none bg-muted/50 border-none cursor-pointer"
              >
                <option value="">Guest Customer (Retail)</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} — {customer.type}
                  </option>
                ))}
              </select>
              {selectedCustomer?.type === 'WHOLESALE' && (
                <div className="absolute right-8 top-1/2 -translate-y-1/2">
                  <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Wholesale Applied</span>
                </div>
              )}
            </div>
            <button 
              onClick={() => setShowAddCustomerModal(true)}
              className="p-3 bg-muted/30 hover:bg-muted text-primary rounded-xl transition-colors shrink-0"
              title="Quick Add Customer"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
              <div className="p-6 bg-muted/50 rounded-full">
                <ShoppingCart className="w-12 h-12 text-muted-foreground/30" />
              </div>
              <div>
                <p className="font-bold text-muted-foreground">Empty Terminal</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Add items from the catalog or scan a barcode to begin checkout.</p>
              </div>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.productId} className="bg-card p-4 rounded-xl border shadow-sm group animate-slide-up">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 pr-4">
                    <p className="font-bold text-sm leading-tight line-clamp-1">{item.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatCurrency(item.unitPrice)} / unit</p>
                  </div>
                  <p className="font-bold text-sm text-primary">{formatCurrency(item.total)}</p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                    <button 
                      onClick={() => updateCartItem(item.productId, item.quantity - 1, item.discount)}
                      className="p-1 hover:bg-card rounded-md transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-xs font-bold leading-none">{item.quantity}</span>
                    <button 
                      onClick={() => updateCartItem(item.productId, item.quantity + 1, item.discount)}
                      className="p-1 hover:bg-card rounded-md transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.productId)}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors font-medium"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-card border-t shadow-inner space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-medium text-foreground">{formatCurrency(subtotal)}</span>
            </div>

            {/* Tax-exclusive line — added on top */}
            {taxBreakdown.exclusive > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>VAT 7.5% <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded ml-1">+tax</span></span>
                <span className="font-medium text-foreground">{formatCurrency(taxBreakdown.exclusive)}</span>
              </div>
            )}

            {/* Tax-inclusive line — informational, already in the price */}
            {taxBreakdown.inclusive > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>VAT incl. <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded ml-1">in price</span></span>
                <span className="font-medium text-foreground">{formatCurrency(taxBreakdown.inclusive)}</span>
              </div>
            )}

            {/* No-tax line — only if ALL items are exempt */}
            {taxBreakdown.exclusive === 0 && taxBreakdown.inclusive === 0 && cart.length > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>VAT <span className="text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground px-1.5 py-0.5 rounded ml-1">exempt</span></span>
                <span className="font-medium text-foreground">₦0</span>
              </div>
            )}

            <div className="flex justify-between items-end pt-2 border-t">
              <span className="text-base font-bold text-muted-foreground">Total Payable</span>
              <span className="text-3xl font-black text-primary tracking-tighter">
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="relative col-span-2">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="input-base pl-10 appearance-none bg-muted/30 border-none font-medium text-sm"
              >
                <option value="CASH">Cash Payment</option>
                <option value="CARD">Card / POS Terminal</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="SPLIT">Split Payment</option>
              </select>
            </div>
            
            <div className="col-span-2 flex items-center bg-muted/30 p-1.5 rounded-lg">
               <button onClick={() => setPricingMode('RETAIL')} className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${pricingMode === 'RETAIL' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground'}`}>Retail Mode</button>
               <button onClick={() => setPricingMode('WHOLESALE')} className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${pricingMode === 'WHOLESALE' ? 'bg-blue-600 text-white shadow-sm' : 'text-muted-foreground'}`}>Wholesale Mode</button>
            </div>

            {/* Printer status indicator + reprint */}
            <div className="col-span-2 flex items-center gap-2">
              <div
                title="Printing via browser — open POS with the kiosk shortcut for silent auto-print"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-green-500/60 bg-green-500/10 text-green-600 text-xs font-medium shrink-0"
              >
                <Printer className="w-3.5 h-3.5 shrink-0" />
                <span>Auto Print</span>
              </div>
              {lastCompletedSale && (
                <button
                  onClick={handleReprint}
                  className="flex-1 text-xs text-muted-foreground hover:text-primary border border-dashed border-border hover:border-primary/50 rounded-xl py-2 transition-all flex items-center justify-center gap-1.5 font-medium"
                >
                  🖨 Reprint
                  <span className="text-[10px] opacity-60 ml-1">#{lastCompletedSale.id?.slice(-6).toUpperCase()}</span>
                </button>
              )}
            </div>
            <button
              onClick={() => setShowPaymentModal(true)}
              disabled={cart.length === 0}
              className="col-span-2 bg-primary text-primary-foreground h-14 rounded-xl font-bold text-lg shadow-lg shadow-primary/30 hover:shadow-primary/40 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:grayscale disabled:shadow-none flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              Finalize Transaction
            </button>
          </div>
        </div>
      </div>

      {/* Mobile floating cart button */}
      {!showMobileCart && (
        <button
          onClick={() => setShowMobileCart(true)}
          className="fixed bottom-6 right-6 md:hidden z-50 flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3.5 rounded-full shadow-2xl shadow-primary/40 font-bold text-sm active:scale-95 transition-all"
        >
          <ShoppingCart className="w-5 h-5" />
          Cart
          {cart.length > 0 && (
            <span className="bg-white text-primary text-xs font-black w-5 h-5 rounded-full flex items-center justify-center ml-1">
              {cart.length}
            </span>
          )}
        </button>
      )}

      {/* Transaction status overlay */}
      {successMessage && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-bounce">
          <div className={`px-5 py-3 rounded-2xl flex items-center gap-3 shadow-2xl ${lastSale ? 'bg-green-600' : 'bg-red-500'} text-white`}>
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span className="font-bold tracking-tight text-sm">{successMessage}</span>
            {lastSale && (
              <div className="ml-2 flex gap-2 flex-wrap">
                <button
                  onClick={() => printReceipt()}
                  className="bg-white text-green-600 px-4 py-1 rounded-full font-bold text-sm hover:bg-white/90 transition-colors"
                >
                  🖨 Reprint
                </button>
                {(lastSale.customerType === 'WHOLESALE' || pricingMode === 'WHOLESALE') && (
                  <>
                    <button
                      onClick={generateInvoice}
                      className="bg-green-800 text-white px-4 py-1 rounded-full font-bold text-sm hover:bg-green-900 transition-colors"
                    >
                      Invoice PDF
                    </button>
                    <button
                      onClick={printWholesaleReceipt}
                      title="Print on 80mm thermal printer (no A4 needed)"
                      className="bg-yellow-500 text-white px-4 py-1 rounded-full font-bold text-sm hover:bg-yellow-600 transition-colors"
                    >
                      🖨 80mm
                    </button>
                  </>
                )}
              </div>
            )}
            {/* Dismiss button */}
            <button
              onClick={() => { setSuccessMessage(null); setLastSale(null); }}
              className="ml-2 p-1 rounded-full hover:bg-white/20 transition-colors shrink-0"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-card glass rounded-2xl p-8 max-w-md w-full shadow-2xl animate-entrance border-none">
            <h2 className="text-3xl font-black tracking-tight mb-2">Checkout</h2>
            <p className="text-muted-foreground text-sm mb-6">Confirm and process the outgoing transaction.</p>

            <div className="space-y-4 bg-muted/20 p-6 rounded-2xl border border-white/5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground uppercase font-bold">Client</span>
                <span className="font-bold font-mono text-sm">{selectedCustomer?.name || 'Walk-In Customer'}</span>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-white/5">
                <span className="text-xs text-muted-foreground uppercase font-bold">Method</span>
                <div className="flex items-center gap-2 font-bold text-sm">
                   {paymentMethod === 'CASH' && <Banknote className="w-4 h-4 text-green-500" />}
                   {paymentMethod === 'CARD' && <CreditCard className="w-4 h-4 text-blue-500" />}
                   {paymentMethod === 'BANK_TRANSFER' && <ChevronRight className="w-4 h-4 text-purple-500" />}
                   {paymentMethod === 'MOBILE_MONEY' && <Smartphone className="w-4 h-4 text-orange-500" />}
                   {paymentMethod.replace(/_/g, ' ')}
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                <span className="text-xs text-muted-foreground uppercase font-bold block mb-1">Items Count</span>
                <span className="font-black text-xl">{cart.length} Products</span>
              </div>

              <div className="pt-6 border-t border-white/5 mt-2">
                <p className="text-xs text-muted-foreground uppercase font-bold mb-1 text-center">Grand Total</p>
                <p className="text-4xl font-black text-primary text-center tracking-tighter">
                  {formatCurrency(total)}
                </p>
              </div>

              {paymentMethod === 'SPLIT' && (
                <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-3">
                  <p className="col-span-2 text-xs text-muted-foreground uppercase font-bold">Split Amounts Breakdown</p>
                  <div>
                    <label className="text-[10px] uppercase font-bold">Cash</label>
                    <input type="number" min="0" value={splitAmounts.cash || ''} onChange={(e) => setSplitAmounts({...splitAmounts, cash: parseFloat(e.target.value) || 0})} className="input-base py-1 px-2 text-sm" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold">Card</label>
                    <input type="number" min="0" value={splitAmounts.card || ''} onChange={(e) => setSplitAmounts({...splitAmounts, card: parseFloat(e.target.value) || 0})} className="input-base py-1 px-2 text-sm" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold">Transfer</label>
                    <input type="number" min="0" value={splitAmounts.transfer || ''} onChange={(e) => setSplitAmounts({...splitAmounts, transfer: parseFloat(e.target.value) || 0})} className="input-base py-1 px-2 text-sm" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold">Mobile</label>
                    <input type="number" min="0" value={splitAmounts.mobile || ''} onChange={(e) => setSplitAmounts({...splitAmounts, mobile: parseFloat(e.target.value) || 0})} className="input-base py-1 px-2 text-sm" placeholder="0" />
                  </div>
                  <div className="col-span-2 text-center text-xs font-bold mt-2">
                    Sum: {formatCurrency(splitAmounts.cash + splitAmounts.card + splitAmounts.transfer + splitAmounts.mobile)}
                    {Math.abs((splitAmounts.cash + splitAmounts.card + splitAmounts.transfer + splitAmounts.mobile) - total) > 0.01 && (
                       <span className="text-red-500 ml-2">Mismatch! Needs {formatCurrency(Math.abs(total - (splitAmounts.cash + splitAmounts.card + splitAmounts.transfer + splitAmounts.mobile)))}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 h-12 rounded-xl font-bold bg-muted hover:bg-muted-foreground/10 transition-colors"
              >
                Go Back
              </button>
              <button 
                onClick={handleCheckout} 
                disabled={paymentMethod === 'SPLIT' && Math.abs((splitAmounts.cash + splitAmounts.card + splitAmounts.transfer + splitAmounts.mobile) - total) > 0.01}
                className="flex-1 bg-primary text-primary-foreground h-12 rounded-xl font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-slide-up border border-white/10">
            <h2 className="text-xl font-bold tracking-tight mb-4 text-foreground">Quick Add Customer</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase">Full Name *</label>
                <input value={customerForm.name} onChange={e => setCustomerForm({...customerForm, name: e.target.value})} className="input-base mt-1" placeholder="Jane Doe" autoFocus />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase">Phone Number</label>
                <input type="tel" value={customerForm.phone} onChange={e => setCustomerForm({...customerForm, phone: e.target.value})} className="input-base mt-1" placeholder="080..." />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase">Customer Type</label>
                <select value={customerForm.type} onChange={e => setCustomerForm({...customerForm, type: e.target.value as any})} className="input-base mt-1 appearance-none cursor-pointer">
                  <option value="RETAIL">Retail (Standard Prices)</option>
                  <option value="WHOLESALE">Wholesale (Discounted Prices)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddCustomerModal(false)} className="flex-1 btn-secondary py-2 h-10">Cancel</button>
              <button onClick={handleQuickAddCustomer} className="flex-1 btn-primary py-2 h-10">Save Customer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
