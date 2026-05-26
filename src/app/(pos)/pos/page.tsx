'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import {
  Search, ShoppingCart, User, CreditCard, Banknote,
  Smartphone, Trash2, Plus, Minus, CheckCircle,
  ChevronRight, Package, AlertCircle, ArrowLeft, Printer, Info, X, Clock, Wifi, Layers, RotateCcw, Home, Maximize2
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { printHTMLWithQZ, printRawWithQZ } from '@/lib/qztray';

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
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [searchActiveIndex, setSearchActiveIndex] = useState(0);
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
  const [ticketDiscountMode, setTicketDiscountMode] = useState<'AMOUNT' | 'PERCENT'>(() => 'AMOUNT');
  const [ticketDiscountDraft, setTicketDiscountDraft] = useState('');
  const [ticketDiscount, setTicketDiscount] = useState(0);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashMode, setCashMode] = useState<'IN' | 'OUT'>(() => 'IN');
  const [cashAmountDraft, setCashAmountDraft] = useState('');
  const [cashNoteDraft, setCashNoteDraft] = useState('');
  const [cashSubmitting, setCashSubmitting] = useState(false);
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
  const productSearchRef = useRef<HTMLInputElement | null>(null);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const searchDropdownRef = useRef<HTMLDivElement | null>(null);
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
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        product.name.toLowerCase().includes(q) ||
        product.sku.toLowerCase().includes(q) ||
        (Array.isArray(product.barcodes) && product.barcodes.some((b) => String(b).toLowerCase().includes(q)));
      const matchesCategory = q ? true : !selectedCategory || product.category.name === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const scored: Array<{ product: Product; score: number }> = [];
    for (const p of products) {
      const name = String(p.name || '').toLowerCase();
      const sku = String(p.sku || '').toLowerCase();
      const barcodes = Array.isArray(p.barcodes) ? p.barcodes.map((b) => String(b).toLowerCase()) : [];
      const barcodeExact = barcodes.includes(q);
      const barcodeStarts = barcodes.some((b) => b.startsWith(q));
      const barcodeIncludes = barcodes.some((b) => b.includes(q));
      const skuExact = sku === q;
      const skuStarts = sku.startsWith(q);
      const skuIncludes = sku.includes(q);
      const nameStarts = name.startsWith(q);
      const nameIncludes = name.includes(q);

      const isMatch = skuIncludes || barcodeIncludes || nameIncludes;
      if (!isMatch) continue;

      const score =
        skuExact || barcodeExact ? 0 :
        skuStarts || barcodeStarts ? 1 :
        nameStarts ? 2 :
        skuIncludes || barcodeIncludes ? 3 :
        4;

      scored.push({ product: p, score });
    }

    scored.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.product.name.localeCompare(b.product.name);
    });

    return scored.slice(0, 8).map((x) => x.product);
  }, [products, searchQuery]);

  const productById = useMemo(() => {
    return new Map<string, Product>(products.map((p) => [p.id, p]));
  }, [products]);

  const vatMode = useMemo<'INCLUSIVE' | 'EXCLUSIVE'>(() => {
    return storeSettings.vatMode === 'EXCLUSIVE' ? 'EXCLUSIVE' : 'INCLUSIVE';
  }, [storeSettings.vatMode]);

  const taxRate = useMemo(() => {
    const raw = Number(storeSettings.taxRate);
    if (Number.isFinite(raw) && raw > 0) {
      return raw > 1 ? raw / 100 : raw;
    }
    return 0.075;
  }, [storeSettings.taxRate]);

  const markupPercent = useMemo(() => {
    const raw = Number(storeSettings.markupPercent);
    if (Number.isFinite(raw) && raw >= 0) return raw;
    return 5;
  }, [storeSettings.markupPercent]);

  const getProductPrice = useCallback((product: Product) => {
    const base = Number(product.costPrice) > 0 ? Number(product.costPrice) : Number(product.retailPrice);
    const marked = base * (1 + markupPercent / 100);
    if (!product.isTaxable) return marked;
    if (vatMode === 'INCLUSIVE') return marked * (1 + taxRate);
    return marked;
  }, [markupPercent, taxRate, vatMode]);

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

  const selectProductFromSearch = useCallback((product: Product) => {
    addToCart(product);
    setSearchQuery('');
    setBarcodeBuffer('');
    setSearchDropdownOpen(false);
    setSearchActiveIndex(0);
    productSearchRef.current?.focus();
  }, [addToCart]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (searchWrapRef.current && searchWrapRef.current.contains(t)) return;
      if (searchDropdownRef.current && searchDropdownRef.current.contains(t)) return;
      setSearchDropdownOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

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

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
      const allowWhenFocused =
        (productSearchRef.current && target === productSearchRef.current) ||
        (customerLookupRef.current && target === customerLookupRef.current);
      if (!allowWhenFocused) return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setCart([]);
      setSelectedCustomer(null);
      setTicketDiscount(0);
      setTicketDiscountDraft('');
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

    if (e.key === 'F6') {
      e.preventDefault();
      if (cart.length === 0) return;
      setTicketDiscountDraft('');
      setTicketDiscountMode('AMOUNT');
      setShowDiscountModal(true);
      return;
    }

    if (e.key === 'F8') {
      e.preventDefault();
      openHistory();
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

    if (currentTime - lastScanTime > 250) {
      setBarcodeBuffer('');
    }

    if (e.key === 'Enter') {
      if (barcodeBuffer.length > 2) {
        const product = products.find(
          (p) => p.sku === barcodeBuffer || (p.barcodes && p.barcodes.includes(barcodeBuffer))
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
  }, [addToCart, barcodeBuffer, cart, lastScanTime, openHistory, products, selectedCustomer]);

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

  const voidTicket = useCallback(() => {
    if (cart.length === 0) return;
    const ok = confirm('Void the current ticket?');
    if (!ok) return;
    setCart([]);
    setSelectedCustomer(null);
    setTicketDiscount(0);
    setTicketDiscountDraft('');
    setSuccessMessage('Ticket voided');
    setTimeout(() => setSuccessMessage(null), 1500);
  }, [cart.length]);

  const openReturnModal = useCallback(() => {
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
  }, [lastCompletedSale]);

  const toggleFullScreen = useCallback(async () => {
    try {
      if (typeof document === 'undefined') return;
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {}
  }, []);

  const openCashModal = useCallback((mode: 'IN' | 'OUT') => {
    setCashMode(mode);
    setCashAmountDraft('');
    setCashNoteDraft('');
    setShowCashModal(true);
  }, []);

  const submitCashMovement = useCallback(async () => {
    if (cashSubmitting) return;
    const role = (session?.user as any)?.role as string | undefined;
    if (!role || !['OWNER', 'MANAGER'].includes(role)) {
      setSuccessMessage('Unauthorized.');
      setTimeout(() => setSuccessMessage(null), 2000);
      return;
    }
    const amount = Number(cashAmountDraft);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const note = cashNoteDraft.trim();
    if (note.length < 2) return;

    setCashSubmitting(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: cashMode === 'IN' ? 'CASH_IN' : 'CASH_OUT',
          amount,
          description: note,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setShowCashModal(false);
      setSuccessMessage(cashMode === 'IN' ? 'Cash in recorded' : 'Cash out recorded');
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (e: any) {
      setSuccessMessage(e?.message || 'Failed to record cash movement');
      setTimeout(() => setSuccessMessage(null), 3000);
    } finally {
      setCashSubmitting(false);
    }
  }, [cashAmountDraft, cashMode, cashNoteDraft, cashSubmitting, session?.user]);

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
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

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
  const totalBeforeTicketDiscount = total;
  const grandTotal = Math.max(0, totalBeforeTicketDiscount - (Number(ticketDiscount) || 0));

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
      discount: Number(ticketDiscount) || 0,
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
          discount: typeof savedSale?.discount === 'number' ? savedSale.discount : payload.discount,
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
          total: typeof savedSale?.total === 'number' ? savedSale.total : grandTotal,
          date: savedSale.createdAt || new Date().toISOString(),
        };
        setLastSale(completedSale);
        setLastCompletedSale(completedSale);
        setSuccessMessage('Transaction Completed Successfully');
        setCart([]);
        setSelectedCustomer(null);
        setTicketDiscount(0);
        setTicketDiscountDraft('');
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
        discount: payload.discount,
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
        total: grandTotal,
        date: new Date().toISOString(),
        offline: true,
      };

      setLastSale(completedSale);
      setLastCompletedSale(completedSale);
      setSuccessMessage('Offline: sale saved and will sync when internet returns');
      setCart([]);
      setSelectedCustomer(null);
      setTicketDiscount(0);
      setTicketDiscountDraft('');
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
  const printDoc = async (html: string, sale?: any) => {
    if (thermalPrinter) {
      try {
        console.log(`[Rosella Stores] Attempting QZ Tray print to "${thermalPrinter}"…`);
        const rawSale = sale || lastSale;
        if (rawSale) {
          await printRawWithQZ(getReceiptRaw(rawSale), thermalPrinter);
        } else {
          await printHTMLWithQZ(html, thermalPrinter);
        }
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

  const getReceiptHtml = (sale: any) => {
    const receiptSuffixSource = String(sale.id || sale.clientSaleId || '');
    const receiptSuffix = receiptSuffixSource ? receiptSuffixSource.slice(-8).toUpperCase() : 'NA';
    const receiptNo = `R-${receiptSuffix}`;
    const dateObj    = new Date(sale.date);
    const dateStr    = dateObj.toLocaleDateString('en-NG', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr    = dateObj.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
    const biz        = storeSettings.businessName || 'ROSELLA STORES';
    const cashier    = (session?.user as any)?.name || 'Staff';
    const badgeLabel = sale.offline ? '&#9733; OFFLINE SALE &#9733;' : '&#9733; SALES RECEIPT &#9733;';

    const payLabel: Record<string, string> = {
      CASH: 'Cash', CARD: 'Card / POS', BANK_TRANSFER: 'Bank Transfer',
      MOBILE_MONEY: 'Mobile Money', SPLIT: 'Split Payment',
    };

    const currencyLabel = (storeSettings.currency || 'NGN').toUpperCase();
    const pct = Math.round(taxRate * 1000) / 10;
    const pctLabel = Number.isFinite(pct) ? String(pct) : '7.5';
    const money = (value: number) =>
      new Intl.NumberFormat('en-NG', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(value) || 0);

    const grossSubtotal = sale.items.reduce((acc: number, item: any) => {
      const qty = Number(item.quantity) || 0;
      const unit = Number(item.unitPrice) || 0;
      return acc + qty * unit;
    }, 0);
    const lineDiscountTotal = sale.items.reduce((acc: number, item: any) => acc + (Number(item.discount) || 0), 0);
    const ticketDiscountTotal = Number(sale.discount) || 0;
    const discountTotal = lineDiscountTotal + ticketDiscountTotal;

    const splitParts =
      sale.paymentMethod === 'SPLIT' && typeof sale.notes === 'string'
        ? (() => {
            const m = sale.notes.match(/Cash:\s*([\d.]+),\s*Card:\s*([\d.]+),\s*Transfer:\s*([\d.]+),\s*Mobile:\s*([\d.]+)/i);
            if (!m) return null;
            const toMoney = (s: string) => money(Number(s) || 0);
            return {
              cash: toMoney(m[1]),
              card: toMoney(m[2]),
              transfer: toMoney(m[3]),
              mobile: toMoney(m[4]),
            };
          })()
        : null;

    const totalsByVatCode = sale.items.reduce(
      (acc: { aNet: number; bNet: number; bVat: number }, item: any) => {
        const lineTotal = Number(item.total) || 0;
        const isTaxable = Boolean(item.isTaxable);
        if (!isTaxable) {
          acc.aNet += lineTotal;
          return acc;
        }
        if (vatMode === 'INCLUSIVE' || item.taxInclusive) {
          const net = lineTotal / (1 + taxRate);
          const vat = lineTotal - net;
          acc.bNet += net;
          acc.bVat += vat;
          return acc;
        }
        acc.bNet += lineTotal;
        acc.bVat += lineTotal * taxRate;
        return acc;
      },
      { aNet: 0, bNet: 0, bVat: 0 }
    );

    const itemRows = sale.items
      .map((item: any) => {
        const name     = String(item.name || '').trim();
        const code     = item.isTaxable ? 'B' : 'A';
        const qty      = Number(item.quantity) || 0;
        const tot      = formatCurrency(item.total);
        const compactName = name.length > 26 ? name.slice(0, 26) : name;
        return `
          <tr>
            <td style="width:10mm;padding:3px 0 2px;vertical-align:top;font-weight:900">${code}</td>
            <td style="padding:3px 0 2px;vertical-align:top;font-weight:800">${compactName}</td>
            <td style="width:10mm;text-align:right;padding:3px 0 2px;vertical-align:top;font-weight:800">${qty}</td>
            <td style="width:22mm;text-align:right;padding:3px 0 2px;vertical-align:top;font-weight:900;white-space:nowrap">${money(item.total)}</td>
          </tr>`;
      })
      .join('');

    const discountHtml =
      discountTotal > 0
        ? `<div class="line"><span>Discount</span><span>-${money(discountTotal)}</span></div>`
        : '';

    const splitHtml = splitParts
      ? `
        <div class="line"><span>Split: Cash</span><span>${splitParts.cash}</span></div>
        <div class="line"><span>Split: Card</span><span>${splitParts.card}</span></div>
        <div class="line"><span>Split: Transfer</span><span>${splitParts.transfer}</span></div>
        <div class="line"><span>Split: Mobile</span><span>${splitParts.mobile}</span></div>
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
      font-family: 'Lucida Console', Consolas, 'Courier New', monospace;
      font-size: 12px;
      font-weight: 400;
      line-height: 1.45;
      width: 74mm;
      color: #000;
      background: #fff;
      letter-spacing: 0.2px;
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
    .summary { margin-top: 6px; }
    .line { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; font-weight: 900; padding: 2px 0; }
    .subline { display: flex; justify-content: space-between; gap: 10px; font-size: 11px; font-weight: 800; padding: 1px 0; }
    .muted { color: #222; font-weight: 800; }
    .vat-row { display: grid; grid-template-columns: 12mm 1fr 16mm 16mm; gap: 2mm; font-size: 12px; font-weight: 900; padding: 1px 0; }
    .vat-row div:last-child { text-align: right; }
    .vat-row .r { text-align: right; }
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
  <tr><td>Date:</td><td>${dateStr}</td></tr>
  <tr><td>Time:</td><td>${timeStr}</td></tr>
  <tr><td>Cashier:</td><td>${cashier}</td></tr>
</table>

<hr class="dash">
<table>
  <tr class="col-hdr">
    <td style="width:10mm">TC</td>
    <td>Item Description</td>
    <td style="width:10mm;text-align:right">Qty</td>
    <td style="width:22mm;text-align:right">Amt(${currencyLabel})</td>
  </tr>
  ${itemRows}
</table>

<hr class="dash">
<div class="summary">
  <div class="line"><span>${totalItems} ${totalItems === 1 ? 'Item Sold' : 'Items Sold'}</span><span></span></div>
  <div class="line"><span>Sale Subtotal:</span><span>${money(sale.subtotal)}</span></div>
  ${discountHtml}
  ${splitHtml}
  <div style="height:4px"></div>
  <div class="vat-row">
    <div>A</div>
    <div class="muted">0% Net Amount</div>
    <div class="r">${money(totalsByVatCode.aNet)}</div>
    <div class="r">VAT ${money(0)}</div>
  </div>
  <div class="vat-row">
    <div>B${pctLabel}%</div>
    <div class="muted">Net Amount</div>
    <div class="r">${money(totalsByVatCode.bNet)}</div>
    <div class="r">VAT ${money(totalsByVatCode.bVat)}</div>
  </div>
</div>

<hr class="solid">
<div class="line"><span>${payLabel[sale.paymentMethod] || sale.paymentMethod}</span><span>${money(sale.total)}</span></div>
<hr class="dash">

<div class="footer">
  ${storeSettings.receiptFooter || 'Thank you for your purchase!'}
  <br>Please keep this receipt for your records.
</div>
<hr class="dash">
<div class="rcpt-id">${receiptNo}</div>

</body>
</html>`;
    return receiptHtml;
  };

  const getReceiptRaw = (sale: any) => {
    const cols = 42;
    const dateObj = new Date(sale?.date || sale?.createdAt || new Date().toISOString());
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = String(dateObj.getFullYear());
    const dateStr = `${dd}.${mm}.${yyyy}`;
    const timeStr = dateObj.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }).toLowerCase();
    const biz = String(storeSettings.businessName || 'ROSELLA STORES');
    const addr = String(storeSettings.businessAddress || '').trim();
    const receiptSuffixSource = String(sale?.id || sale?.clientSaleId || '');
    const receiptSuffix = receiptSuffixSource ? receiptSuffixSource.slice(-8).toUpperCase() : 'NA';
    const receiptNo = `R-${receiptSuffix}`;

    const money = (value: number) =>
      new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);

    const pad = (s: string, n: number, dir: 'L' | 'R' = 'R') => {
      const str = String(s);
      if (str.length === n) return str;
      if (str.length > n) return dir === 'R' ? str.slice(0, n) : str.slice(-n);
      const spaces = ' '.repeat(n - str.length);
      return dir === 'R' ? str + spaces : spaces + str;
    };
    const center = (s: string) => {
      const str = String(s);
      if (str.length >= cols) return str.slice(0, cols);
      const left = Math.floor((cols - str.length) / 2);
      return ' '.repeat(left) + str;
    };
    const line = (ch = '-') => ch.repeat(cols);

    const vatAgg = sale.items.reduce(
      (acc: { aNet: number; bNet: number; bVat: number }, item: any) => {
        const lineTotal = Number(item.total) || 0;
        const isTaxable = Boolean(item.isTaxable);
        if (!isTaxable) {
          acc.aNet += lineTotal;
          return acc;
        }
        if (vatMode === 'INCLUSIVE' || item.taxInclusive) {
          const net = lineTotal / (1 + taxRate);
          const vat = lineTotal - net;
          acc.bNet += net;
          acc.bVat += vat;
          return acc;
        }
        acc.bNet += lineTotal;
        acc.bVat += lineTotal * taxRate;
        return acc;
      },
      { aNet: 0, bNet: 0, bVat: 0 }
    );

    const items = Array.isArray(sale.items) ? sale.items : [];
    const totalItems = items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);

    const header = `${pad('Date:' + dateStr, Math.floor(cols / 2))}${pad('Time:' + timeStr, cols - Math.floor(cols / 2), 'L')}`;
    const itemHdr = (() => {
      const tc = pad('TC', 3);
      const qty = pad('Qty', 4, 'L');
      const amt = pad('Amt(NGN)', 10, 'L');
      const descrW = cols - 3 - 1 - 4 - 1 - 10;
      return `${tc} ${pad('Item Description', descrW)} ${qty} ${amt}`;
    })();

    const itemLines = items
      .map((it: any) => {
        const tc = it.isTaxable ? 'B' : 'A';
        const qty = String(Number(it.quantity) || 0);
        const amt = money(Number(it.total) || 0);
        const descrW = cols - 3 - 1 - 4 - 1 - 10;
        const name = String(it.name || '').trim();
        return `${pad(tc, 3)} ${pad(name, descrW)} ${pad(qty, 4, 'L')} ${pad(amt, 10, 'L')}`;
      })
      .join('\n');

    const subtotal = money(Number(sale.subtotal) || 0);
    const total = money(Number(sale.total) || 0);

    const pct = Math.round(taxRate * 1000) / 10;
    const pctLabel = Number.isFinite(pct) ? String(pct) : '7.5';

    const vatA = `A 0% Net Amount ${pad(money(vatAgg.aNet), 10, 'L')} VAT ${pad(money(0), 10, 'L')}`;
    const vatB = `B${pctLabel}% Net Amount ${pad(money(vatAgg.bNet), 10, 'L')} VAT ${pad(money(vatAgg.bVat), 10, 'L')}`;

    const payLabel: Record<string, string> = {
      CASH: 'Cash',
      CARD: 'Debit Card',
      BANK_TRANSFER: 'Transfer',
      MOBILE_MONEY: 'Mobile Money',
      SPLIT: 'Split Payment',
    };

    const payment = String(payLabel[sale.paymentMethod] || sale.paymentMethod);

    const esc = '\x1b';
    const gs = '\x1d';
    const init = `${esc}@${esc}M\x00${esc}!\x00`;
    const cut = `${gs}V\x00`;

    const body = [
      center(biz.toUpperCase()),
      ...(addr ? [center(addr)] : []),
      '',
      header,
      line('-'),
      itemHdr,
      line('-'),
      itemLines,
      line('-'),
      center(`${totalItems} ${totalItems === 1 ? 'Item Sold' : 'Items Sold'}`),
      `Sale Subtotal: ${pad(subtotal, cols - 'Sale Subtotal: '.length, 'L')}`,
      vatA,
      vatB,
      '',
      `${payment}${pad(total, cols - payment.length, 'L')}`,
      '',
      center(receiptNo),
      '',
      '',
    ].filter((x) => x !== undefined).join('\n');

    return init + body + cut;
  };

  const printReceipt = async (saleData?: any) => {
    const sale = saleData || lastSale;
    if (!sale) return;
    await printDoc(getReceiptHtml(sale), sale);
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
    <div className="min-h-[calc(100vh-64px)] h-[calc(100dvh-64px)] overflow-hidden bg-slate-100 text-foreground relative flex flex-col">
      <div className="h-10 bg-slate-800 text-white flex items-center justify-between px-3 border-b border-slate-900">
        <div className="flex items-center gap-2 min-w-0">
          <div className="font-black tracking-widest text-sm">POS</div>
          <div className="text-xs font-bold text-emerald-300 truncate">
            {storeSettings?.businessName || 'Rosella Stores'} — Terminal
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMobileCart(true)}
            className="md:hidden h-8 px-3 rounded bg-slate-700 hover:bg-slate-600 border border-slate-600 text-[11px] font-black flex items-center gap-2"
            title="Open POS panel"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>{cart.length}</span>
          </button>
          <div
            className={[
              'px-2 py-1 rounded text-[11px] font-black border',
              isOnline ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-red-500/10 border-red-500/30 text-red-200',
            ].join(' ')}
          >
            {isOnline ? 'ONLINE' : 'OFFLINE'}
            {pendingSalesCount > 0 ? ` • ${pendingSalesCount}` : ''}
          </div>
          <button
            onClick={toggleFullScreen}
            className="w-9 h-8 rounded bg-slate-700 hover:bg-slate-600 border border-slate-600 flex items-center justify-center"
            title="Full screen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[1fr,380px]">
        <div className="p-3 md:p-4 flex flex-col gap-2 overflow-hidden" data-testid="pos-terminal">
          <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr] gap-2">
            <div ref={searchWrapRef} className="relative">
              <div className="bg-white border border-slate-300 h-10 flex items-center px-2 text-slate-900">
                <Search className="w-4 h-4 text-slate-500 mr-2" />
                <input
                  ref={productSearchRef}
                  value={searchQuery}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSearchQuery(next);
                    setSearchActiveIndex(0);
                    if (next.trim()) setSelectedCategory('');
                    setSearchDropdownOpen(!!next.trim());
                  }}
                  onFocus={() => {
                    if (searchQuery.trim()) setSearchDropdownOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setSearchDropdownOpen(false);
                      return;
                    }

                    if (e.key === 'ArrowDown') {
                      if (!searchQuery.trim()) return;
                      e.preventDefault();
                      setSearchDropdownOpen(true);
                      setSearchActiveIndex((prev) => {
                        const max = Math.max(0, searchResults.length - 1);
                        return prev >= max ? 0 : prev + 1;
                      });
                      return;
                    }

                    if (e.key === 'ArrowUp') {
                      if (!searchQuery.trim()) return;
                      e.preventDefault();
                      setSearchDropdownOpen(true);
                      setSearchActiveIndex((prev) => {
                        const max = Math.max(0, searchResults.length - 1);
                        return prev <= 0 ? max : prev - 1;
                      });
                      return;
                    }

                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (searchDropdownOpen && searchResults.length > 0) {
                        const picked = searchResults[Math.max(0, Math.min(searchActiveIndex, searchResults.length - 1))];
                        if (picked) selectProductFromSearch(picked);
                        return;
                      }
                      quickAddFirst();
                    }
                  }}
                  className="w-full bg-transparent outline-none text-sm font-semibold !text-slate-900 caret-slate-900 !placeholder:text-slate-500 selection:bg-sky-200"
                  placeholder="Search / scan item"
                  data-testid="pos-search"
                  style={{ color: '#0f172a', caretColor: '#0f172a' }}
                />
                {searchQuery.trim() && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('');
                      setSearchActiveIndex(0);
                      setSearchDropdownOpen(false);
                      productSearchRef.current?.focus();
                    }}
                    className="ml-2 w-7 h-7 rounded border border-slate-300 hover:bg-slate-100 active:scale-[0.98] transition flex items-center justify-center"
                    title="Clear"
                  >
                    <X className="w-4 h-4 text-slate-600" />
                  </button>
                )}
              </div>

              {searchDropdownOpen && searchQuery.trim() && (
                <div
                  ref={searchDropdownRef}
                  className="absolute left-0 right-0 mt-1 bg-white border border-slate-300 shadow-xl z-[80] max-h-[260px] overflow-auto"
                  data-testid="pos-search-dropdown"
                >
                  {searchResults.length === 0 ? (
                    <div className="px-3 py-2 text-sm font-semibold text-slate-600">No matching items</div>
                  ) : (
                    <div className="py-1">
                      {searchResults.map((p, idx) => {
                        const active = idx === searchActiveIndex;
                        const price = getProductPrice(p);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onMouseEnter={() => setSearchActiveIndex(idx)}
                            onClick={() => selectProductFromSearch(p)}
                            className={[
                              'w-full px-3 py-2 flex items-center justify-between gap-3 text-left',
                              active ? 'bg-sky-100' : 'hover:bg-slate-50',
                            ].join(' ')}
                            data-testid={`pos-search-option-${p.sku}`}
                            title={`${p.name} (${p.sku})`}
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-black text-slate-900 truncate">{p.name}</div>
                              <div className="text-[11px] font-mono text-slate-600 truncate">
                                {p.sku}
                                {Array.isArray(p.barcodes) && p.barcodes.length > 0 ? ` • ${String(p.barcodes[0])}` : ''}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-sm font-black text-slate-900">{formatCurrency(price)}</div>
                              <div className="text-[11px] font-bold text-slate-600">{p.stockQty} in stock</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-300 h-10 flex items-center px-2 text-slate-900">
              <User className="w-4 h-4 text-slate-500 mr-2" />
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
                className="w-full bg-transparent outline-none text-sm font-semibold !text-slate-900 caret-slate-900 !placeholder:text-slate-500 selection:bg-sky-200"
                placeholder="Customer lookup"
                data-testid="pos-customer-lookup"
                style={{ color: '#0f172a', caretColor: '#0f172a' }}
              />
            </div>
          </div>

          <div className="bg-white border border-slate-300 p-2 text-slate-900">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => setShowAddCustomerModal(true)}
                  className="w-12 h-12 border border-slate-300 bg-white hover:bg-slate-50 active:scale-[0.99] transition flex items-center justify-center"
                  title="Add New Customer"
                  aria-label="Add New Customer"
                  data-testid="pos-add-customer"
                >
                  <Plus className="w-6 h-6 text-slate-500" />
                </button>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 truncate">{selectedCustomer?.name || 'POS Customer'}</div>
                </div>
              </div>
              <div className="text-[11px] font-bold text-slate-600">
                {now.toLocaleDateString('en-NG')} {now.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          <div
            className="flex-1 bg-white border border-slate-300 overflow-hidden flex flex-col text-slate-900"
            data-testid="pos-cart-panel"
          >
            <div className="bg-slate-100 border-b border-slate-200 text-[11px] font-black text-slate-800 px-2 py-1">
              <div className="grid grid-cols-[90px,1fr,140px,110px,120px,36px] gap-2 items-center">
                <div>SKU ID</div>
                <div>Product name</div>
                <div className="text-center">Amount</div>
                <div className="text-center">Discount</div>
                <div className="text-right pr-2">Row total</div>
                <div />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-sm font-bold text-slate-600 gap-1">
                  <div className="text-slate-800" data-testid="pos-empty">
                    Empty Terminal
                  </div>
                  <div className="text-xs font-semibold text-slate-500">Scan or select products to start a sale.</div>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {cart.map((item) => {
                    const p = productById.get(item.productId);
                    const sku = p?.sku || item.productId.slice(-8).toUpperCase();
                    const grossLine = (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0);
                    const pct = grossLine > 0 ? Math.round(((Number(item.discount) || 0) / grossLine) * 100) : 0;
                    return (
                      <div
                        key={item.productId}
                        className="px-2 py-2 text-[12px]"
                        data-testid={`pos-cart-item-${item.productId}`}
                      >
                        <div className="grid grid-cols-[90px,1fr,140px,110px,120px,36px] gap-2 items-center">
                          <div className="font-mono text-slate-800 truncate">{sku}</div>
                          <div className="font-bold text-slate-900 truncate">{item.name}</div>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => updateCartItem(item.productId, item.quantity - 1, item.discount)}
                              className="w-8 h-8 border border-slate-300 hover:bg-slate-100 active:scale-[0.98] transition flex items-center justify-center"
                              title="Decrease"
                              aria-label={`Decrease quantity for ${item.name}`}
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <div
                              className="w-10 h-8 border border-slate-300 flex items-center justify-center font-black text-slate-900"
                              data-testid={`pos-cart-qty-${item.productId}`}
                            >
                              {item.quantity}
                            </div>
                            <button
                              onClick={() => updateCartItem(item.productId, item.quantity + 1, item.discount)}
                              className="w-8 h-8 border border-slate-300 hover:bg-slate-100 active:scale-[0.98] transition flex items-center justify-center"
                              title="Increase"
                              aria-label={`Increase quantity for ${item.name}`}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={Number.isFinite(pct) ? String(pct) : '0'}
                              onChange={(e) => {
                                const nextPct = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                                const nextDiscount = (grossLine * nextPct) / 100;
                                updateCartItem(item.productId, item.quantity, nextDiscount);
                              }}
                              className="w-16 h-8 border border-slate-300 text-center font-black outline-none text-slate-900 placeholder:text-slate-500"
                              title="Discount %"
                              data-testid={`pos-cart-discount-${item.productId}`}
                            />
                            <div className="text-xs font-black text-slate-500">%</div>
                          </div>
                          <div className="text-right font-black pr-2" data-testid={`pos-cart-rowtotal-${item.productId}`}>
                            {formatCurrency(item.total)}
                          </div>
                          <button
                            onClick={() => removeFromCart(item.productId)}
                            className="w-8 h-8 border border-slate-300 hover:bg-red-50 active:scale-[0.98] transition flex items-center justify-center"
                            title="Remove"
                            aria-label={`Remove ${item.name}`}
                          >
                            <X className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-300 p-2 text-slate-900">
            {(() => {
              const gross = cart.reduce((acc, it) => acc + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 0), 0);
              const lineDiscount = cart.reduce((acc, it) => acc + (Number(it.discount) || 0), 0);
              const taxShown = vatMode === 'INCLUSIVE' ? taxBreakdown.inclusive : tax;
              const discountShown = Math.max(0, lineDiscount + (Number(ticketDiscount) || 0));
              const netShown = Math.max(0, grandTotal - taxShown);
              return (
                <div className="grid grid-cols-[1fr,140px] gap-y-1 text-[12px]">
                  <div className="text-right text-slate-600 font-bold">Discount:</div>
                  <div className="text-right font-black text-slate-900" data-testid="pos-total-discount">
                    {formatCurrency(discountShown)}
                  </div>
                  <div className="text-right text-slate-600 font-bold">Net total:</div>
                  <div className="text-right font-black text-slate-900" data-testid="pos-total-net">
                    {formatCurrency(netShown)}
                  </div>
                  <div className="text-right text-slate-600 font-bold">Total tax:</div>
                  <div className="text-right font-black text-slate-900" data-testid="pos-total-tax">
                    {formatCurrency(taxShown)}
                  </div>
                  <div className="text-right text-slate-900 font-black text-[13px]">Total:</div>
                  <div className="text-right font-black text-[13px] text-slate-900" data-testid="pos-total-grand">
                    {formatCurrency(grandTotal)}
                  </div>
                  <div className="hidden">{gross}</div>
                </div>
              );
            })()}
          </div>
        </div>

        <div
          className={[
            'border-l border-slate-300 bg-slate-200 overflow-hidden flex flex-col',
            showMobileCart ? 'fixed inset-0 z-[90] md:static' : '',
          ].join(' ')}
        >
          <div className="p-2 border-b border-slate-300 bg-slate-200">
            <div className="grid grid-cols-4 gap-1">
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('');
                  productSearchRef.current?.focus();
                }}
                className="h-12 bg-lime-500 hover:bg-lime-400 text-lime-950 font-black flex items-center justify-center"
                title="Home"
              >
                <Home className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  setShowAddCustomerModal(true);
                }}
                className="h-12 bg-lime-500 hover:bg-lime-400 text-lime-950 font-black flex items-center justify-center"
                title="Customer"
              >
                <User className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  setPaymentMethod('CASH');
                  setShowPaymentModal(true);
                }}
                disabled={cart.length === 0}
                className="h-12 bg-sky-600 hover:bg-sky-500 text-white font-black flex items-center justify-center disabled:opacity-50 disabled:grayscale"
                title="Cash (F5)"
              >
                CASH
              </button>
              <button
                onClick={() => {
                  setPaymentMethod('CARD');
                  setShowPaymentModal(true);
                }}
                disabled={cart.length === 0}
                className="h-12 bg-sky-600 hover:bg-sky-500 text-white font-black flex items-center justify-center disabled:opacity-50 disabled:grayscale"
                title="Card"
              >
                CARD
              </button>
            </div>
          </div>

          <div className="p-2 overflow-y-auto flex-1">
            <div className="grid grid-cols-4 gap-1">
              {filteredProducts.slice(0, 12).map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={p.stockQty === 0}
                  className="h-14 bg-sky-200 hover:bg-sky-300 text-slate-900 border border-slate-300 font-black text-[10px] leading-tight p-1 text-left disabled:opacity-50 disabled:grayscale"
                  title={p.name}
                  data-testid={`pos-product-${p.sku}`}
                >
                  <div className="line-clamp-2">{p.name}</div>
                </button>
              ))}
              {Array.from({ length: Math.max(0, 12 - filteredProducts.slice(0, 12).length) }).map((_, idx) => (
                <button
                  key={`empty-${idx}`}
                  disabled
                  className="h-14 bg-slate-100 border border-slate-300"
                />
              ))}
            </div>

            <div className="mt-2 grid grid-cols-4 gap-1">
              <button
                onClick={() => {
                  setTicketDiscountDraft('');
                  setTicketDiscountMode('AMOUNT');
                  setShowDiscountModal(true);
                }}
                disabled={cart.length === 0}
                className="h-14 bg-sky-600 hover:bg-sky-500 text-white font-black text-[11px] disabled:opacity-50 disabled:grayscale"
                data-testid="pos-btn-discount"
              >
                Discount
              </button>
              <button
                onClick={() => {
                  setPaymentMethod('SPLIT');
                  setShowPaymentModal(true);
                }}
                disabled={cart.length === 0}
                className="h-14 bg-sky-600 hover:bg-sky-500 text-white font-black text-[11px] disabled:opacity-50 disabled:grayscale"
                data-testid="pos-btn-split"
              >
                Split sale
              </button>
              <button
                onClick={() => {
                  holdBill();
                }}
                disabled={cart.length === 0}
                className="h-14 bg-sky-600 hover:bg-sky-500 text-white font-black text-[11px] disabled:opacity-50 disabled:grayscale"
                data-testid="pos-btn-hold"
              >
                Save sale
              </button>
              <button
                onClick={() => {
                  recallHeldBill();
                }}
                disabled={heldBillCount === 0}
                className="h-14 bg-sky-600 hover:bg-sky-500 text-white font-black text-[11px] disabled:opacity-50 disabled:grayscale"
                data-testid="pos-btn-recall"
              >
                Unfinished
              </button>

              <button
                onClick={() => {
                  openCashModal('IN');
                }}
                className="h-14 bg-sky-600 hover:bg-sky-500 text-white font-black text-[11px]"
                data-testid="pos-btn-cash-in"
              >
                Cash IN
              </button>
              <button
                onClick={() => {
                  openCashModal('OUT');
                }}
                className="h-14 bg-sky-600 hover:bg-sky-500 text-white font-black text-[11px]"
                data-testid="pos-btn-cash-out"
              >
                Cash OUT
              </button>
              <button
                onClick={() => {
                  openHistory();
                }}
                className="h-14 bg-sky-600 hover:bg-sky-500 text-white font-black text-[11px]"
                data-testid="pos-btn-history"
              >
                History
              </button>
              <button
                onClick={() => {
                  if (!lastCompletedSale) return;
                  setShowReceiptPreview(true);
                }}
                disabled={!lastCompletedSale}
                className="h-14 bg-sky-600 hover:bg-sky-500 text-white font-black text-[11px] disabled:opacity-50 disabled:grayscale"
                data-testid="pos-btn-receipt"
              >
                Receipt
              </button>
            </div>
          </div>

          <div className="p-2 border-t border-slate-300 bg-slate-200">
            <div className="grid grid-cols-4 gap-1">
              <button
                onClick={() => setShowAddCustomerModal(true)}
                className="h-14 bg-yellow-400 hover:bg-yellow-300 text-yellow-950 font-black flex items-center justify-center"
                title="Customer"
                data-testid="pos-btn-customer"
              >
                <User className="w-6 h-6" />
              </button>
              <button
                onClick={voidTicket}
                disabled={cart.length === 0}
                className="h-14 bg-red-500 hover:bg-red-400 text-white font-black disabled:opacity-50 disabled:grayscale"
                data-testid="pos-btn-void"
              >
                Void
              </button>
              <button
                onClick={openReturnModal}
                className="h-14 bg-rose-500 hover:bg-rose-400 text-white font-black"
                data-testid="pos-btn-return"
              >
                Return
              </button>
              <button
                onClick={() => setShowPaymentModal(true)}
                disabled={cart.length === 0}
                className="h-14 bg-lime-500 hover:bg-lime-400 text-lime-950 font-black disabled:opacity-50 disabled:grayscale"
                data-testid="pos-btn-pay"
              >
                Pay
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowMobileCart(false)}
            className="md:hidden h-12 bg-slate-800 text-white font-black"
          >
            Close
          </button>
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

      {showDiscountModal &&
        (() => {
          const base = totalBeforeTicketDiscount;
          const raw = Number(ticketDiscountDraft) || 0;
          const preview =
            ticketDiscountMode === 'PERCENT' ? (base * raw) / 100 : raw;
          const normalized = Math.max(0, Math.min(preview, base));

          return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
              <div className="bg-card glass rounded-2xl p-7 max-w-md w-full shadow-2xl animate-entrance border-none">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">Discount</h2>
                    <p className="text-muted-foreground text-sm mt-1">Apply a ticket discount to the current sale.</p>
                  </div>
                  <button
                    onClick={() => setShowDiscountModal(false)}
                    className="p-2 rounded-xl hover:bg-muted/40 transition-colors text-muted-foreground"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setTicketDiscountMode('AMOUNT')}
                      className={[
                        'h-11 rounded-xl border text-sm font-black transition-colors',
                        ticketDiscountMode === 'AMOUNT'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/20 text-muted-foreground border-white/10 hover:bg-muted/30',
                      ].join(' ')}
                    >
                      Amount
                    </button>
                    <button
                      onClick={() => setTicketDiscountMode('PERCENT')}
                      className={[
                        'h-11 rounded-xl border text-sm font-black transition-colors',
                        ticketDiscountMode === 'PERCENT'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/20 text-muted-foreground border-white/10 hover:bg-muted/30',
                      ].join(' ')}
                    >
                      Percent
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">
                      Value {ticketDiscountMode === 'PERCENT' ? '(%)' : '(₦)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={ticketDiscountDraft}
                      onChange={(e) => setTicketDiscountDraft(e.target.value)}
                      className="input-base h-12 text-base font-bold bg-muted/20 border border-white/10"
                      placeholder={ticketDiscountMode === 'PERCENT' ? '0' : '0'}
                      autoFocus
                      data-testid="pos-ticket-discount-value"
                    />
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-muted/10 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold text-muted-foreground">Ticket Total</span>
                      <span className="font-black">{formatCurrency(base)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="font-bold text-muted-foreground">Discount</span>
                      <span className="font-black text-amber-600">-{formatCurrency(normalized)}</span>
                    </div>
                    <div className="flex items-center justify-between text-base mt-3 pt-3 border-t border-white/10">
                      <span className="font-black text-muted-foreground">Payable</span>
                      <span className="font-black text-primary">{formatCurrency(Math.max(0, base - normalized))}</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    {ticketDiscount > 0 && (
                      <button
                        onClick={() => {
                          setTicketDiscount(0);
                          setTicketDiscountDraft('');
                          setShowDiscountModal(false);
                          setSuccessMessage('Discount cleared');
                          setTimeout(() => setSuccessMessage(null), 1500);
                        }}
                        className="h-12 px-4 rounded-xl font-black bg-muted hover:bg-muted-foreground/10 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      onClick={() => setShowDiscountModal(false)}
                      className="flex-1 h-12 rounded-xl font-black bg-muted hover:bg-muted-foreground/10 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setTicketDiscount(normalized);
                        setTicketDiscountDraft('');
                        setShowDiscountModal(false);
                        setSuccessMessage('Discount applied');
                        setTimeout(() => setSuccessMessage(null), 1500);
                      }}
                      className="flex-1 h-12 rounded-xl font-black bg-amber-500 text-amber-950 hover:bg-amber-400 transition-colors"
                      disabled={cart.length === 0}
                      data-testid="pos-ticket-discount-apply"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {showReceiptPreview && lastCompletedSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-card rounded-2xl w-full max-w-3xl shadow-2xl border border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Receipt Preview</p>
                <p className="font-black tracking-tight truncate">
                  #{String(lastCompletedSale?.id || lastCompletedSale?.clientSaleId || '').slice(-8).toUpperCase()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => printReceipt(lastCompletedSale)}
                  className="h-10 px-4 rounded-xl bg-primary text-primary-foreground font-black text-sm"
                  data-testid="pos-receipt-print"
                >
                  Print
                </button>
                <button
                  onClick={() => setShowReceiptPreview(false)}
                  className="h-10 px-4 rounded-xl bg-muted hover:bg-muted-foreground/10 font-black text-sm transition-colors"
                  data-testid="pos-receipt-close"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="bg-slate-100">
              <iframe
                title="Receipt Preview"
                className="w-full h-[70vh] bg-white"
                srcDoc={getReceiptHtml(lastCompletedSale)}
                data-testid="pos-receipt-iframe"
              />
            </div>
          </div>
        </div>
      )}

      {showCashModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-white/10" data-testid="pos-cash-modal">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black tracking-tight">{cashMode === 'IN' ? 'Cash In' : 'Cash Out'}</h2>
                <p className="text-muted-foreground text-sm mt-1">Record a cash drawer movement.</p>
              </div>
              <button
                onClick={() => setShowCashModal(false)}
                className="p-2 rounded-xl hover:bg-muted/40 transition-colors text-muted-foreground"
                title="Close"
                aria-label="Close"
                data-testid="pos-cash-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">Amount</label>
                <input
                  type="number"
                  min={0}
                  value={cashAmountDraft}
                  onChange={(e) => setCashAmountDraft(e.target.value)}
                  className="input-base h-12 text-base font-bold bg-muted/20 border border-white/10"
                  placeholder="0"
                  autoFocus
                  data-testid="pos-cash-amount"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">Note</label>
                <input
                  value={cashNoteDraft}
                  onChange={(e) => setCashNoteDraft(e.target.value)}
                  className="input-base h-12 text-base font-bold bg-muted/20 border border-white/10"
                  placeholder="Reason / description"
                  data-testid="pos-cash-note"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCashModal(false)}
                  disabled={cashSubmitting}
                  className="flex-1 h-12 rounded-xl font-black bg-muted hover:bg-muted-foreground/10 transition-colors disabled:opacity-50"
                  data-testid="pos-cash-cancel"
                >
                  Cancel
                </button>
                <button
                  onClick={submitCashMovement}
                  disabled={cashSubmitting || !cashAmountDraft.trim() || !cashNoteDraft.trim()}
                  className="flex-1 h-12 rounded-xl font-black bg-primary text-primary-foreground disabled:opacity-50"
                  data-testid="pos-cash-save"
                >
                  {cashSubmitting ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-card glass rounded-2xl p-8 max-w-md w-full shadow-2xl animate-entrance border-none" data-testid="pos-payment-modal">
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
                <span className="font-black text-xl">{totalItems} Items</span>
              </div>

              <div className="pt-6 border-t border-white/5 mt-2">
                <p className="text-xs text-muted-foreground uppercase font-bold mb-1 text-center">Grand Total</p>
                <p className="text-4xl font-black text-primary text-center tracking-tighter">
                  {formatCurrency(grandTotal)}
                </p>
              </div>

              {paymentMethod === 'SPLIT' && (
                <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-3">
                  <p className="col-span-2 text-xs text-muted-foreground uppercase font-bold">Split Amounts Breakdown</p>
                  <div>
                    <label className="text-[10px] uppercase font-bold">Cash</label>
                    <input type="number" min="0" value={splitAmounts.cash || ''} onChange={(e) => setSplitAmounts({...splitAmounts, cash: parseFloat(e.target.value) || 0})} className="input-base py-1 px-2 text-sm" placeholder="0" data-testid="pos-split-cash" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold">Card</label>
                    <input type="number" min="0" value={splitAmounts.card || ''} onChange={(e) => setSplitAmounts({...splitAmounts, card: parseFloat(e.target.value) || 0})} className="input-base py-1 px-2 text-sm" placeholder="0" data-testid="pos-split-card" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold">Transfer</label>
                    <input type="number" min="0" value={splitAmounts.transfer || ''} onChange={(e) => setSplitAmounts({...splitAmounts, transfer: parseFloat(e.target.value) || 0})} className="input-base py-1 px-2 text-sm" placeholder="0" data-testid="pos-split-transfer" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold">Mobile</label>
                    <input type="number" min="0" value={splitAmounts.mobile || ''} onChange={(e) => setSplitAmounts({...splitAmounts, mobile: parseFloat(e.target.value) || 0})} className="input-base py-1 px-2 text-sm" placeholder="0" data-testid="pos-split-mobile" />
                  </div>
                  <div className="col-span-2 text-center text-xs font-bold mt-2">
                    Sum: {formatCurrency(splitAmounts.cash + splitAmounts.card + splitAmounts.transfer + splitAmounts.mobile)}
                    {Math.abs((splitAmounts.cash + splitAmounts.card + splitAmounts.transfer + splitAmounts.mobile) - grandTotal) > 0.01 && (
                       <span className="text-red-500 ml-2">Mismatch! Needs {formatCurrency(Math.abs(grandTotal - (splitAmounts.cash + splitAmounts.card + splitAmounts.transfer + splitAmounts.mobile)))}</span>
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
                data-testid="pos-payment-back"
              >
                Go Back
              </button>
              <button 
                onClick={handleCheckout} 
                disabled={
                  isCheckingOut ||
                  (paymentMethod === 'SPLIT' && Math.abs((splitAmounts.cash + splitAmounts.card + splitAmounts.transfer + splitAmounts.mobile) - grandTotal) > 0.01)
                }
                className="flex-1 bg-primary text-primary-foreground h-12 rounded-xl font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
                data-testid="pos-payment-confirm"
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
                aria-label="Close"
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
