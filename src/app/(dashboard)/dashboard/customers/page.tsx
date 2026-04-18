'use client';

import { useEffect, useState, useCallback } from 'react';
import { Edit3, Trash2, X, Plus } from 'lucide-react';
import { useSession } from 'next-auth/react';

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  type: 'RETAIL' | 'WHOLESALE';
  creditLimit: number | null;
  creditUsed: number;
}

const emptyForm = { name: '', email: '', phone: '', type: 'RETAIL' as 'RETAIL' | 'WHOLESALE', creditLimit: '' };

export default function CustomersPage() {
  const { data: session } = useSession();
  const canEdit = ['OWNER', 'MANAGER'].includes(session?.user.role ?? '');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<'RETAIL' | 'WHOLESALE' | ''>('');
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (type) params.append('type', type);
      params.append('limit', '100');
      const response = await fetch(`/api/customers?${params}`);
      const data = await response.json();
      setCustomers(data.customers);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({ name: c.name, email: c.email ?? '', phone: c.phone ?? '', type: c.type, creditLimit: c.creditLimit?.toString() ?? '' });
    setShowAddForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...formData, creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : null };
      const isEdit = !!editingCustomer;
      const response = await fetch(isEdit ? `/api/customers/${editingCustomer.id}` : '/api/customers', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        setFormData(emptyForm);
        setShowAddForm(false);
        setEditingCustomer(null);
        fetchCustomers();
      }
    } catch (error) {
      console.error('Error saving customer:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete customer "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const activeForm = showAddForm || !!editingCustomer;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
        <p className="text-gray-600 mt-2">Manage retail and wholesale customers</p>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <input type="text" placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-base w-full" />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value as any)} className="input-base max-w-xs">
          <option value="">All Types</option>
          <option value="RETAIL">Retail</option>
          <option value="WHOLESALE">Wholesale</option>
        </select>
        <button
          onClick={() => { setShowAddForm(!showAddForm); setEditingCustomer(null); setFormData(emptyForm); }}
          className="btn-primary flex items-center gap-2"
        >
          {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAddForm ? 'Cancel' : 'Add Customer'}
        </button>
      </div>

      {activeForm && (
        <div className="card p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <input type="text" placeholder="Customer Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-base" required />
            <input type="email" placeholder="Email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="input-base" />
            <input type="tel" placeholder="Phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="input-base" />
            <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as any })} className="input-base">
              <option value="RETAIL">Retail</option>
              <option value="WHOLESALE">Wholesale</option>
            </select>
            {formData.type === 'WHOLESALE' && (
              <input type="number" placeholder="Credit Limit" value={formData.creditLimit} onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })} className="input-base" />
            )}
            <div className="col-span-2 flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
                {saving ? 'Saving...' : editingCustomer ? 'Update Customer' : 'Add Customer'}
              </button>
              <button type="button" onClick={() => { setShowAddForm(false); setEditingCustomer(null); setFormData(emptyForm); }} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading customers...</p>
        </div>
      ) : (
        <div className="overflow-x-auto card">
          <table className="w-full table-striped">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Credit</th>
                {canEdit && <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr><td colSpan={canEdit ? 6 : 5} className="px-6 py-12 text-center text-gray-500">No customers found.</td></tr>
              ) : filteredCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{customer.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{customer.email || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{customer.phone || '-'}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`badge ${customer.type === 'RETAIL' ? 'badge-primary' : 'badge-success'}`}>{customer.type}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {customer.type === 'WHOLESALE' ? `₦${(customer.creditUsed ?? 0).toLocaleString()} / ₦${(customer.creditLimit ?? 0).toLocaleString()}` : '-'}
                  </td>
                  {canEdit && (
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEdit(customer)} className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors" title="Edit">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(customer.id, customer.name)} disabled={deletingId === customer.id} className="p-1.5 hover:bg-red-100 text-red-600 rounded-lg transition-colors disabled:opacity-40" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
