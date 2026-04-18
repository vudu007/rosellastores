'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  CreditCard, Calendar, Plus, X, Search,
  TrendingDown, Trash2, Edit3, Tag, FileText,
  ArrowDownCircle, UserCircle, PieChart
} from 'lucide-react';

interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  date: string;
  user: { name: string };
}

const emptyForm = {
  category: '',
  amount: '',
  description: '',
  date: new Date().toISOString().split('T')[0],
};

export default function ExpensesPage() {
  const { data: session } = useSession();
  const canEdit = ['OWNER', 'MANAGER'].includes(session?.user.role ?? '');

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    try {
      const response = await fetch('/api/expenses?limit=100');
      const data = await response.json();
      setExpenses(data.expenses);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const openEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      category: expense.category,
      amount: expense.amount.toString(),
      description: expense.description,
      date: new Date(expense.date).toISOString().split('T')[0],
    });
    setShowAddForm(false);
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setShowAddForm(false);
    setEditingExpense(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const isEdit = !!editingExpense;
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        date: new Date(formData.date).toISOString(),
      };
      const response = await fetch(
        isEdit ? `/api/expenses/${editingExpense.id}` : '/api/expenses',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (response.ok) {
        resetForm();
        fetchExpenses();
      }
    } catch (error) {
      console.error('Error saving expense:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, description: string) => {
    if (!confirm(`Delete expense "${description}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      fetchExpenses();
    } catch (error) {
      console.error('Error deleting expense:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-NG', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const categories = [...new Set(expenses.map((e) => e.category))];
  const categoryTotals = categories.map((cat) => ({
    category: cat,
    total: expenses
      .filter((e) => e.category === cat)
      .reduce((sum, e) => sum + e.amount, 0),
  }));

  const filteredExpenses = expenses.filter(e =>
    e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeForm = showAddForm || !!editingExpense;

  return (
    <div className="p-8 space-y-8 animate-entrance">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expense Ledger</h1>
          <p className="text-muted-foreground mt-1">Track operational costs and categorize business spending.</p>
        </div>
        {canEdit && (
          <button
            onClick={() => { setShowAddForm(!showAddForm); setEditingExpense(null); setFormData(emptyForm); }}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg ${
              activeForm
                ? 'bg-destructive/10 text-destructive hover:bg-destructive/20 shadow-none'
                : 'bg-primary text-primary-foreground hover:shadow-primary/30'
            }`}
          >
            {activeForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            {activeForm ? 'Cancel' : 'Record New Expense'}
          </button>
        )}
      </div>

      {activeForm && canEdit && (
        <div className="card-premium p-8 border-none ring-1 ring-primary/20 animate-slide-up">
           <h2 className="text-xl font-black mb-6 flex items-center gap-2">
             <ArrowDownCircle className="w-6 h-6 text-primary" />
             {editingExpense ? 'Edit Expense' : 'Log New Expenditure'}
           </h2>
           <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
             <div className="space-y-1.5">
               <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Category</label>
               <input
                 type="text"
                 placeholder="e.g. Utilities, Salary, Rent"
                 value={formData.category}
                 onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                 className="input-base bg-muted/30 border-none h-12"
                 required
               />
             </div>
             <div className="space-y-1.5">
               <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Amount (₦)</label>
               <input
                 type="number"
                 placeholder="0.00"
                 value={formData.amount}
                 onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                 className="input-base bg-muted/30 border-none h-12"
                 step="0.01"
                 required
               />
             </div>
             <div className="space-y-1.5">
               <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Date</label>
               <input
                 type="date"
                 value={formData.date}
                 onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                 className="input-base bg-muted/30 border-none h-12"
                 required
               />
             </div>
             <div className="space-y-1.5">
               <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Description</label>
               <input
                 type="text"
                 placeholder="What was this for?"
                 value={formData.description}
                 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                 className="input-base bg-muted/30 border-none h-12"
                 required
               />
             </div>
             <div className="lg:col-span-4 flex gap-3">
               <button type="submit" disabled={saving} className="btn-primary flex-1 h-12 font-black text-lg mt-2 disabled:opacity-50">
                 {saving ? 'Saving...' : editingExpense ? 'Update Expense' : 'Save Expense Record'}
               </button>
               <button type="button" onClick={resetForm} className="btn-secondary h-12 mt-2 px-6">Cancel</button>
             </div>
           </form>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {categoryTotals.slice(0, 4).map((cat) => (
          <div key={cat.category} className="card-premium p-6 border-l-4 border-l-orange-500">
            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{cat.category}</p>
            <p className="text-2xl font-black text-foreground mt-2">
              {formatCurrency(cat.total)}
            </p>
          </div>
        ))}
        {categoryTotals.length === 0 && (
          <div className="col-span-4 card-premium p-10 text-center opacity-50 border-dashed border-2">
            <PieChart className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">No categorical spending data yet.</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
           <h3 className="text-lg font-bold flex items-center gap-2">
             <FileText className="w-5 h-5 text-primary" />
             Transaction History
           </h3>
           <div className="relative w-72">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
             <input
               type="text"
               placeholder="Search descriptions..."
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="input-base pl-10 bg-muted/30 border-none h-10 text-sm"
             />
           </div>
        </div>

        {loading ? (
          <div className="text-center py-20 bg-card rounded-2xl border">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent"></div>
            <p className="mt-4 text-muted-foreground font-medium">Fetching records...</p>
          </div>
        ) : (
          <div className="card-premium overflow-hidden border-none shadow-xl">
            <table className="w-full text-left">
              <thead className="bg-muted/50 text-muted-foreground text-[10px] font-black uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4">Transaction Date</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Context / Description</th>
                  <th className="px-6 py-4">Recorded By</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  {canEdit && <th className="px-6 py-4 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 6 : 5} className="p-20 text-center">
                      <TrendingDown className="w-12 h-12 text-muted-foreground/10 mx-auto mb-3" />
                      <p className="text-muted-foreground font-medium">No expense records found.</p>
                    </td>
                  </tr>
                ) : filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="group hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">{formatDate(expense.date)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400">
                        <Tag className="w-3 h-3" />
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-foreground leading-relaxed">{expense.description}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <UserCircle className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground font-medium">{expense.user.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-base font-black tracking-tight text-destructive">
                        {formatCurrency(expense.amount)}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEdit(expense)}
                            className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(expense.id, expense.description)}
                            disabled={deletingId === expense.id}
                            className="p-1.5 hover:bg-red-100 text-red-600 rounded-lg transition-colors disabled:opacity-40"
                            title="Delete"
                          >
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
    </div>
  );
}
