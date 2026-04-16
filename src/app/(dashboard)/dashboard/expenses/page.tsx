'use client';

import { useEffect, useState } from 'react';
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

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      const response = await fetch('/api/expenses?limit=100');
      const data = await response.json();
      setExpenses(data.expenses);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
          date: new Date(formData.date).toISOString(),
        }),
      });

      if (response.ok) {
        setFormData({
          category: '',
          amount: '',
          description: '',
          date: new Date().toISOString().split('T')[0],
        });
        setShowAddForm(false);
        fetchExpenses();
      }
    } catch (error) {
      console.error('Error adding expense:', error);
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

  return (
    <div className="p-8 space-y-8 animate-entrance">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expense Ledger</h1>
          <p className="text-muted-foreground mt-1">Track operational costs and categorize business spending.</p>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)} 
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg ${
            showAddForm 
              ? 'bg-destructive/10 text-destructive hover:bg-destructive/20 shadow-none' 
              : 'bg-primary text-primary-foreground hover:shadow-primary/30'
          }`}
        >
          {showAddForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          {showAddForm ? 'Cancel Transaction' : 'Record New Expense'}
        </button>
      </div>

      {showAddForm && (
        <div className="card-premium p-8 border-none ring-1 ring-primary/20 animate-slide-up">
           <h2 className="text-xl font-black mb-6 flex items-center gap-2">
             <ArrowDownCircle className="w-6 h-6 text-primary" />
             Log New Expenditure
           </h2>
           <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
             <button type="submit" className="btn-primary lg:col-span-4 h-12 font-black text-lg mt-2">
               Save Expense Record
             </button>
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
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredExpenses.map((expense) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredExpenses.length === 0 && (
              <div className="p-20 text-center space-y-3">
                <TrendingDown className="w-12 h-12 text-muted-foreground/10 mx-auto" />
                <p className="text-muted-foreground font-medium">No expense records found.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
