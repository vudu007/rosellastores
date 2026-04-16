'use client';

import { useEffect, useState } from 'react';

interface Sale {
  id: string;
  customer: { name: string };
  cashier: { name: string };
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const fetchSales = async () => {
      try {
        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('limit', '20');
        if (status) params.append('status', status);

        const response = await fetch(`/api/sales?${params}`);
        const data = await response.json();
        setSales(data.sales);
        setTotal(data.pagination.total);
      } catch (error) {
        console.error('Error fetching sales:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
  }, [page, status]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Sales History</h1>
        <p className="text-gray-600 mt-2">View all completed sales transactions</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="input-base max-w-xs"
        >
          <option value="">All Status</option>
          <option value="COMPLETED">Completed</option>
          <option value="VOIDED">Voided</option>
          <option value="HELD">Held</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading sales...</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto card mb-6">
            <table className="w-full table-striped">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Cashier
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Payment
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatDate(sale.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{sale.customer.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{sale.cashier.name}</td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                      {formatCurrency(sale.total)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {sale.paymentMethod.replace(/_/g, ' ')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`badge ${
                          sale.status === 'COMPLETED'
                            ? 'badge-success'
                            : sale.status === 'VOIDED'
                            ? 'badge-danger'
                            : 'badge-warning'
                        }`}
                      >
                        {sale.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Total: <span className="font-semibold">{total}</span> sales
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="btn-secondary disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-gray-600">Page {page}</span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={sales.length < 20}
                className="btn-secondary disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
