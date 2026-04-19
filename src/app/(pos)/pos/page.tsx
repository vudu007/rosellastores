'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  Search, ShoppingCart, User, CreditCard, Banknote,
  Smartphone, Trash2, Plus, Minus, CheckCircle,
  ChevronRight, Package, AlertCircle, ArrowLeft
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Product {
  id: string;
  name: string;
  sku: string;
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
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const [lastScanTime, setLastScanTime] = useState(0);
  const [storeSettings, setStoreSettings] = useState<any>({});
  const [showMobileCart, setShowMobileCart] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsRes, customersRes, settingsRes] = await Promise.all([
          fetch('/api/products?limit=200'),
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
        const product = products.find(p => p.sku === barcodeBuffer || (p as any).barcode === barcodeBuffer);
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
    if (!selectedCustomer || cart.length === 0) return;

    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
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
        setLastSale({
          id: savedSale.id,
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.name,
          customerType: selectedCustomer.type,
          paymentMethod,
          items: cart.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            total: item.total,
          })),
          subtotal,
          tax,
          total,
          date: savedSale.createdAt || new Date().toISOString(),
        });
        setSuccessMessage('Transaction Completed Successfully');
        setCart([]);
        setSelectedCustomer(null);
        setShowPaymentModal(false);
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
        body: JSON.stringify(customerForm),
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

  const printReceipt = () => {
    if (!lastSale) return;
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;

    const receiptHtml = `
      <html>
        <head>
          <title>Receipt - ${lastSale.customerName}</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; width: 300px; padding: 20px; font-size: 14px; }
            .header { text-align: center; margin-bottom: 20px; }
            .logo { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
            .logo-img { max-width: 150px; max-height: 80px; margin: 0 auto 10px auto; display: block; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .item { display: flex; justify-content: space-between; margin: 5px 0; }
            .total { font-weight: bold; margin-top: 10px; }
            .footer { text-align: center; margin-top: 30px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            ${storeSettings.businessLogo ? `<img src="${storeSettings.businessLogo}" class="logo-img" />` : ''}
            <div class="logo">${storeSettings.businessName || 'MEKAERP'}</div>
            ${storeSettings.businessAddress ? `<div>${storeSettings.businessAddress}</div>` : ''}
            ${storeSettings.businessPhone ? `<div>${storeSettings.businessPhone}</div>` : ''}
            <div class="divider"></div>
            <div>Order: ${lastSale.date.slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 1000)}</div>
            <div>Date: ${new Date(lastSale.date).toLocaleString()}</div>
          </div>
          <div class="divider"></div>
          <div>Customer: ${lastSale.customerName}</div>
          <div class="divider"></div>
          ${lastSale.items.map((item: any) => `
            <div class="item">
              <span>${item.name} x${item.quantity}</span>
              <span>${formatCurrency(item.total)}</span>
            </div>
          `).join('')}
          <div class="divider"></div>
          <div class="item">
            <span>Subtotal:</span>
            <span>${formatCurrency(lastSale.subtotal)}</span>
          </div>
          <div class="item">
            <span>Tax:</span>
            <span>${formatCurrency(lastSale.tax)}</span>
          </div>
          <div class="item total">
            <span>TOTAL:</span>
            <span>${formatCurrency(lastSale.total)}</span>
          </div>
          <div class="divider"></div>
          <div class="footer">
            Thank you for shopping with us!<br>
            Please keep your receipt.
          </div>
          <script>
            window.onload = () => { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(receiptHtml);
    printWindow.document.close();
    setSuccessMessage(null);
    setLastSale(null);
  };

  const generateInvoice = () => {
    if (!lastSale) return;
    const doc = new jsPDF();
    const invoiceNo = `INV-${lastSale.date.slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 1000)}`;
    
    // Header
    doc.setFontSize(22);
    doc.text(storeSettings.businessName || 'MEKAERP', 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(storeSettings.businessAddress || '', 14, 26);
    doc.text(storeSettings.businessPhone || '', 14, 32);

    // Document Title
    doc.setFontSize(20);
    doc.setTextColor(0);
    doc.text('INVOICE', 160, 20);
    
    // Details
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Invoice No: ${invoiceNo}`, 160, 28);
    doc.text(`Date: ${new Date(lastSale.date).toLocaleDateString()}`, 160, 34);
    doc.text(`Due Date: Upon Receipt`, 160, 40);

    // Bill To
    doc.setTextColor(0);
    doc.text('BILL TO:', 14, 50);
    doc.setFontSize(12);
    doc.text(lastSale.customerName, 14, 56);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(lastSale.customerType === 'WHOLESALE' ? 'Wholesale Customer' : 'Retail Customer', 14, 62);

    // Table
    autoTable(doc, {
      startY: 75,
      head: [['Item Name', 'Quantity', 'Unit Price', 'Total']],
      body: lastSale.items.map((item: any) => [
        item.name,
        item.quantity.toString(),
        formatCurrency(item.unitPrice),
        formatCurrency(item.total)
      ]),
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      styles: { fontSize: 10 }
    });

    // Summary
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.text(`Subtotal: ${formatCurrency(lastSale.subtotal)}`, 140, finalY);
    doc.text(`Tax: ${formatCurrency(lastSale.tax)}`, 140, finalY + 6);
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL: ${formatCurrency(lastSale.total)}`, 140, finalY + 14);

    // Footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text('Thank you for your business.', 105, 280, { align: 'center' });

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

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 flex-1 overflow-y-auto pr-2">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              disabled={product.stockQty === 0}
              className="card-premium p-4 flex flex-col text-left group relative disabled:opacity-50 overflow-hidden"
            >
              <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                {product.stockQty <= product.retailPrice * 0.1 && product.stockQty > 0 && (
                  <div className="bg-orange-100 text-orange-600 p-1 rounded-md">
                    <AlertCircle className="w-3 h-3" />
                  </div>
                )}
              </div>
              
              <div className="aspect-square bg-muted/30 rounded-lg mb-4 flex items-center justify-center transition-transform group-hover:scale-105">
                <Package className="w-8 h-8 text-muted-foreground/40" />
              </div>

              <div className="flex-1">
                <h4 className="font-bold text-sm leading-tight text-foreground group-hover:text-primary transition-colors line-clamp-2">
                  {product.name}
                </h4>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">{product.sku}</p>
              </div>

              <div className="mt-4 pt-4 border-t flex items-end justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Price</p>
                  <p className="font-bold text-lg text-primary">
                    {formatCurrency(getProductPrice(product))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase">In Stock</p>
                  <p className={`text-xs font-bold ${product.stockQty < 10 ? 'text-orange-500' : 'text-foreground'}`}>
                    {product.stockQty} {product.stockQty === 0 ? 'Out' : 'pcs'}
                  </p>
                </div>
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

            <button
              onClick={() => setShowPaymentModal(true)}
              disabled={cart.length === 0 || !selectedCustomer}
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
          <div className={`px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl ${lastSale ? 'bg-green-600' : 'bg-red-500'} text-white`}>
            <CheckCircle className="w-5 h-5" />
            <span className="font-bold tracking-tight">{successMessage}</span>
            {lastSale && (
              <div className="ml-4 flex gap-2">
                <button
                  onClick={printReceipt}
                  className="bg-white text-green-600 px-4 py-1 rounded-full font-bold hover:bg-white/90 transition-colors"
                >
                  Print Receipt
                </button>
                {(lastSale.customerType === 'WHOLESALE' || pricingMode === 'WHOLESALE') && (
                  <button
                    onClick={generateInvoice}
                    className="bg-green-800 text-white px-4 py-1 rounded-full font-bold hover:bg-green-900 transition-colors"
                  >
                    Generate Invoice
                  </button>
                )}
              </div>
            )}
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
                <span className="font-bold font-mono text-sm">{selectedCustomer?.name}</span>
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
