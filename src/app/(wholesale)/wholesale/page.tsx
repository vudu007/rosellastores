'use client';

import { useEffect, useState } from 'react';
import { Search, Package, ShoppingCart, Info, CheckCircle, ArrowRight } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string;
  wholesalePrice: number;
  stockQty: number;
  minOrderQty: number;
  category: { name: string };
}

export default function WholesalePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/products?limit=200');
        const data = await response.json();
        setProducts(data.products || []);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground font-medium">Entering Wholesale Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-zinc-950 p-4 md:p-8 space-y-10 animate-entrance">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
              <CheckCircle className="w-3 h-3" />
              Verified Wholesaler Account
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight">Wholesale Catalog</h1>
            <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
              Premium bulk ordering for your business. Select items below to request a quote or start a bulk checkout.
            </p>
          </div>
          <div className="w-full md:w-96 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter by name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-base pl-12 h-14 bg-background shadow-xl border-none text-base"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredProducts.map((product) => (
            <div key={product.id} className="card-premium group p-0 overflow-hidden flex flex-col h-full hover:scale-[1.02] transition-transform duration-300">
              <div className="aspect-[4/3] bg-muted/40 relative flex items-center justify-center overflow-hidden">
                <Package className="w-16 h-16 text-muted-foreground/20 group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute top-4 left-4">
                  <span className="bg-background/80 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                    {product.category?.name || 'Uncategorized'}
                  </span>
                </div>
              </div>

              <div className="p-6 flex flex-col flex-1">
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">
                      {product.name}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mb-4">SKU: {product.sku}</p>
                  
                  <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl mb-6">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Stock</p>
                      <p className={`font-black ${product.stockQty < 50 ? 'text-orange-600' : 'text-foreground'}`}>
                        {product.stockQty} <span className="text-[10px] font-medium">units</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Min. Order</p>
                      <p className="font-black">
                        {product.minOrderQty} <span className="text-[10px] font-medium">units</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Wholesale Price</p>
                    <p className="text-2xl font-black text-primary tracking-tighter">
                      {formatCurrency(product.wholesalePrice)}
                    </p>
                  </div>
                  
                  {product.stockQty < product.minOrderQty ? (
                    <div className="flex items-center gap-1 text-xs text-destructive font-bold bg-destructive/10 px-2 py-1 rounded-md">
                      Low Stock
                    </div>
                  ) : (
                    <div className="p-2 bg-primary/10 text-primary rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <ShoppingCart className="w-5 h-5" />
                    </div>
                  )}
                </div>

                <button 
                  disabled={product.stockQty < product.minOrderQty}
                  className="w-full mt-6 btn-primary py-3 rounded-xl flex items-center justify-center gap-2 group/btn disabled:grayscale disabled:opacity-50"
                >
                  {product.stockQty < product.minOrderQty ? 'Not Available' : (
                    <>
                      Request Bulk Quote
                      <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-32 space-y-4 bg-card rounded-3xl border border-dashed">
            <Info className="w-12 h-12 mx-auto text-muted-foreground/30" />
            <div className="space-y-1">
              <p className="text-xl font-bold text-muted-foreground">No Wholesale Match</p>
              <p className="text-muted-foreground/60 max-w-xs mx-auto">We couldn&apos;t find any products matching your search query in our wholesale catalog.</p>
            </div>
            <button 
              onClick={() => setSearchQuery('')}
              className="text-primary font-bold hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <footer className="max-w-7xl mx-auto pt-20 pb-10 text-center border-t text-muted-foreground">
        <p suppressHydrationWarning className="text-sm">MekaERP Wholesale Portal &copy; {new Date().getFullYear()}</p>
        <div className="flex justify-center gap-6 mt-4 text-xs font-semibold uppercase tracking-widest">
          <a href="#" className="hover:text-primary transition-colors">Bulk Policy</a>
          <a href="#" className="hover:text-primary transition-colors">Pricing Slab</a>
          <a href="#" className="hover:text-primary transition-colors">Support</a>
        </div>
      </footer>
    </div>
  );
}
