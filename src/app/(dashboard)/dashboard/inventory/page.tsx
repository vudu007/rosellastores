'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Package, Search, Filter, AlertCircle, CheckCircle2, 
  ArrowUpRight, MoreHorizontal, LayoutGrid, List,
  Edit, Trash2, Eye, History, Plus
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string;
  stockQty: number;
  lowStockThreshold: number;
  retailPrice: number;
  wholesalePrice: number;
  category: { name: string };
}

export default function InventoryPage() {
  const { data: session } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

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

  return (
    <div className="p-8 space-y-8 animate-entrance">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Management</h1>
          <p className="text-muted-foreground mt-1">Track and manage your entire product catalog and stock levels.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary flex items-center gap-2">
            <History className="w-4 h-4" />
            Stock History
          </button>
          <button className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add New Product
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
                            <button className="p-2 hover:bg-primary/10 text-primary rounded-lg" title="View Details">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors" title="Edit">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button className="p-2 hover:bg-destructive/10 text-destructive rounded-lg" title="Remove">
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
                        <button className="p-1.5 hover:bg-muted rounded-md transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                        <button className="p-1.5 hover:bg-destructive/10 text-destructive rounded-md transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                 )
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
