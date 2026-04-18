'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Package, Search, Filter, AlertCircle, CheckCircle2, 
  ArrowUpRight, MoreHorizontal, LayoutGrid, List,
  Edit, Trash2, Eye, History, Plus, Truck, X, PackagePlus, Upload, Download
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  stockQty: number;
  lowStockThreshold: number;
  retailPrice: number;
  wholesalePrice: number;
  unit?: string;
  categoryId?: string;
  supplierId?: string;
  category: { name: string };
}

interface CategoryOption { id: string; name: string; }
interface SupplierOption { id: string; name: string; }

const emptyProductForm = {
  name: '', sku: '', barcode: '', categoryId: '', supplierId: '',
  retailPrice: '', wholesalePrice: '', stockQty: '', lowStockThreshold: '10', unit: 'pcs',
};

export default function InventoryPage() {
  const { data: session } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState('');
  const [restockLoading, setRestockLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [productSaving, setProductSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editProductForm, setEditProductForm] = useState(emptyProductForm);
  const [editSaving, setEditSaving] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const headers = ['name', 'sku', 'barcode', 'categoryId', 'supplierId', 'retailPrice', 'wholesalePrice', 'stockQty', 'lowStockThreshold', 'unit'];
    const example = ['Sample Product', 'SKU-001', '', categories[0]?.id || 'cat_id', suppliers[0]?.id || 'sup_id', '1500', '1200', '50', '10', 'pcs'];
    const csv = [headers.join(','), example.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    import('papaparse').then((Papa) => {
      Papa.default.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results: any) => {
          try {
            const res = await fetch('/api/products/bulk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(results.data),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to import');
            
            setToast({ type: 'success', message: `${data.message}` });
            
            const params = new URLSearchParams();
            if (lowStockOnly) params.append('lowStockOnly', 'true');
            const prods = await (await fetch(`/api/inventory?${params}`)).json();
            setProducts(prods);
          } catch (err: any) {
            setToast({ type: 'error', message: err.message || 'Import failed' });
          } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        },
        error: (err: any) => {
          setToast({ type: 'error', message: `CSV Parse Error: ${err.message}` });
          setImporting(false);
        }
      });
    });
  };

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }
  }, [toast]);

  // Fetch categories and suppliers for the Add Product form
  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/suppliers').then(r => r.json()).then(d => setSuppliers(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const handleRestock = async () => {
    if (!restockProduct || !restockQty || parseInt(restockQty) <= 0) {
      setToast({ type: 'error', message: 'Enter a valid quantity' });
      return;
    }
    setRestockLoading(true);
    try {
      const res = await fetch('/api/inventory/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: restockProduct.id, qty: parseInt(restockQty) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setToast({ type: 'success', message: data.message });
      setRestockProduct(null);
      setRestockQty('');
      // Refresh product list
      const products = await (await fetch(`/api/inventory?${lowStockOnly ? 'lowStockOnly=true' : ''}`)).json();
      setProducts(products);
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Restock failed' });
    } finally {
      setRestockLoading(false);
    }
  };

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const params = new URLSearchParams();
        if (lowStockOnly) {
          params.append('lowStockOnly', 'true');
        }
        const response = await fetch(`/api/inventory?${params}`);
        const data = await response.json();
        setProducts(data);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [lowStockOnly]);

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(search.toLowerCase()) ||
    product.sku.toLowerCase().includes(search.toLowerCase())
  );

  const getStockStatus = (current: number, threshold: number) => {
    if (current === 0) return { label: 'Out of Stock', color: 'text-red-600 bg-red-50 border-red-100', icon: <AlertCircle className="w-3 h-3" /> };
    if (current <= threshold / 2) return { label: 'Critical', color: 'text-rose-600 bg-rose-50 border-rose-100', icon: <AlertCircle className="w-3 h-3" /> };
    if (current <= threshold) return { label: 'Low Stock', color: 'text-amber-600 bg-amber-50 border-amber-100', icon: <AlertCircle className="w-3 h-3" /> };
    return { label: 'Healthy', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: <CheckCircle2 className="w-3 h-3" /> };
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleAddProduct = async () => {
    const f = productForm;
    if (!f.name || !f.sku || !f.categoryId || !f.supplierId || !f.retailPrice || !f.wholesalePrice) {
      setToast({ type: 'error', message: 'Please fill in all required fields' });
      return;
    }
    setProductSaving(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: f.name,
          sku: f.sku,
          barcode: f.barcode || undefined,
          categoryId: f.categoryId,
          supplierId: f.supplierId,
          retailPrice: parseFloat(f.retailPrice),
          wholesalePrice: parseFloat(f.wholesalePrice),
          stockQty: parseInt(f.stockQty) || 0,
          lowStockThreshold: parseInt(f.lowStockThreshold) || 10,
          unit: f.unit || 'pcs',
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(Array.isArray(d.error) ? d.error.map((e: any) => e.message).join(', ') : d.error);
      }
      setToast({ type: 'success', message: `"${f.name}" added to inventory` });
      setShowAddProduct(false);
      setProductForm(emptyProductForm);
      // Refresh inventory
      const prods = await (await fetch(`/api/inventory?${lowStockOnly ? 'lowStockOnly=true' : ''}`)).json();
      setProducts(prods);
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to add product' });
    } finally {
      setProductSaving(false);
    }
  };

  const openEditProduct = async (product: Product) => {
    setEditingProduct(product);
    // Pre-fill with what we know from the list
    setEditProductForm({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || '',
      categoryId: product.categoryId || '',
      supplierId: product.supplierId || '',
      retailPrice: product.retailPrice.toString(),
      wholesalePrice: product.wholesalePrice.toString(),
      stockQty: product.stockQty.toString(),
      lowStockThreshold: product.lowStockThreshold.toString(),
      unit: product.unit || 'pcs',
    });
    // Fetch full product to get categoryId and supplierId
    try {
      const res = await fetch(`/api/products/${product.id}`);
      if (res.ok) {
        const full = await res.json();
        setEditProductForm((prev) => ({
          ...prev,
          barcode: full.barcode || '',
          categoryId: full.categoryId || '',
          supplierId: full.supplierId || '',
          unit: full.unit || 'pcs',
        }));
      }
    } catch { /* keep pre-filled values if fetch fails */ }
  };

  const handleEditProduct = async () => {
    if (!editingProduct) return;
    const f = editProductForm;
    if (!f.name || !f.sku || !f.retailPrice || !f.wholesalePrice) {
      setToast({ type: 'error', message: 'Please fill in required fields' });
      return;
    }
    setEditSaving(true);
    try {
      const body: Record<string, any> = {
        name: f.name,
        sku: f.sku,
        retailPrice: parseFloat(f.retailPrice),
        wholesalePrice: parseFloat(f.wholesalePrice),
        lowStockThreshold: parseInt(f.lowStockThreshold) || 10,
      };
      if (f.categoryId) body.categoryId = f.categoryId;
      if (f.supplierId) body.supplierId = f.supplierId;
      if (f.barcode) body.barcode = f.barcode;
      if (f.unit) body.unit = f.unit;

      const res = await fetch(`/api/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(Array.isArray(d.error) ? d.error.map((e: any) => e.message).join(', ') : d.error);
      }
      setToast({ type: 'success', message: `"${f.name}" updated` });
      setEditingProduct(null);
      const prods = await (await fetch(`/api/inventory?${lowStockOnly ? 'lowStockOnly=true' : ''}`)).json();
      setProducts(prods);
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to update product' });
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!confirm(`Deactivate "${product.name}"? It will be hidden from inventory.`)) return;
    setDeletingProductId(product.id);
    try {
      const res = await fetch(`/api/products/${product.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to deactivate');
      setToast({ type: 'success', message: `"${product.name}" deactivated` });
      const prods = await (await fetch(`/api/inventory?${lowStockOnly ? 'lowStockOnly=true' : ''}`)).json();
      setProducts(prods);
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to deactivate product' });
    } finally {
      setDeletingProductId(null);
    }
  };

  return (
    <div className="p-8 space-y-8 animate-entrance">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Management</h1>
          <p className="text-muted-foreground mt-1">Track and manage your entire product catalog and stock levels.</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
          
          <button onClick={downloadTemplate} className="btn-secondary h-10 px-3 flex items-center justify-center gap-2" title="Download CSV Template">
            <Download className="w-4 h-4" />
          </button>
          
          <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="btn-secondary h-10 px-4 flex items-center justify-center gap-2">
            {importing ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent flex-shrink-0" /> : <Upload className="w-4 h-4" />}
            <span className="hidden sm:inline font-medium">Import CSV</span>
          </button>

          <button onClick={() => setShowAddProduct(true)} className="btn-primary h-10 px-4 flex items-center justify-center gap-2 shadow-lg hover:shadow-primary/25 transition-all">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline font-medium">Add Product</span>
          </button>
        </div>
      </div>

      <div className="card-premium p-4 flex flex-col md:flex-row items-center gap-6">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by product name, SKU, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-10 h-11 bg-muted/30 border-none shadow-none focus:ring-1"
          />
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <label className="flex items-center gap-2 cursor-pointer bg-muted/40 px-3 py-2 rounded-lg border border-transparent hover:border-border transition-colors">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="w-4 h-4 rounded text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium">Low Stock Alerts</span>
          </label>
          
          <div className="h-8 w-[1px] bg-border hidden md:block" />
          
          <div className="flex bg-muted rounded-lg p-1">
            <button 
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent mb-4"></div>
          <p className="text-muted-foreground font-medium">Synchronizing inventory data...</p>
        </div>
      ) : (
        <>
          {viewMode === 'table' ? (
            <div className="card-premium overflow-hidden border-none shadow-xl">
              <table className="w-full text-left">
                <thead className="bg-muted/50 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Product Details</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Inventory Status</th>
                    <th className="px-6 py-4 text-right">Mkt Price</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredProducts.map((product) => {
                    const status = getStockStatus(product.stockQty, product.lowStockThreshold);
                    return (
                      <tr key={product.id} className="group hover:bg-muted/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                              <Package className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground">{product.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-semibold px-2 py-1 rounded-md bg-muted text-muted-foreground">
                            {product.category.name}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${status.color}`}>
                                {status.icon}
                                {status.label}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-muted-foreground">
                              {product.stockQty} <span className="text-[10px] opacity-70">available</span>
                              <span className="mx-1 opacity-20">/</span>
                              <span className="text-[10px] opacity-70">Min: {product.lowStockThreshold}</span>
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <p className="text-sm font-bold text-foreground">{formatCurrency(product.retailPrice)}</p>
                            <p className="text-[10px] text-muted-foreground font-medium">WS: {formatCurrency(product.wholesalePrice)}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setRestockProduct(product)} className="p-2 hover:bg-green-100 text-green-600 rounded-lg transition-colors" title="Restock">
                              <PackagePlus className="w-4 h-4" />
                            </button>
                            <button className="p-2 hover:bg-primary/10 text-primary rounded-lg" title="View Details">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button onClick={() => openEditProduct(product)} className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors" title="Edit">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteProduct(product)} disabled={deletingProductId === product.id} className="p-2 hover:bg-destructive/10 text-destructive rounded-lg disabled:opacity-40" title="Deactivate">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="group-hover:hidden">
                            <MoreHorizontal className="w-5 h-5 text-muted-foreground ml-auto" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredProducts.length === 0 && (
                <div className="p-20 text-center space-y-3">
                  <Package className="w-12 h-12 text-muted-foreground/20 mx-auto" />
                  <p className="text-muted-foreground font-medium">No inventory items found</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((product) => {
                 const status = getStockStatus(product.stockQty, product.lowStockThreshold);
                 return (
                  <div key={product.id} className="card-premium group relative flex flex-col p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <Package className="w-6 h-6" />
                      </div>
                      <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${status.color}`}>
                        {status.icon}
                        {status.label}
                      </span>
                    </div>

                    <div className="flex-1">
                      <h4 className="font-bold text-base mb-1 line-clamp-1 group-hover:text-primary transition-colors">{product.name}</h4>
                      <p className="text-xs text-muted-foreground font-mono mb-4">{product.sku}</p>
                      
                      <div className="grid grid-cols-2 gap-4 pb-4 border-b">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold mb-0.5">Stock Level</p>
                          <p className="font-bold text-base">{product.stockQty} <span className="text-[10px] font-normal">units</span></p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold mb-0.5">Retail Price</p>
                          <p className="font-bold text-base text-primary">{formatCurrency(product.retailPrice)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                        {product.category.name}
                      </span>
                      <div className="flex gap-1">
                        <button onClick={() => setRestockProduct(product)} className="p-1.5 hover:bg-green-100 text-green-600 rounded-md transition-colors" title="Restock"><PackagePlus className="w-3.5 h-3.5" /></button>
                        <button onClick={() => openEditProduct(product)} className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-md transition-colors" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeleteProduct(product)} disabled={deletingProductId === product.id} className="p-1.5 hover:bg-destructive/10 text-destructive rounded-md transition-colors disabled:opacity-40" title="Deactivate"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                 )
              })}
            </div>
          )}
        </>
      )}
      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-5 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Edit className="w-5 h-5 text-primary" /> Edit Product
              </h2>
              <button onClick={() => setEditingProduct(null)} className="p-2 rounded-lg hover:bg-muted/50"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-foreground">Product Name *</label>
                <input value={editProductForm.name} onChange={(e) => setEditProductForm({...editProductForm, name: e.target.value})} className="input-base mt-1" placeholder="Product name" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">SKU *</label>
                <input value={editProductForm.sku} onChange={(e) => setEditProductForm({...editProductForm, sku: e.target.value})} className="input-base mt-1" placeholder="e.g. FOOD-001" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Barcode</label>
                <input value={editProductForm.barcode} onChange={(e) => setEditProductForm({...editProductForm, barcode: e.target.value})} className="input-base mt-1" placeholder="Optional" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Category</label>
                <select value={editProductForm.categoryId} onChange={(e) => setEditProductForm({...editProductForm, categoryId: e.target.value})} className="input-base mt-1">
                  <option value="">Keep current ({editingProduct.category.name})</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Supplier</label>
                <select value={editProductForm.supplierId} onChange={(e) => setEditProductForm({...editProductForm, supplierId: e.target.value})} className="input-base mt-1">
                  <option value="">Keep current</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Retail Price (₦) *</label>
                <input type="number" min="0" step="0.01" value={editProductForm.retailPrice} onChange={(e) => setEditProductForm({...editProductForm, retailPrice: e.target.value})} className="input-base mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Wholesale Price (₦) *</label>
                <input type="number" min="0" step="0.01" value={editProductForm.wholesalePrice} onChange={(e) => setEditProductForm({...editProductForm, wholesalePrice: e.target.value})} className="input-base mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Low Stock Alert At</label>
                <input type="number" min="0" value={editProductForm.lowStockThreshold} onChange={(e) => setEditProductForm({...editProductForm, lowStockThreshold: e.target.value})} className="input-base mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Unit of Measure</label>
                <select value={editProductForm.unit} onChange={(e) => setEditProductForm({...editProductForm, unit: e.target.value})} className="input-base mt-1">
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="g">Grams (g)</option>
                  <option value="L">Litres (L)</option>
                  <option value="ml">Millilitres (ml)</option>
                  <option value="bag">Bag</option>
                  <option value="carton">Carton</option>
                  <option value="bottle">Bottle</option>
                  <option value="pack">Pack</option>
                  <option value="dozen">Dozen</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditingProduct(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleEditProduct} disabled={editSaving} className="btn-primary flex-1 gap-2 flex items-center justify-center">
                {editSaving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <><Edit className="w-4 h-4" /> Save Changes</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-5 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" /> Add New Product
              </h2>
              <button onClick={() => setShowAddProduct(false)} className="p-2 rounded-lg hover:bg-muted/50"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-foreground">Product Name *</label>
                <input value={productForm.name} onChange={(e) => setProductForm({...productForm, name: e.target.value})} className="input-base mt-1" placeholder="e.g. Golden Penny Semovita 2kg" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">SKU *</label>
                <input value={productForm.sku} onChange={(e) => setProductForm({...productForm, sku: e.target.value})} className="input-base mt-1" placeholder="e.g. FOOD-001" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Barcode</label>
                <input value={productForm.barcode} onChange={(e) => setProductForm({...productForm, barcode: e.target.value})} className="input-base mt-1" placeholder="Scan or type barcode" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Category *</label>
                <select value={productForm.categoryId} onChange={(e) => setProductForm({...productForm, categoryId: e.target.value})} className="input-base mt-1">
                  <option value="">Select category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {categories.length === 0 && <p className="text-xs text-amber-600 mt-1">No categories yet — create one in Dashboard → Categories first.</p>}
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Supplier *</label>
                <select value={productForm.supplierId} onChange={(e) => setProductForm({...productForm, supplierId: e.target.value})} className="input-base mt-1">
                  <option value="">Select supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {suppliers.length === 0 && <p className="text-xs text-amber-600 mt-1">No suppliers yet — add one in Dashboard → Suppliers first.</p>}
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Retail Price (₦) *</label>
                <input type="number" min="0" step="0.01" value={productForm.retailPrice} onChange={(e) => setProductForm({...productForm, retailPrice: e.target.value})} className="input-base mt-1" placeholder="e.g. 2500" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Wholesale Price (₦) *</label>
                <input type="number" min="0" step="0.01" value={productForm.wholesalePrice} onChange={(e) => setProductForm({...productForm, wholesalePrice: e.target.value})} className="input-base mt-1" placeholder="e.g. 2000" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Initial Stock Qty</label>
                <input type="number" min="0" value={productForm.stockQty} onChange={(e) => setProductForm({...productForm, stockQty: e.target.value})} className="input-base mt-1" placeholder="e.g. 100" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Low Stock Alert At</label>
                <input type="number" min="0" value={productForm.lowStockThreshold} onChange={(e) => setProductForm({...productForm, lowStockThreshold: e.target.value})} className="input-base mt-1" placeholder="e.g. 10" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Unit of Measure</label>
                <select value={productForm.unit} onChange={(e) => setProductForm({...productForm, unit: e.target.value})} className="input-base mt-1">
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="g">Grams (g)</option>
                  <option value="L">Litres (L)</option>
                  <option value="ml">Millilitres (ml)</option>
                  <option value="bag">Bag</option>
                  <option value="carton">Carton</option>
                  <option value="bottle">Bottle</option>
                  <option value="pack">Pack</option>
                  <option value="dozen">Dozen</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAddProduct(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleAddProduct} disabled={productSaving} className="btn-primary flex-1 gap-2 flex items-center justify-center">
                {productSaving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <><Plus className="w-4 h-4" /> Add Product</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-slide-up ${toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Restock Modal */}
      {restockProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <PackagePlus className="w-5 h-5 text-green-600" /> Restock Product
              </h2>
              <button onClick={() => setRestockProduct(null)} className="p-2 rounded-lg hover:bg-muted/50"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-4 bg-muted/30 rounded-xl">
              <p className="font-bold text-foreground">{restockProduct.name}</p>
              <p className="text-sm text-muted-foreground font-mono">{restockProduct.sku}</p>
              <p className="text-sm text-muted-foreground mt-1">Current stock: <span className="font-bold text-foreground">{restockProduct.stockQty} units</span></p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Quantity to Add *</label>
              <input
                type="number"
                min="1"
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
                className="input-base mt-1"
                placeholder="e.g. 50"
                autoFocus
              />
              {restockQty && parseInt(restockQty) > 0 && (
                <p className="text-xs text-green-600 mt-1 font-medium">
                  New stock level: {restockProduct.stockQty + parseInt(restockQty)} units
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setRestockProduct(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleRestock} disabled={restockLoading} className="btn-primary flex-1 gap-2 flex items-center justify-center">
                {restockLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <><PackagePlus className="w-4 h-4" /> Confirm Restock</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
