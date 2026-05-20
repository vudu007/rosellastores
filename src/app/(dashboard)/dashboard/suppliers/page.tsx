'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Truck, Search, Plus, Edit, Trash2, Phone, Mail, MapPin, Package, X, Save, AlertCircle, CheckCircle2
} from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  contact: string;
  email: string | null;
  phone: string;
  address: string | null;
  createdAt: string;
  _count: { products: number };
}

export default function SuppliersPage() {
  const { data: session } = useSession();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [form, setForm] = useState({ name: '', contact: '', email: '', phone: '', address: '' });
  const canDelete = session?.user?.role === 'ADMIN' || session?.user?.role === 'OWNER';

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers?includeInactive=true');
      const data = await res.json();
      setSuppliers(data);
    } catch {
      setToast({ type: 'error', message: 'Failed to fetch suppliers' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', contact: '', email: '', phone: '', address: '' });
    setShowModal(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({ name: s.name, contact: s.contact, email: s.email || '', phone: s.phone, address: s.address || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.contact || !form.phone) {
      setToast({ type: 'error', message: 'Name, contact person, and phone are required' });
      return;
    }
    try {
      const method = editing ? 'PUT' : 'POST';
      const body = editing ? { id: editing.id, ...form } : form;
      const res = await fetch('/api/suppliers', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setToast({ type: 'success', message: editing ? 'Supplier updated' : 'Supplier added' });
      setShowModal(false);
      fetchSuppliers();
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to save' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!canDelete) return;
    const reason = prompt(`Reason for deleting "${name}" (required):`)?.trim();
    if (!reason) return;
    try {
      const res = await fetch(`/api/suppliers?id=${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setToast({ type: 'success', message: `${name} deleted (soft)` });
      fetchSuppliers();
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to delete' });
    }
  };

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.contact.toLowerCase().includes(search.toLowerCase())
  );

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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Suppliers</h1>
          <p className="text-muted-foreground mt-1">Manage your product suppliers and vendor relationships.</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Supplier
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search suppliers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-base pl-10"
        />
      </div>

      {/* Supplier Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-premium p-12 text-center">
          <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg text-foreground">No suppliers yet</h3>
          <p className="text-muted-foreground mt-1">Add your first supplier to start managing your supply chain.</p>
          <button onClick={openNew} className="btn-primary mt-4 gap-2 inline-flex items-center">
            <Plus className="w-4 h-4" /> Add First Supplier
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((supplier) => (
            <div key={supplier.id} className="card-premium p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                    <Truck className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(supplier)} className="p-2 rounded-lg hover:bg-muted/50 transition-colors" title="Edit">
                      <Edit className="w-4 h-4 text-muted-foreground" />
                    </button>
                    {canDelete && (
                      <button onClick={() => handleDelete(supplier.id, supplier.name)} className="p-2 rounded-lg hover:bg-red-50 transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </div>
                </div>
                <h3 className="text-lg font-bold text-foreground mt-4">{supplier.name}</h3>
                <p className="text-sm text-muted-foreground">{supplier.contact}</p>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                {supplier.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-3.5 h-3.5" /> {supplier.phone}
                  </div>
                )}
                {supplier.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-3.5 h-3.5" /> {supplier.email}
                  </div>
                )}
                {supplier.address && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5" /> {supplier.address}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2 border-t mt-3">
                  <Package className="w-3.5 h-3.5 text-primary" />
                  <span className="text-primary font-semibold">{supplier._count.products} products</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">{editing ? 'Edit Supplier' : 'New Supplier'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-muted/50"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Company Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-base mt-1" placeholder="e.g. Premium Foods Ltd" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Contact Person *</label>
                <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} className="input-base mt-1" placeholder="e.g. John Doe" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Phone *</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-base mt-1" placeholder="+234-xxx-xxx" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Email</label>
                  <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-base mt-1" placeholder="supplier@email.com" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Address</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input-base mt-1" placeholder="Full address" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSave} className="btn-primary flex-1 gap-2 flex items-center justify-center">
                <Save className="w-4 h-4" /> {editing ? 'Update' : 'Add Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
