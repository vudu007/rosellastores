'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  FolderTree, Plus, Edit, Trash2, X, Save, AlertCircle, CheckCircle2,
  Search, Package, ChevronRight, FolderOpen
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  parentId: string | null;
  parent: { id: string; name: string } | null;
  _count: { products: number };
}

export default function CategoriesPage() {
  const { data: session } = useSession();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [form, setForm] = useState({ name: '', parentId: '' });

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }
  }, [toast]);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(data);
    } catch {
      setToast({ type: 'error', message: 'Failed to fetch categories' });
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', parentId: '' });
    setShowModal(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setForm({ name: c.name, parentId: c.parentId || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setToast({ type: 'error', message: 'Category name is required' });
      return;
    }
    try {
      const method = editing ? 'PUT' : 'POST';
      const body = editing ? { id: editing.id, ...form } : form;
      const res = await fetch('/api/categories', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setToast({ type: 'success', message: editing ? 'Category updated' : 'Category created' });
      setShowModal(false);
      fetchCategories();
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to save' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/categories?id=${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setToast({ type: 'success', message: `"${name}" deleted` });
      fetchCategories();
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to delete' });
    }
  };

  const parentCategories = categories.filter(c => !c.parentId);
  const filtered = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  // Group categories by parent
  const topLevel = filtered.filter(c => !c.parentId);
  const getChildren = (parentId: string) => filtered.filter(c => c.parentId === parentId);

  return (
    <div className="p-4 md:p-8 space-y-6 animate-entrance">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-4 right-4 sm:top-6 sm:left-auto sm:right-6 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-slide-up ${toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Categories</h1>
          <p className="text-muted-foreground mt-1">Organize your products into categories and sub-categories.</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Category
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search categories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-base pl-10"
        />
      </div>

      {/* Categories */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-premium p-12 text-center">
          <FolderTree className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg text-foreground">No categories yet</h3>
          <p className="text-muted-foreground mt-1">Create your first product category to start organizing inventory.</p>
          <button onClick={openNew} className="btn-primary mt-4 gap-2 inline-flex items-center">
            <Plus className="w-4 h-4" /> Create First Category
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {topLevel.map((category) => {
            const children = getChildren(category.id);
            return (
              <div key={category.id}>
                {/* Parent category */}
                <div className="card-premium p-4 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-violet-100 dark:bg-violet-900/30 rounded-xl">
                      <FolderOpen className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">{category.name}</h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {category._count.products} products</span>
                        {children.length > 0 && (
                          <span className="flex items-center gap-1"><FolderTree className="w-3 h-3" /> {children.length} sub-categories</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(category)} className="p-2 rounded-lg hover:bg-muted/50 transition-colors" title="Edit">
                      <Edit className="w-4 h-4 text-muted-foreground" />
                    </button>
                    {session?.user.role === 'OWNER' && (
                      <button onClick={() => handleDelete(category.id, category.name)} className="p-2 rounded-lg hover:bg-red-50 transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </div>
                </div>
                {/* Child categories */}
                {children.length > 0 && (
                  <div className="ml-8 mt-1 space-y-1">
                    {children.map((child) => (
                      <div key={child.id} className="card-premium p-3 flex items-center justify-between group border-l-2 border-violet-200">
                        <div className="flex items-center gap-3">
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <h4 className="font-semibold text-sm text-foreground">{child.name}</h4>
                            <span className="text-xs text-muted-foreground">{child._count.products} products</span>
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(child)} className="p-1.5 rounded-lg hover:bg-muted/50"><Edit className="w-3.5 h-3.5 text-muted-foreground" /></button>
                          {session?.user.role === 'OWNER' && (
                            <button onClick={() => handleDelete(child.id, child.name)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">{editing ? 'Edit Category' : 'New Category'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-muted/50"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Category Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-base mt-1" placeholder="e.g. Beverages, Dairy, Snacks" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Parent Category (optional)</label>
                <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })} className="input-base mt-1">
                  <option value="">None — top-level category</option>
                  {parentCategories
                    .filter(c => c.id !== editing?.id) // Prevent self-parenting
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))
                  }
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSave} className="btn-primary flex-1 gap-2 flex items-center justify-center">
                <Save className="w-4 h-4" /> {editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
