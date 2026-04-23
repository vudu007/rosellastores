'use client';

import { useEffect, useState, useCallback } from 'react';
import { Edit3, Trash2, X, Plus, Search, Users } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { Customer } from '@/types';
import { CustomerForm } from '@/components/dashboard/CustomerForm';
import { deleteCustomerAction } from '@/app/actions/customer.actions';

export default function CustomersPage() {
  const { data: session } = useSession();
  const canEdit = ['OWNER', 'MANAGER'].includes(session?.user.role ?? '');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<'RETAIL' | 'WHOLESALE' | ''>('');
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
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

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    setShowAddForm(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete customer "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await deleteCustomerAction(id);
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
      (c.email?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (c.phone?.includes(search) ?? false)
  );

  const activeForm = showAddForm || !!editingCustomer;

  return (
    <div className="p-6 md:p-8 space-y-6 animate-entrance">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Manage retail and wholesale customer accounts</p>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setEditingCustomer(null);
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm ${
              activeForm
                ? 'bg-destructive/10 text-destructive hover:bg-destructive/20 shadow-none'
                : 'btn-primary'
            }`}
          >
            {activeForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {activeForm ? 'Cancel' : 'Add Customer'}
          </button>
        )}
      </div>

      {/* Add / Edit Form */}
      {activeForm && canEdit && (
        <CustomerForm
          editingCustomer={editingCustomer}
          onSuccess={() => {
            setShowAddForm(false);
            setEditingCustomer(null);
            fetchCustomers();
          }}
          onCancel={() => {
            setShowAddForm(false);
            setEditingCustomer(null);
          }}
        />
      )}

      {/* Toolbar */}
      <div className="toolbar">
        {/* Search with icon */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, email or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-10 w-full bg-muted/30 border-none"
          />
        </div>

        {/* Type filter */}
        <select
          value={type}
          onChange={(e) => setType(e.target.value as any)}
          className="input-base w-full sm:w-44 bg-muted/30 border-none"
        >
          <option value="">All Types</option>
          <option value="RETAIL">Retail</option>
          <option value="WHOLESALE">Wholesale</option>
        </select>

        {/* Count badge */}
        <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">
          {filteredCustomers.length} of {customers.length}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent mb-4" />
          <p className="text-muted-foreground font-medium">Loading customers…</p>
        </div>
      ) : (
        <div className="card-premium overflow-hidden border-none shadow-xl">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>Type</th>
                  <th>Credit Usage</th>
                  {canEdit && <th className="text-center">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 5 : 4} className="py-16 text-center text-muted-foreground">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="font-medium">{search ? 'No customers match your search.' : 'No customers yet.'}</p>
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="group">
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-black shrink-0">
                            {customer.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-foreground">{customer.name}</span>
                        </div>
                      </td>
                      <td>
                        <p className="text-foreground">{customer.email || '—'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{customer.phone || '—'}</p>
                      </td>
                      <td>
                        <span className={customer.type === 'RETAIL' ? 'badge-primary' : 'badge-success'}>
                          {customer.type}
                        </span>
                      </td>
                      <td>
                        {customer.type === 'WHOLESALE' ? (
                          <div>
                            <p className="text-foreground font-medium">
                              ₦{(customer.creditUsed ?? 0).toLocaleString()}{' '}
                              <span className="text-muted-foreground font-normal">
                                / ₦{(customer.creditLimit ?? 0).toLocaleString()}
                              </span>
                            </p>
                            {customer.creditLimit ? (
                              <div className="mt-1.5 h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      ((customer.creditUsed ?? 0) / customer.creditLimit) * 100
                                    )}%`,
                                  }}
                                />
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      {canEdit && (
                        <td>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEdit(customer)}
                              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(customer.id, customer.name)}
                              disabled={deletingId === customer.id}
                              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-40"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
