'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import {
  Search, ShoppingCart, User, CreditCard, Banknote,
  Smartphone, Trash2, Plus, Minus, CheckCircle,
  ChevronRight, Package, AlertCircle, ArrowLeft, Printer, Info, X, Clock, Wifi, Layers, RotateCcw
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { printHTMLWithQZ } from '@/lib/qztray';

interface Product {
  id: string;
  name: string;
  sku: string;
  barcodes: string[];
  costPrice: number;
  retailPrice: number;
  stockQty: number;
  category: { name: string };
  imageUrl?: string;
  isTaxable: boolean;
  taxInclusive: boolean;
}

interface Customer {
  id: string;
  name: string;
  type: 'RETAIL';
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
  const [cartPulse, setCartPulse] = useState(false);
  const [pulseItemId, setPulseItemId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [splitAmounts, setSplitAmounts] = useState({ cash: 0, card: 0, transfer: 0, mobile: 0 });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historySales, setHistorySales] = useState<any[]>([]);
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyReprintingId, setHistoryReprintingId] = useState<string | null>(null);
  const [returnSource, setReturnSource] = useState<'LAST' | 'RECEIPT'>(() => 'RECEIPT');
  const [returnLookup, setReturnLookup] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [returnItems, setReturnItems] = useState<Array<{ productId: string; name: string; maxQty: number; qty: number; selected: boolean }>>([]);
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', email: '' });
  const [lastSale, setLastSale] = useState<any>(null);
  const [lastCompletedSale, setLastCompletedSale] = useState<any>(null);
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const [lastScanTime, setLastScanTime] = useState(0);
  const [storeSettings, setStoreSettings] = useState<any>({});
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingSalesCount, setPendingSalesCount] = useState(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const raw = localStorage.getItem('meka_offline_sales_v1');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  });
  const [syncingPendingSales, setSyncingPendingSales] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [customerLookup, setCustomerLookup] = useState('');
  const customerLookupRef = useRef<HTMLInputElement | null>(null);
  const [heldBillCount, setHeldBillCount] = useState(0);
  const HELD_BILL_KEY = 'meka_held_bill_v1';

  // QZ Tray thermal printer — saved name comes from Settings page via localStorage
  const [thermalPrinter, setThermalPrinter] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem('meka_thermal_printer') || '';
    } catch {
      return '';
    }
  });
  const printingRef = useRef(false);
  const cartPulseTimeoutRef = useRef<number | null>(null);
  const itemPulseTimeoutRef = useRef<number | null>(null);

  const OFFLINE_SALES_KEY = 'meka_offline_sales_v1';

  const triggerCartPulse = useCallback((productId?: string) => {
    setCartPulse(true);
    if (cartPulseTimeoutRef.current) window.clearTimeout(cartPulseTimeoutRef.current);
    cartPulseTimeoutRef.current = window.setTimeout(() => setCartPulse(false), 220);

    if (productId) {
      setPulseItemId(productId);
      if (itemPulseTimeoutRef.current) window.clearTimeout(itemPulseTimeoutRef.current);
      itemPulseTimeoutRef.current = window.setTimeout(() => setPulseItemId(null), 520);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (cartPulseTimeoutRef.current) window.clearTimeout(cartPulseTimeoutRef.current);
      if (itemPulseTimeoutRef.current) window.clearTimeout(itemPulseTimeoutRef.current);
    };
  }, []);

  const loadOfflineSales = useCallback(() => {
    try {
      const raw = localStorage.getItem(OFFLINE_SALES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, []);

  const saveOfflineSales = useCallback((sales: any[]) => {
    localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(sales));
    setPendingSalesCount(sales.length);
  }, []);

  const syncOfflineSales = useCallback(async () => {
    if (syncingPendingSales) return;
    if (!navigator.onLine) return;
    setSyncingPendingSales(true);
    try {
      let queue = loadOfflineSales();
      for (const entry of queue) {
        if (!entry?.payload) continue;
        const res = await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry.payload),
        });

        if (res.ok) {
          queue = queue.filter((x: any) => x?.clientSaleId !== entry.clientSaleId);
          saveOfflineSales(queue);
          continue;
        }

        const err = await res.json().catch(() => ({}));
        queue = queue.map((x: any) =>
          x?.clientSaleId === entry.clientSaleId
            ? { ...x, lastError: err?.error || `HTTP ${res.status}` }
            : x
        );
        saveOfflineSales(queue);
      }
    } finally {
      setSyncingPendingSales(false);
    }
  }, [loadOfflineSales, saveOfflineSales, syncingPendingSales]);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      syncOfflineSales();
    };
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [loadOfflineSales, syncOfflineSales]);

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
        localStorage.setItem('meka_cache_products_v1', JSON.stringify(productsData.products || []));
        localStorage.setItem('meka_cache_customers_v1', JSON.stringify(customersData.customers || []));
        if (settingsRes.ok) {
          localStorage.setItem('meka_cache_settings_v1', JSON.stringify(settingsData || {}));
        }

        const uniqueCategories = [
          ...new Set((productsData.products || []).map((p: Product) => p.category?.name).filter(Boolean)),
        ];
        const cats = (uniqueCategories as string[]).sort((a, b) => a.localeCompare(b));
        setCategories(cats);
        setSelectedCategory((prev) => (prev && cats.includes(prev) ? prev : ''));
      } catch (error) {
        try {
          const cachedProducts = JSON.parse(localStorage.getItem('meka_cache_products_v1') || '[]');
          const cachedCustomers = JSON.parse(localStorage.getItem('meka_cache_customers_v1') || '[]');
          const cachedSettings = JSON.parse(localStorage.getItem('meka_cache_settings_v1') || '{}');
          if (Array.isArray(cachedProducts)) setProducts(cachedProducts);
          if (Array.isArray(cachedCustomers)) setCustomers(cachedCustomers);
          if (cachedSettings && typeof cachedSettings === 'object') setStoreSettings(cachedSettings);
          const uniqueCategories = [
            ...new Set((cachedProducts || []).map((p: Product) => (p as any)?.category?.name).filter(Boolean)),
          ];
          const cats = (uniqueCategories as string[]).sort((a, b) => a.localeCompare(b));
          setCategories(cats);
          setSelectedCategory((prev) => (prev && cats.includes(prev) ? prev : ''));
        } catch {
        }
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
      const matchesCategory = searchQuery ? true : !selectedCategory || product.category.name === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const vatMode = useMemo<'INCLUSIVE' | 'EXCLUSIVE'>(() => {
    return storeSettings?.vatMode === 'EXCLUSIVE' ? 'EXCLUSIVE' : 'INCLUSIVE';
  }, [storeSettings?.vatMode]);

  const taxRate = useMemo(() => {
    const raw = Number(storeSettings?.taxRate);
    if (Number.isFinite(raw) && raw > 0) {
      return raw > 1 ? raw / 100 : raw;
    }
    return 0.075;
  }, [storeSettings?.taxRate]);

  const markupPercent = useMemo(() => {
    const raw = Number(storeSettings?.markupPercent);
    if (Number.isFinite(raw) && raw >= 0) return raw;
    return 5;
  }, [storeSettings?.markupPercent]);

  const getProductPrice = (product: Product) => {
    const base = Number(product.costPrice) > 0 ? Number(product.costPrice) : Number(product.retailPrice);
    const marked = base * (1 + markupPercent / 100);
    if (!product.isTaxable) return marked;
    if (vatMode === 'INCLUSIVE') return marked * (1 + taxRate);
    return marked;
  };

  const addToCart = useCallback((product: Product) => {
    const isTaxable = product.isTaxable ?? true;
    const taxInclusive = isTaxable ? vatMode === 'INCLUSIVE' : false;
    const price = getProductPrice(product);
    const existingItem = cart.find((item) => item.productId === product.id);

    if (existingItem) {
      const totalUnitsInCart = cart.reduce((sum, item) => {
        if (item.productId === product.id) return sum + item.quantity;
        return sum;
      }, 0);

      if (totalUnitsInCart + 1 > product.stockQty) {
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
      triggerCartPulse(product.id);
    } else {
      if (product.stockQty < 1) return;

      setCart((prevCart) => [
        ...prevCart,
        {
          productId: product.id,
          name: product.name,
          quantity: 1,
          unitPrice: price,
          discount: 0,
          total: price,
          isTaxable,
          taxInclusive,
        },
      ]);
      triggerCartPulse(product.id);
    }
  }, [cart, getProductPrice, triggerCartPulse, vatMode]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.isContentEditable ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT')
    ) {
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setCart([]);
      setSuccessMessage('Cart cleared');
      setTimeout(() => setSuccessMessage(null), 1200);
      return;
    }

    if (e.key === 'F2') {
      e.preventDefault();
      customerLookupRef.current?.focus();
      return;
    }

    if (e.key === 'F4') {
      e.preventDefault();
      if (cart.length === 0) return;
      try {
        const payload = {
          heldAt: new Date().toISOString(),
          customerId: selectedCustomer?.id ?? null,
          cart,
        };
        localStorage.setItem(HELD_BILL_KEY, JSON.stringify(payload));
        setHeldBillCount(cart.length);
        setCart([]);
        setSelectedCustomer(null);
        setSuccessMessage('Bill held');
        setTimeout(() => setSuccessMessage(null), 1800);
      } catch {
        setSuccessMessage('Failed to hold bill');
        setTimeout(() => setSuccessMessage(null), 1800);
      }
      return;
    }

    if (e.key === ' ' || e.code === 'Space') {
      if (cart.length > 0) {
        e.preventDefault();
        setPaymentMethod('CASH');
        setShowPaymentModal(true);
      }
      return;
    }

    const currentTime = e.timeStamp;

    if (currentTime - lastScanTime > 80) {
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
        setSearchQuery('');
      }
    } else if (e.key.length === 1 && /^[0-9A-Za-z]$/.test(e.key)) {
      setSelectedCategory('');
      setBarcodeBuffer(prev => {
        const next = prev + e.key;
        setSearchQuery(next);
        return next;
      });
    }

    setLastScanTime(currentTime);
  }, [addToCart, barcodeBuffer, cart, lastScanTime, products, selectedCustomer]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const refreshHeldBillCount = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(HELD_BILL_KEY);
      if (!raw) {
        setHeldBillCount(0);
        return;
      }
      const parsed = JSON.parse(raw);
      setHeldBillCount(Array.isArray(parsed?.cart) ? parsed.cart.length : 0);
    } catch {
      setHeldBillCount(0);
    }
  }, [HELD_BILL_KEY]);

  useEffect(() => {
    refreshHeldBillCount();
  }, [refreshHeldBillCount]);

  const holdBill = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (cart.length === 0) return;
    try {
      const payload = {
        heldAt: new Date().toISOString(),
        customerId: selectedCustomer?.id ?? null,
        cart,
      };
      localStorage.setItem(HELD_BILL_KEY, JSON.stringify(payload));
      setHeldBillCount(cart.length);
      setCart([]);
      setSelectedCustomer(null);
      setSuccessMessage('Bill held');
      setTimeout(() => setSuccessMessage(null), 1800);
    } catch {
      setSuccessMessage('Failed to hold bill');
      setTimeout(() => setSuccessMessage(null), 1800);
    }
  }, [HELD_BILL_KEY, cart, selectedCustomer]);

  const recallHeldBill = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(HELD_BILL_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const heldCart = Array.isArray(parsed?.cart) ? (parsed.cart as CartItem[]) : [];
      if (heldCart.length === 0) return;
      if (cart.length > 0) {
        const ok = confirm('Replace the current ticket with the held ticket?');
        if (!ok) return;
      }
      setCart(heldCart);
      const customerId = parsed?.customerId as string | null | undefined;
      if (customerId) {
        const c = customers.find((x) => x.id === customerId) || null;
        setSelectedCustomer(c);
      } else {
        setSelectedCustomer(null);
      }
      try {
        localStorage.removeItem(HELD_BILL_KEY);
      } catch {}
      setHeldBillCount(0);
      setSuccessMessage('Held ticket loaded');
      setTimeout(() => setSuccessMessage(null), 1800);
    } catch {
      setSuccessMessage('Failed to load held ticket');
      setTimeout(() => setSuccessMessage(null), 1800);
    }
  }, [HELD_BILL_KEY, cart.length, customers]);

  const quickAddFirst = useCallback(() => {
    const candidate = filteredProducts[0];
    if (!candidate) return;
    addToCart(candidate);
    setSearchQuery('');
  }, [addToCart, filteredProducts]);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.productId !== productId));
    triggerCartPulse(productId);
  }, [triggerCartPulse]);

  const updateCartItem = useCallback((productId: string, quantity: number, discount: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (quantity > product.stockQty) return;

    if (quantity <= 0) {
      setCart((prevCart) => prevCart.filter((item) => item.productId !== productId));
      triggerCartPulse(productId);
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
    triggerCartPulse(productId);
  }, [products, triggerCartPulse]);

  // Subtotal = sum of item totals as-stated (inclusive or exclusive)
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);

  const taxBreakdown = cart.reduce(
    (acc, item) => {
      if (!item.isTaxable) return acc;
      if (vatMode === 'INCLUSIVE') {
        const embedded = item.total * taxRate / (1 + taxRate);
        return { ...acc, inclusive: acc.inclusive + embedded };
      }
      const added = item.total * taxRate;
      return { ...acc, exclusive: acc.exclusive + added };
    },
    { exclusive: 0, inclusive: 0 }
  );

  const tax = vatMode === 'EXCLUSIVE' ? taxBreakdown.exclusive : 0;
  const total = subtotal + tax;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (isCheckingOut) return;
    setIsCheckingOut(true);

    const clientSaleId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : null;

    if (!clientSaleId) {
      setSuccessMessage('This device cannot generate a sale ID (crypto.randomUUID unavailable).');
      setTimeout(() => setSuccessMessage(null), 4000);
      setIsCheckingOut(false);
      return;
    }

    const payload = {
      clientSaleId,
      customerId: selectedCustomer?.id || undefined,
      paymentMethod,
      notes:
        paymentMethod === 'SPLIT'
          ? `Cash: ${splitAmounts.cash}, Card: ${splitAmounts.card}, Transfer: ${splitAmounts.transfer}, Mobile: ${splitAmounts.mobile}`
          : undefined,
      items: cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
      })),
      discount: 0,
    };

    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        // Use actual API response so receipt has real sale ID and server-computed totals
        const savedSale = await response.json();
        const completedSale = {
          id: savedSale.id,
          clientSaleId,
          customerId: selectedCustomer?.id || '',
          customerName: selectedCustomer?.name || 'Walk-In Customer',
          customerType: 'RETAIL',
          paymentMethod,
          notes: savedSale?.notes ?? payload.notes,
          items: cart.map((item) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            total: item.total,
            isTaxable: item.isTaxable,
            taxInclusive: item.taxInclusive,
          })),
          subtotal: typeof savedSale?.subtotal === 'number' ? savedSale.subtotal : subtotal,
          tax: typeof savedSale?.tax === 'number' ? savedSale.tax : tax,
          taxInclusive: taxBreakdown.inclusive,
          total: typeof savedSale?.total === 'number' ? savedSale.total : total,
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

      const queue = loadOfflineSales();
      saveOfflineSales([
        ...queue,
        { clientSaleId, createdAt: new Date().toISOString(), payload },
      ]);

      const completedSale = {
        id: clientSaleId,
        clientSaleId,
        customerId: selectedCustomer?.id || '',
        customerName: selectedCustomer?.name || 'Walk-In Customer',
        customerType: 'RETAIL',
        paymentMethod,
        notes: payload.notes,
        items: cart.map((item) => ({
          productId: item.productId,
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
        date: new Date().toISOString(),
        offline: true,
      };

      setLastSale(completedSale);
      setLastCompletedSale(completedSale);
      setSuccessMessage('Offline: sale saved and will sync when internet returns');
      setCart([]);
      setSelectedCustomer(null);
      setShowPaymentModal(false);
      printReceipt(completedSale);
      setTimeout(() => setSuccessMessage(null), 5000);
    } finally {
      setIsCheckingOut(false);
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
          ...(customerForm.phone ? { phone: customerForm.phone } : {}),
          ...(customerForm.email ? { email: customerForm.email } : {}),
        }),
      });
      if (res.ok) {
        const newCustomer = await res.json();
        setCustomers(prev => [...prev, newCustomer].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedCustomer(newCustomer);
        setShowAddCustomerModal(false);
        setCustomerForm({ name: '', phone: '', email: '' });
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
    setSuccessMessage('Reprinting…');
    printReceipt(lastCompletedSale);
  };

  const handleRaiseReturn = async () => {
    if (isSubmittingReturn) return;
    const role = (session?.user as any)?.role as string | undefined;
    if (!role || !['CASHIER', 'OWNER', 'ADMIN'].includes(role)) {
      setSuccessMessage('Unauthorized.');
      setTimeout(() => setSuccessMessage(null), 2500);
      return;
    }
    const reason = returnReason.trim();
    if (reason.length < 3) return;

    setIsSubmittingReturn(true);
    try {
      let saleId: string | null = null;
      let itemsPayload: Array<{ productId: string; qty: number }> | undefined;

      if (returnSource === 'LAST') {
        if (!lastCompletedSale?.id || lastCompletedSale?.offline) {
          setSuccessMessage('Last sale is offline or unavailable. Use receipt lookup instead.');
          setTimeout(() => setSuccessMessage(null), 3000);
          return;
        }
        saleId = String(lastCompletedSale.id);
        const selected = returnItems.filter((x) => x.selected && x.qty > 0);
        if (selected.length === 0) {
          setSuccessMessage('Select at least one item to return.');
          setTimeout(() => setSuccessMessage(null), 2500);
          return;
        }
        itemsPayload = selected.map((x) => ({ productId: x.productId, qty: x.qty }));
      } else {
        const lookup = returnLookup.trim();
        if (lookup.length < 3) return;

        const salesRes = await fetch(`/api/sales?limit=10&page=1&q=${encodeURIComponent(lookup)}`);
        if (!salesRes.ok) {
          const err = await salesRes.json().catch(() => ({}));
          throw new Error(err?.error || 'Failed to lookup sale');
        }
        const salesData = await salesRes.json().catch(() => ({}));
        const sales = Array.isArray(salesData?.sales) ? salesData.sales : [];
        const sale = sales[0];
        if (!sale?.id) {
          setSuccessMessage('Sale not found for that receipt number.');
          setTimeout(() => setSuccessMessage(null), 2500);
          return;
        }
        saleId = String(sale.id);
      }

      const returnRes = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleId, reason, ...(itemsPayload ? { items: itemsPayload } : {}) }),
      });
      if (!returnRes.ok) {
        const err = await returnRes.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to raise return');
      }

      setShowReturnModal(false);
      setReturnLookup('');
      setReturnReason('');
      setReturnItems([]);
      setSuccessMessage(role === 'CASHIER' ? 'Return request raised. Waiting for Owner/Admin approval.' : 'Return completed.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e: any) {
      setSuccessMessage(e?.message || 'Failed to raise return');
      setTimeout(() => setSuccessMessage(null), 3000);
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  const computeInclusiveVat = (items: Array<{ total: number; isTaxable: boolean; taxInclusive: boolean }>) => {
    return items.reduce((acc, item) => {
      if (!item.isTaxable) return acc;
      if (!item.taxInclusive) return acc;
      return acc + (Number(item.total) || 0) * taxRate / (1 + taxRate);
    }, 0);
  };

  const formatDateTimeShort = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-NG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const openHistory = async () => {
    setShowHistoryModal(true);
    setHistoryError(null);
    setHistoryQuery('');
    setHistorySales([]);
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/sales?limit=50&page=1');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setHistorySales(Array.isArray(data?.sales) ? data.sales : []);
    } catch (e: any) {
      setHistoryError(e?.message || 'Failed to load transactions');
    } finally {
      setHistoryLoading(false);
    }
  };

  const refreshHistory = async (q?: string) => {
    if (historyLoading) return;
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      params.set('page', '1');
      const query = typeof q === 'string' ? q.trim() : historyQuery.trim();
      if (query) params.set('q', query);
      const res = await fetch(`/api/sales?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setHistorySales(Array.isArray(data?.sales) ? data.sales : []);
    } catch (e: any) {
      setHistoryError(e?.message || 'Failed to load transactions');
    } finally {
      setHistoryLoading(false);
    }
  };

  const reprintFromHistory = async (saleRow: any) => {
    if (!saleRow?.id) return;
    if (historyReprintingId) return;
    setHistoryReprintingId(String(saleRow.id));
    try {
      const items = Array.isArray(saleRow.items) ? saleRow.items : [];
      const receiptItems = items.map((it: any) => ({
        productId: String(it.productId),
        name: String(it.product?.name ?? 'Item'),
        quantity: Number(it.qty) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        discount: Number(it.discount) || 0,
        total: Number(it.total) || 0,
        isTaxable: Boolean(it.product?.isTaxable ?? true),
        taxInclusive: Boolean(it.product?.taxInclusive ?? false),
      }));
      const saleForReceipt = {
        id: String(saleRow.id),
        clientSaleId: saleRow.clientSaleId ?? undefined,
        customerName: saleRow.customer?.name ?? 'Walk-In Customer',
        paymentMethod: saleRow.paymentMethod,
        notes: saleRow.notes ?? undefined,
        items: receiptItems,
        subtotal: Number(saleRow.subtotal) || 0,
        tax: Number(saleRow.tax) || 0,
        taxInclusive: computeInclusiveVat(receiptItems),
        total: Number(saleRow.total) || 0,
        date: saleRow.createdAt ?? new Date().toISOString(),
      };
      await printReceipt(saleForReceipt);
    } finally {
      setTimeout(() => setHistoryReprintingId(null), 800);
    }
  };


  // ── Print via main-window overlay ────────────────────────────────────────
  // window.print() on the main window is what --kiosk-printing was built for.
  // We inject the receipt into a hidden div, use @media print CSS to make only
  // that div visible, call window.print(), then clean up.
  const printViaIframe = (html: string) => {
    // Prevent double-prints — guard lives on window to survive re-renders
    if ((window as any).__mekaPrinting || printingRef.current) {
      console.log('[Rosella Stores] Print already in progress — skipping duplicate.');
      return;
    }
    (window as any).__mekaPrinting = true;
    printingRef.current = true;

    // Strip any old auto-print scripts embedded in the HTML
    const cleanHtml = html.replace(/<script[\s\S]*?<\/script>/gi, '');

    // Parse out the receipt's <style> and <body> separately
    const parser   = new DOMParser();
    const parsed   = parser.parseFromString(cleanHtml, 'text/html');
    const rcptCSS  = parsed.querySelector('style')?.innerHTML ?? '';
    const rcptBody = parsed.body.innerHTML;

    // Remove any leftover overlay from a previous (unclean) print
    document.getElementById('__meka_receipt__')?.remove();
    document.getElementById('__meka_receipt_style__')?.remove();

    // Inject receipt content as a hidden overlay div
    const overlay = document.createElement('div');
    overlay.id = '__meka_receipt__';
    overlay.innerHTML = rcptBody;
    // Off-screen but in layout (avoids display:none → display:block flash)
    overlay.style.cssText = 'position:fixed;top:-99999px;left:-99999px;width:74mm;';
    document.body.appendChild(overlay);

    const pxToMm = (px: number) => (px * 25.4) / 96;
    const measuredHeightMm = pxToMm(overlay.scrollHeight || 0);
    const pageHeightMm = Math.min(Math.max(Math.ceil(measuredHeightMm + 12), 60), 600);

    // Inject print styles:
    //  - "body * { visibility:hidden }" hides EVERYTHING in the app
    //  - then we make only #__meka_receipt__ and its children visible
    //  - @page sets 80mm thermal paper size
    //  - print-color-adjust:exact ensures full black — no ink-saving filters
    const styleTag = document.createElement('style');
    styleTag.id = '__meka_receipt_style__';
    styleTag.innerHTML = `
      @page { size: 80mm ${pageHeightMm}mm; margin: 2mm 3mm; }
      @media print {
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        html, body { margin: 0 !important; padding: 0 !important; height: auto !important; width: 80mm !important; }
        body > :not(#__meka_receipt__) { display: none !important; }
        #__meka_receipt__ {
          display: block !important;
          position: static !important;
          width: 74mm !important;
          background: #fff !important;
          page-break-after: avoid !important;
        }
        #__meka_receipt__ * { color: #000 !important; }
        ${rcptCSS}
      }
    `;
    document.head.appendChild(styleTag);

    // afterprint fires when kiosk job is sent / dialog is closed — most reliable reset
    const releaseLock = () => {
      document.getElementById('__meka_receipt__')?.remove();
      document.getElementById('__meka_receipt_style__')?.remove();
      printingRef.current = false;
      (window as any).__mekaPrinting = false;
      console.log('[Rosella Stores] Print overlay cleaned up.');
    };
    window.addEventListener('afterprint', releaseLock, { once: true });
    setTimeout(() => releaseLock(), 8000); // safety fallback

    // Small delay so React finishes any pending renders before we print
    setTimeout(() => {
      console.log('[Rosella Stores] Sending receipt to printer…');
      window.print();
    }, 250);
  };

  /**
   * Main print dispatcher.
   * 1. If a thermal printer is configured, tries QZ Tray for silent printing.
   * 2. Falls back to iframe printing (shows browser print dialog) on any error.
   */
  const printDoc = async (html: string) => {
    if (thermalPrinter) {
      try {
        console.log(`[Rosella Stores] Attempting QZ Tray print to "${thermalPrinter}"…`);
        await printHTMLWithQZ(html, thermalPrinter);
        console.log('[Rosella Stores] QZ Tray print successful.');
        return; // Skip fallback if successful
      } catch (err: any) {
        console.warn('[Rosella Stores] QZ Tray print failed, falling back to browser print:', err);
        setSuccessMessage(`QZ Print failed: ${err.message}. Falling back to browser print.`);
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    }
    // Uses browser iframe print — silent when Chrome is launched with --kiosk-printing flag
    printViaIframe(html);
  };

  const printReceipt = async (saleData?: any) => {
    const sale = saleData || lastSale;
    if (!sale) return;

    const receiptSuffixSource = String(sale.id || sale.clientSaleId || '');
    const receiptSuffix = receiptSuffixSource ? receiptSuffixSource.slice(-8).toUpperCase() : 'NA';
    const receiptNo = `R-${receiptSuffix}`;
    const dateObj    = new Date(sale.date);
    const dateStr    = dateObj.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr    = dateObj.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
    const biz        = storeSettings.businessName || 'ROSELLA STORES';
    const cashier    = (session?.user as any)?.name || 'Staff';
    const badgeLabel = sale.offline ? '&#9733; OFFLINE SALE &#9733;' : '&#9733; SALES RECEIPT &#9733;';

    const payLabel: Record<string, string> = {
      CASH: 'Cash', CARD: 'Card / POS', BANK_TRANSFER: 'Bank Transfer',
      MOBILE_MONEY: 'Mobile Money', SPLIT: 'Split Payment',
    };

    const grossSubtotal = sale.items.reduce((acc: number, item: any) => {
      const qty = Number(item.quantity) || 0;
      const unit = Number(item.unitPrice) || 0;
      return acc + qty * unit;
    }, 0);
    const discountTotal = sale.items.reduce((acc: number, item: any) => acc + (Number(item.discount) || 0), 0);

    const splitParts =
      sale.paymentMethod === 'SPLIT' && typeof sale.notes === 'string'
        ? (() => {
            const m = sale.notes.match(/Cash:\s*([\d.]+),\s*Card:\s*([\d.]+),\s*Transfer:\s*([\d.]+),\s*Mobile:\s*([\d.]+)/i);
            if (!m) return null;
            const toMoney = (s: string) => formatCurrency(Number(s) || 0);
            return {
              cash: toMoney(m[1]),
              card: toMoney(m[2]),
              transfer: toMoney(m[3]),
              mobile: toMoney(m[4]),
            };
          })()
        : null;

    const itemRows = sale.items.map((item: any) => {
      const name     = String(item.name || '').trim();
      const unitP    = formatCurrency(item.unitPrice);
      const tot      = formatCurrency(item.total);
      const disc     = Number(item.discount) > 0 ? `<div style="font-size:9px;color:#444;font-weight:600">Disc: -${formatCurrency(item.discount)}</div>` : '';
      return `
        <tr>
          <td style="padding:2px 0 1px;vertical-align:top">
            <div style="font-weight:800;font-size:12px;word-break:break-word">${name}</div>
            <div style="font-size:10.5px;color:#444;font-weight:700">${item.quantity} × ${unitP}</div>
            ${disc}
          </td>
          <td style="text-align:right;vertical-align:top;padding:2px 0 1px;font-size:12px;font-weight:800;white-space:nowrap">${tot}</td>
        </tr>`;
    }).join('');

    const discountHtml = discountTotal > 0
      ? `<tr><td style="font-size:10px;color:#333;padding:1px 0;font-weight:600">Discount</td><td style="text-align:right;font-size:10px;padding:1px 0;font-weight:600">-${formatCurrency(discountTotal)}</td></tr>`
      : '';

    const splitHtml = splitParts
      ? `
        <tr><td style="font-size:10px;color:#333;padding:1px 0;font-weight:600">Split: Cash</td><td style="text-align:right;font-size:10px;padding:1px 0;font-weight:600">${splitParts.cash}</td></tr>
        <tr><td style="font-size:10px;color:#333;padding:1px 0;font-weight:600">Split: Card</td><td style="text-align:right;font-size:10px;padding:1px 0;font-weight:600">${splitParts.card}</td></tr>
        <tr><td style="font-size:10px;color:#333;padding:1px 0;font-weight:600">Split: Transfer</td><td style="text-align:right;font-size:10px;padding:1px 0;font-weight:600">${splitParts.transfer}</td></tr>
        <tr><td style="font-size:10px;color:#333;padding:1px 0;font-weight:600">Split: Mobile</td><td style="text-align:right;font-size:10px;padding:1px 0;font-weight:600">${splitParts.mobile}</td></tr>
      `
      : '';

    const receiptHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt ${receiptNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      font-weight: 700;
      line-height: 1.45;
      width: 74mm;
      color: #000;
      background: #fff;
    }
    td { word-break: break-word; }
    table { width: 100%; border-collapse: collapse; }
    img { max-width: 100%; height: auto; }
    .logo { display: flex; justify-content: center; margin-bottom: 4px; }
    .logo img { max-height: 18mm; object-fit: contain; }
    .biz-name {
      font-size: 17px; font-weight: 900; letter-spacing: 1.5px;
      text-align: center; text-transform: uppercase; margin-bottom: 2px;
    }
    .biz-info { font-size: 10.5px; font-weight: 700; text-align: center; line-height: 1.6; color: #222; }
    .dash  { border: none; border-top: 1px dashed #000; margin: 3px 0; }
    .solid { border: none; border-top: 2px solid  #000; margin: 3px 0; }
    .badge {
      font-size: 11px; font-weight: 900; letter-spacing: 3px;
      text-align: center; padding: 2px 0;
    }
    .meta td { font-size: 11px; font-weight: 700; padding: 1px 0; }
    .meta td:last-child { text-align: right; font-weight: 800; }
    .col-hdr {
      font-size: 10px; font-weight: 900; letter-spacing: 1px;
      border-top: 1px solid #000; border-bottom: 1px solid #000;
      padding: 2px 0;
    }
    .col-hdr td:last-child { text-align: right; }
    .totals td { padding: 1px 0; font-size: 11.5px; font-weight: 800; }
    .totals td:last-child { text-align: right; }
    .grand td { font-size: 14px; font-weight: 900; padding: 2px 0; }
    .grand td:last-child { text-align: right; }
    .footer { text-align: center; font-size: 10.5px; font-weight: 700; color: #222; line-height: 1.7; margin-top: 3px; }
    .rcpt-id { text-align: center; font-size: 10px; font-weight: 700; letter-spacing: 1px; margin-top: 2px; color: #444; }
  </style>
</head>
<body>

${storeSettings.businessLogo ? `<div class="logo"><img src="${storeSettings.businessLogo}" alt="${biz}"/></div>` : ''}
<div class="biz-name">${biz}</div>
<div class="biz-info">
  ${storeSettings.businessAddress ? storeSettings.businessAddress + '<br>' : ''}
  ${storeSettings.businessPhone   ? 'Tel: ' + storeSettings.businessPhone : ''}
  ${storeSettings.businessEmail   ? '<br>' + storeSettings.businessEmail : ''}
</div>

<hr class="solid">
<div class="badge">${badgeLabel}</div>
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
  <tr><td>Gross</td><td>${formatCurrency(grossSubtotal)}</td></tr>
  ${discountHtml}
  <tr><td>Subtotal</td><td>${formatCurrency(sale.subtotal)}</td></tr>
  ${splitHtml}
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

  const generateInvoice = () => {
    if (!lastSale) return;

    const dateObj   = new Date(lastSale.date);
    const dateStr   = dateObj.toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' });
    const suffixSource = String(lastSale.id || lastSale.clientSaleId || '');
    const suffix = suffixSource ? suffixSource.slice(-5).toUpperCase() : '00000';
    const invoiceNo = `INV-${dateObj.getFullYear()}${String(dateObj.getMonth() + 1).padStart(2, '0')}${String(dateObj.getDate()).padStart(2, '0')}-${suffix}`;
    const biz       = storeSettings.businessName || 'Rosella Stores';
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
    doc.text('Retail Customer', M, y + 14);

    // ── Items table ───────────────────────────────────────────────────
    y = 84;
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [['#', 'Item Description', 'Qty', 'Unit Price', 'Total']],
      body: lastSale.items.map((item: any, i: number) => [
        String(i + 1),
        item.name,
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
        2: { cellWidth: 12, halign: 'center' },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
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

  const toastTone = (() => {
    const msg = (successMessage ?? '').toLowerCase();
    if (msg.includes('failed') || msg.includes('error')) return 'error';
    if (msg.includes('offline') || msg.includes('scanned')) return 'info';
    if (lastSale) return 'success';
    return 'info';
  })();

  return (
    <div className="min-h-[calc(100vh-64px)] h-[calc(100dvh-64px)] overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-foreground transition-all duration-300 relative flex flex-col">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_55%),radial-gradient(circle_at_bottom,rgba(16,185,129,0.18),transparent_55%)]" />
      <div className="h-14 md:h-16 px-4 md:px-6 bg-gradient-to-b from-slate-950 to-slate-900 text-white flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <p className="font-black tracking-tight text-sm md:text-base truncate">
                {storeSettings?.businessName || 'Rosella Stores POS'}
              </p>
              <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-white/80">
                <Layers className="w-3 h-3" />
                Terminal
              </span>
            </div>
            <p className="text-[10px] text-white/60 font-semibold truncate">
              {session?.user?.name ? `${session.user.name} • ${session.user.role}` : 'Signed in'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-bold text-white/90">Scanner Active</span>
          </div>

          <div
            className={[
              'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold',
              isOnline ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200' : 'bg-red-500/10 border-red-500/25 text-red-200',
            ].join(' ')}
            title={isOnline ? 'Terminal Online' : 'Terminal Offline'}
          >
            <Wifi className="w-4 h-4" />
            <span className="hidden md:inline">{isOnline ? 'Online' : 'Offline'}</span>
            {pendingSalesCount > 0 && <span className="text-white/80">• {pendingSalesCount}</span>}
          </div>

          <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
            <Clock className="w-4 h-4 text-white/70" />
            <div className="leading-none">
              <p className="text-xs font-black">{now.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</p>
              <p className="text-[10px] text-white/60 font-semibold">
                {now.toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className={`flex-col p-4 md:p-6 space-y-4 md:space-y-5 overflow-hidden flex-1 ${showMobileCart ? 'hidden md:flex' : 'flex'}`}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,340px] gap-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Scan barcode or type product name/SKU... (Press Enter to quick-add)"
                  value={searchQuery}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSearchQuery(next);
                    if (next.trim()) setSelectedCategory('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      quickAddFirst();
                    }
                  }}
                  className="input-base pl-10 h-12 bg-card/70 backdrop-blur-xl text-sm md:text-base border border-white/10"
                  autoFocus
                  data-testid="pos-search"
                />
              </div>
              <button
                onClick={quickAddFirst}
                disabled={filteredProducts.length === 0}
                className="h-12 px-4 rounded-xl font-black text-xs bg-emerald-600/90 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:grayscale whitespace-nowrap shadow-lg shadow-emerald-500/20"
                title="Quick add first match (Enter)"
              >
                ADD [ENTER]
              </button>
            </div>

            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                ref={customerLookupRef}
                value={customerLookup}
                onChange={(e) => setCustomerLookup(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const q = customerLookup.trim().toLowerCase();
                    if (!q) return;
                    const hit = customers.find((c) => c.name.toLowerCase().includes(q)) || null;
                    setSelectedCustomer(hit);
                    setCustomerLookup('');
                  }
                }}
                className="input-base pl-10 h-12 bg-card/70 backdrop-blur-xl text-sm md:text-base border border-white/10"
                placeholder="Customer phone / name (Enter to select)"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-4 py-2 rounded-xl border text-xs md:text-sm font-bold whitespace-nowrap transition-all ${
                !selectedCategory
                  ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20'
                  : 'bg-card/60 backdrop-blur-xl text-muted-foreground hover:bg-muted border-white/10'
              }`}
            >
              All Items
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-xl border text-xs md:text-sm font-bold whitespace-nowrap transition-all ${
                  selectedCategory === category
                    ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20'
                    : 'bg-card/60 backdrop-blur-xl text-muted-foreground hover:bg-muted border-white/10'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 flex-1 overflow-y-auto pr-2 content-start">
            {filteredProducts.map((product) => {
              const stockLabel =
                product.stockQty === 0 ? 'Out of stock' : `${product.stockQty} left`;
              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={product.stockQty === 0}
                  className="card-premium p-3 flex flex-col text-left group relative disabled:opacity-40 hover:border-primary/60 transition-all min-h-[150px] bg-card/60 backdrop-blur-xl border border-white/10"
                  data-testid={`pos-product-${product.sku}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-muted/60 border border-border flex items-center justify-center text-xs font-black text-muted-foreground shrink-0 overflow-hidden">
                        {product.imageUrl ? (
                          <Image src={product.imageUrl} alt={product.name} width={40} height={40} className="w-full h-full object-cover" />
                        ) : (
                          <span>{(product.name || '?').slice(0, 1).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-[15px] leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
                          {product.name}
                        </h4>
                        <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide truncate">
                          {product.sku}
                        </p>
                      </div>
                    </div>
                    <span
                      className={[
                        'text-[10px] font-black px-2 py-1 rounded-full border leading-none whitespace-nowrap',
                        product.stockQty === 0
                          ? 'bg-red-500/10 border-red-500/20 text-red-600'
                          : product.stockQty < 10
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-700'
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700',
                      ].join(' ')}
                      title={stockLabel}
                    >
                      {product.stockQty === 0 ? 'OUT' : `${product.stockQty} left`}
                    </span>
                  </div>

                  <div className="mt-auto pt-3 flex items-end justify-between border-t border-border/50">
                    <p className="font-black text-sm text-primary leading-none">
                      {formatCurrency(getProductPrice(product))}
                    </p>
                    <p className="text-[10px] font-bold text-muted-foreground">
                      {product.category?.name || 'General'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      {/* Cart Section — full-screen on mobile when active, fixed panel on desktop */}
      <div
        className={[
          'bg-card/70 backdrop-blur-xl border-l border-white/10 flex-col shadow-2xl z-10 w-full md:w-[420px]',
          'fixed inset-y-0 right-0 md:static md:translate-x-0 md:flex',
          'transform transition-transform duration-300 ease-out',
          showMobileCart ? 'translate-x-0 flex' : 'translate-x-full pointer-events-none md:pointer-events-auto md:translate-x-0 md:flex',
        ].join(' ')}
        data-testid="pos-cart-panel"
      >
        <div className="p-4 md:p-6 border-b space-y-4 bg-card/60">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xl flex items-center gap-2">
              {/* Back button — mobile only */}
              <button
                onClick={() => setShowMobileCart(false)}
                className="md:hidden p-1 -ml-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <ShoppingCart className={`w-5 h-5 text-primary ${cartPulse ? 'animate-cart-bump' : ''}`} />
              Current Ticket
            </h3>
            <div className="flex items-center gap-2">
              {heldBillCount > 0 && (
                <button
                  onClick={recallHeldBill}
                  className="px-3 py-2 rounded-xl bg-muted/40 hover:bg-muted transition-colors text-xs font-black text-muted-foreground"
                  title="Load held ticket"
                >
                  Held ({heldBillCount})
                </button>
              )}
              <button
                onClick={() => setCart([])}
                className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                aria-label="Clear cart"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="relative group flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <select
                value={selectedCustomer?.id || ''}
                onChange={(e) => {
                  const customer = customers.find((c) => c.id === e.target.value);
                  setSelectedCustomer(customer || null);
                }}
                className="input-base pl-10 appearance-none bg-muted/50 border-none cursor-pointer"
              >
                <option value="">Guest Customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
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
            cart.map((item) => {
              return (
                <div
                  key={item.productId}
                  className={[
                    'bg-card p-4 rounded-xl border shadow-sm group animate-slide-up',
                    pulseItemId === item.productId ? 'animate-cart-flash' : '',
                  ].join(' ')}
                  data-testid={`pos-cart-item-${item.productId}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 pr-4">
                      <p className="font-black text-[15px] leading-snug line-clamp-2">{item.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-muted-foreground">{formatCurrency(item.unitPrice)} / unit</p>
                      </div>
                    </div>
                    <p className="font-bold text-sm text-primary">{formatCurrency(item.total)}</p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                      <button 
                        onClick={() => updateCartItem(item.productId, item.quantity - 1, item.discount)}
                        className="p-1 hover:bg-card rounded-md transition-colors"
                        aria-label={`Decrease quantity for ${item.name}`}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center text-xs font-bold leading-none" data-testid={`pos-cart-qty-${item.productId}`}>{item.quantity}</span>
                      <button 
                        onClick={() => updateCartItem(item.productId, item.quantity + 1, item.discount)}
                        className="p-1 hover:bg-card rounded-md transition-colors"
                        aria-label={`Increase quantity for ${item.name}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button 
                      onClick={() => removeFromCart(item.productId)}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors font-medium"
                      aria-label={`Remove ${item.name}`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-6 bg-card border-t shadow-inner space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-medium text-foreground">{formatCurrency(subtotal)}</span>
            </div>

            <div className="flex justify-between items-end pt-2 border-t">
              <span className="text-base font-bold text-muted-foreground">Grand Total</span>
              <span className={`text-3xl font-black text-primary tracking-tighter ${cartPulse ? 'animate-cart-bump' : ''}`} data-testid="pos-total">
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

            {/* Printer status indicator + reprint */}
            <div className="col-span-2 flex items-center gap-2">
              <div
                title="Printing via browser — open POS with the kiosk shortcut for silent auto-print"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-green-500/60 bg-green-500/10 text-green-600 text-xs font-medium shrink-0"
              >
                <Printer className="w-3.5 h-3.5 shrink-0" />
                <span>Auto Print</span>
              </div>
              <div
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium shrink-0 ${
                  isOnline ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700' : 'border-red-500/60 bg-red-500/10 text-red-700'
                }`}
              >
                <span className="font-bold">{isOnline ? 'Online' : 'Offline'}</span>
                {pendingSalesCount > 0 && (
                  <span className="font-bold">• {pendingSalesCount} pending</span>
                )}
              </div>
              {pendingSalesCount > 0 && (
                <button
                  onClick={syncOfflineSales}
                  disabled={!isOnline || syncingPendingSales}
                  className="flex-1 text-xs text-muted-foreground hover:text-primary border border-dashed border-border hover:border-primary/50 rounded-xl py-2 transition-all flex items-center justify-center gap-1.5 font-medium disabled:opacity-50"
                >
                  {syncingPendingSales ? 'Syncing…' : 'Sync Pending'}
                </button>
              )}
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
              onClick={holdBill}
              disabled={cart.length === 0}
              className="col-span-1 bg-muted text-foreground h-14 rounded-xl font-black text-sm hover:bg-muted/70 transition-colors disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
              title="Hold ticket (F4)"
            >
              Hold Bill [F4]
            </button>
            <button
              onClick={() => setShowPaymentModal(true)}
              disabled={cart.length === 0}
              className="col-span-1 bg-primary text-primary-foreground h-14 rounded-xl font-black text-sm shadow-lg shadow-primary/30 hover:shadow-primary/40 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:grayscale disabled:shadow-none flex items-center justify-center gap-2"
              data-testid="pos-checkout"
              title="Payment (Space)"
            >
              <CheckCircle className="w-5 h-5" />
              Payment [Space]
            </button>
            {['CASHIER', 'OWNER', 'ADMIN'].includes((session?.user as any)?.role ?? '') && (
              <button
                onClick={() => {
                  const canUseLast =
                    !!lastCompletedSale?.id &&
                    !lastCompletedSale?.offline &&
                    Array.isArray(lastCompletedSale?.items) &&
                    lastCompletedSale.items.some((x: any) => !!x?.productId);
                  const source: 'LAST' | 'RECEIPT' = canUseLast ? 'LAST' : 'RECEIPT';
                  setReturnSource(source);
                  setShowReturnModal(true);
                  setReturnLookup('');
                  setReturnReason('');
                  if (source === 'LAST') {
                    setReturnItems(
                      (lastCompletedSale.items || []).map((x: any) => ({
                        productId: String(x.productId),
                        name: String(x.name || 'Item'),
                        maxQty: Number(x.quantity) || 1,
                        qty: Number(x.quantity) || 1,
                        selected: true,
                      }))
                    );
                  } else {
                    setReturnItems([]);
                  }
                }}
                className="col-span-2 bg-amber-500/15 text-amber-800 h-12 rounded-xl font-black text-sm hover:bg-amber-500/20 transition-colors flex items-center justify-center gap-2"
                title="Return items"
              >
                <RotateCcw className="w-5 h-5" />
                Item Return
              </button>
            )}
            {['CASHIER', 'OWNER', 'ADMIN'].includes((session?.user as any)?.role ?? '') && (
              <button
                onClick={openHistory}
                className="col-span-2 bg-muted text-foreground h-12 rounded-xl font-black text-sm hover:bg-muted-foreground/10 transition-colors flex items-center justify-center gap-2"
                title="View transaction history"
              >
                <Clock className="w-5 h-5" />
                Transaction History
              </button>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Mobile floating cart button */}
      {!showMobileCart && (
        <button
          onClick={() => setShowMobileCart(true)}
          className={`fixed bottom-6 right-6 md:hidden z-50 flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3.5 rounded-full shadow-2xl shadow-primary/40 font-bold text-sm active:scale-95 transition-all ${cartPulse ? 'animate-cart-glow' : ''}`}
          aria-label="Open cart"
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

      <div className="hidden md:flex h-10 px-4 md:px-6 bg-slate-950 text-white border-t border-white/10 items-center justify-between text-[11px] font-bold">
        <div className="flex items-center gap-3">
          <span className="text-white/70">Space</span>
          <span className="text-white/90">Payment</span>
          <span className="text-white/40">•</span>
          <span className="text-white/70">Esc</span>
          <span className="text-white/90">Clear Cart</span>
          <span className="text-white/40">•</span>
          <span className="text-white/70">F2</span>
          <span className="text-white/90">Customer</span>
          <span className="text-white/40">•</span>
          <span className="text-white/70">F4</span>
          <span className="text-white/90">Hold</span>
        </div>
        <div className="flex items-center gap-2 text-white/70">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          Terminal {isOnline ? 'Online' : 'Offline'}
        </div>
      </div>

      {/* Transaction status overlay */}
      {successMessage && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-entrance">
          <div
            className={[
              'px-5 py-3 rounded-2xl flex items-center gap-3 shadow-2xl text-white',
              toastTone === 'success' ? 'bg-emerald-600' : toastTone === 'error' ? 'bg-destructive' : 'bg-primary',
            ].join(' ')}
          >
            {toastTone === 'success' ? (
              <CheckCircle className="w-5 h-5 shrink-0" />
            ) : toastTone === 'error' ? (
              <AlertCircle className="w-5 h-5 shrink-0" />
            ) : (
              <Info className="w-5 h-5 shrink-0" />
            )}
            <span className="font-bold tracking-tight text-sm">{successMessage}</span>
            {/* Dismiss button */}
            <button
              onClick={() => { setSuccessMessage(null); setLastSale(null); }}
              className="ml-2 p-1 rounded-full hover:bg-white/20 transition-colors shrink-0"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
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
                disabled={isCheckingOut}
                className="flex-1 h-12 rounded-xl font-bold bg-muted hover:bg-muted-foreground/10 transition-colors disabled:opacity-50"
              >
                Go Back
              </button>
              <button 
                onClick={handleCheckout} 
                disabled={
                  isCheckingOut ||
                  (paymentMethod === 'SPLIT' && Math.abs((splitAmounts.cash + splitAmounts.card + splitAmounts.transfer + splitAmounts.mobile) - total) > 0.01)
                }
                className="flex-1 bg-primary text-primary-foreground h-12 rounded-xl font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {isCheckingOut ? 'Processing…' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReturnModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-slide-up border border-white/10">
            <h2 className="text-xl font-bold tracking-tight mb-1 text-foreground">Item Return</h2>
            <p className="text-muted-foreground text-sm mb-5">Return items from the last receipt, or lookup by receipt number.</p>

            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setReturnSource('LAST')}
                  disabled={!lastCompletedSale?.id || !!lastCompletedSale?.offline}
                  className={`flex-1 h-10 rounded-xl font-black text-sm transition-colors ${
                    returnSource === 'LAST'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground hover:bg-muted-foreground/10'
                  } disabled:opacity-50`}
                >
                  Last Receipt
                </button>
                <button
                  onClick={() => setReturnSource('RECEIPT')}
                  className={`flex-1 h-10 rounded-xl font-black text-sm transition-colors ${
                    returnSource === 'RECEIPT'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground hover:bg-muted-foreground/10'
                  }`}
                >
                  Lookup Receipt
                </button>
              </div>

              {returnSource === 'RECEIPT' && (
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase">Receipt # / Sale ID</label>
                  <input
                    value={returnLookup}
                    onChange={(e) => setReturnLookup(e.target.value)}
                    className="input-base mt-1"
                    placeholder="e.g. R-1A2B3C4D"
                    autoFocus
                  />
                </div>
              )}

              {returnSource === 'LAST' && (
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase">Items</label>
                  <div className="mt-2 max-h-[240px] overflow-y-auto rounded-xl border border-border bg-muted/20 p-3 space-y-3">
                    {returnItems.length === 0 ? (
                      <div className="text-sm text-muted-foreground font-bold">No eligible last receipt found.</div>
                    ) : (
                      returnItems.map((it) => (
                        <div key={it.productId} className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={it.selected}
                            onChange={(e) => {
                              const nextSelected = e.target.checked;
                              setReturnItems((prev) =>
                                prev.map((x) =>
                                  x.productId === it.productId
                                    ? { ...x, selected: nextSelected, qty: nextSelected ? Math.min(Math.max(x.qty, 1), x.maxQty) : x.qty }
                                    : x
                                )
                              );
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-foreground truncate">{it.name}</div>
                            <div className="text-[11px] font-bold text-muted-foreground">Max: {it.maxQty}</div>
                          </div>
                          <input
                            type="number"
                            min={1}
                            max={it.maxQty}
                            value={it.qty}
                            disabled={!it.selected}
                            onChange={(e) => {
                              const raw = Number(e.target.value);
                              const nextQty = Math.min(Math.max(Number.isFinite(raw) ? raw : 1, 1), it.maxQty);
                              setReturnItems((prev) => prev.map((x) => (x.productId === it.productId ? { ...x, qty: nextQty } : x)));
                            }}
                            className="input-base w-20 py-1 px-2 text-sm"
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase">Reason</label>
                <textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="input-base mt-1 min-h-[96px]"
                  placeholder="Why is this being returned?"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowReturnModal(false); setReturnSource('RECEIPT'); setReturnLookup(''); setReturnReason(''); setReturnItems([]); }}
                className="flex-1 btn-secondary py-2 h-10"
                disabled={isSubmittingReturn}
              >
                Cancel
              </button>
              <button
                onClick={handleRaiseReturn}
                className="flex-1 btn-primary py-2 h-10 disabled:opacity-50"
                disabled={
                  isSubmittingReturn ||
                  returnReason.trim().length < 3 ||
                  (returnSource === 'RECEIPT' && returnLookup.trim().length < 3) ||
                  (returnSource === 'LAST' && !returnItems.some((x) => x.selected && x.qty > 0))
                }
              >
                {isSubmittingReturn ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-card rounded-2xl p-6 max-w-2xl w-full shadow-2xl animate-slide-up border border-white/10">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">Transaction History</h2>
                <p className="text-muted-foreground text-sm">Your recent transactions (this branch).</p>
              </div>
              <button
                onClick={() => { setShowHistoryModal(false); setHistorySales([]); setHistoryQuery(''); setHistoryError(null); }}
                className="p-2 rounded-xl hover:bg-muted transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                className="input-base flex-1"
                placeholder="Search by receipt no (R-xxxx) or sale id…"
              />
              <button
                onClick={() => refreshHistory(historyQuery)}
                disabled={historyLoading}
                className="btn-secondary h-10 px-4 disabled:opacity-50"
              >
                {historyLoading ? 'Loading…' : 'Search'}
              </button>
              <button
                onClick={() => refreshHistory('')}
                disabled={historyLoading}
                className="btn-secondary h-10 px-4 disabled:opacity-50"
              >
                Refresh
              </button>
            </div>

            {historyError && (
              <div className="mb-4 p-3 rounded-xl bg-destructive/10 text-destructive font-bold text-sm">
                {historyError}
              </div>
            )}

            <div className="max-h-[520px] overflow-y-auto rounded-2xl border border-border">
              <table className="w-full text-left">
                <thead className="bg-muted/40 text-muted-foreground text-xs font-bold uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Receipt</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {historySales.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground font-bold">
                        {historyLoading ? 'Loading…' : 'No transactions found.'}
                      </td>
                    </tr>
                  ) : (
                    historySales.map((s) => {
                      const receiptSuffixSource = String(s?.id || s?.clientSaleId || '');
                      const receiptSuffix = receiptSuffixSource ? receiptSuffixSource.slice(-8).toUpperCase() : 'NA';
                      const receiptNo = `R-${receiptSuffix}`;
                      const isPrinting = historyReprintingId === String(s.id);
                      return (
                        <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 text-sm font-bold text-foreground">{formatDateTimeShort(s.createdAt)}</td>
                          <td className="px-4 py-3 text-sm font-mono font-bold text-muted-foreground">{receiptNo}</td>
                          <td className="px-4 py-3 text-sm font-black text-right text-foreground">{formatCurrency(Number(s.total) || 0)}</td>
                          <td className="px-4 py-3 text-center text-xs font-black text-muted-foreground">{String(s.status || '').toUpperCase()}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setShowReturnModal(true);
                                  setReturnSource('RECEIPT');
                                  setReturnLookup(String(s.id));
                                  setReturnReason('');
                                  setReturnItems([]);
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs font-black bg-amber-500/15 text-amber-800 hover:bg-amber-500/20 transition-colors"
                              >
                                Return
                              </button>
                              <button
                                onClick={() => reprintFromHistory(s)}
                                disabled={isPrinting}
                                className="px-3 py-1.5 rounded-lg text-xs font-black bg-primary/10 text-primary hover:bg-primary/15 transition-colors disabled:opacity-50"
                              >
                                {isPrinting ? 'Printing…' : 'Reprint'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
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
