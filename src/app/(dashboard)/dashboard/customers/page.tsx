'use client';

import { useEffect, useState, useCallback } from 'react';

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  type: 'RETAIL' | 'WHOLESALE';
  creditLimit: number | null;
  creditUsed: number;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<'RETAIL' | 'WHOLESALE' | ''>('');
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    type: 'RETAIL' as 'RETAIL' | 'WHOLESALE',
    creditLimit: '',
  });

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

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : undefined,
        }),
      });

      if (response.ok) {
        setFormData({ name: '', email: '', phone: '', type: 'RETAIL', creditLimit: '' });
        setShowAddForm(false);
        fetchCustomers();
      }
    } catch (error) {
      console.error('Error adding customer:', error);
    }
  };

  const filteredCustomers = customers.filter((customer) =>
    customer.name.toLowerCase().includes(search.toLowerCase()) ||
    (customer.email?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
        <p className="text-gray-600 mt-2">Manage retail and wholesale customers</p>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base w-full"
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as any)}
          className="input-base max-w-xs"
        >
          <option value="">All Types</option>
          <option value="RETAIL">Retail</option>
          <option value="WHOLESALE">Wholesale</option>
        </select>
        <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary">
          {showAddForm ? 'Cancel' : '+ Add Customer'}
        </button>
      </div>

      {showAddForm && (
        <div className="card p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Add New Customer</h2>
          <form onSubmit={handleAddCustomer} className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Customer Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-base"
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input-base"
            />
            <input
              type="tel"
              placeholder="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="input-base"
            />
            <select
              value={formData.type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  type: e.target.value as 'RETAIL' | 'WHOLESALE',
                })
              }
              className="input-base"
            >
              <option value="RETAIL">Retail</option>
              <option value="WHOLESALE">Wholesale</option>
            </select>
            {formData.type === 'WHOLESALE' && (
              <input
                type="number"
                placeholder="Credit Limit"
                value={formData.creditLimit}
                onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                className="input-base"
              />
            )}
            <button type="submit" className="btn-primary col-span-2">
              Add Customer
            </button>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Credit
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {customer.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{customer.email || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{customer.phone || '-'}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`badge ${
                        customer.type === 'RETAIL' ? 'badge-primary' : 'badge-success'
                      }`}
                    >
                      {customer.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {customer.type === 'WHOLESALE'
                      ? `₦${(customer.creditUsed ?? 0).toLocaleString()} / ₦${(customer.creditLimit ?? 0).toLocaleString()}`
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
