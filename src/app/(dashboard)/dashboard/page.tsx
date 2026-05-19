'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import {
  ShoppingBag, DollarSign, TrendingUp, Calendar,
  ArrowUpRight, ArrowDownRight, Package, Receipt, Wallet, TrendingDown
} from 'lucide-react';

interface ChartData {
  date: string;
  revenue: number;
  count: number;
}

interface CategoryData {
  name: string;
  value: number;
}

interface DashboardStats {
  todaySales: number;
  yesterdaySales: number;
  todayRevenue: number;
  yesterdayRevenue: number;
  weekRevenue: number;
  prevWeekRevenue: number;
  monthRevenue: number;
  todayTax: number;
  monthTax: number;
  todayExpenses: number;
  monthExpenses: number;
  monthNetProfit: number;
  lowStockCount: number;
  salesTrend: ChartData[];
  categoryDistribution: CategoryData[];
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

function trendPct(current: number, previous: number): string | null {
  if (previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }));
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/dashboard/stats');
        if (!response.ok) throw new Error('Failed to load stats');
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Error fetching stats:', error);
        setFetchError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(value);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground font-medium">Analyzing business data...</p>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="text-center space-y-3">
          <p className="text-lg font-bold text-foreground">Could not load dashboard data</p>
          <p className="text-sm text-muted-foreground">Check your connection or try refreshing the page.</p>
          <button onClick={() => window.location.reload()} className="btn-primary mt-2">Retry</button>
        </div>
      </div>
    );
  }

  const dailyRevenueTrend = trendPct(stats?.todayRevenue ?? 0, stats?.yesterdayRevenue ?? 0);
  const dailySalesTrend   = trendPct(stats?.todaySales ?? 0,   stats?.yesterdaySales ?? 0);
  const weeklyTrend       = trendPct(stats?.weekRevenue ?? 0,  stats?.prevWeekRevenue ?? 0);
  const profitColor       = (stats?.monthNetProfit ?? 0) >= 0 ? 'green' : 'red';

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-entrance">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Business Overview</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, <span className="text-foreground font-semibold">{session?.user.name}</span>. Here&apos;s what&apos;s happening today.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-background border rounded-lg px-4 py-2 text-sm font-medium shadow-sm">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          {currentDate}
        </div>
      </div>

      {/* Row 1 — Sales & Revenue */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Today's Revenue"
          value={formatCurrency(stats?.todayRevenue ?? 0)}
          icon={<DollarSign className="w-5 h-5" />}
          trend={dailyRevenueTrend}
          description="Selling price collected today (excl. VAT)"
          color="blue"
        />
        <StatCard
          title="Today's Sales"
          value={stats?.todaySales ?? 0}
          icon={<ShoppingBag className="w-5 h-5" />}
          trend={dailySalesTrend}
          description="vs yesterday"
          color="green"
        />
        <StatCard
          title="Weekly Revenue"
          value={formatCurrency(stats?.weekRevenue ?? 0)}
          icon={<TrendingUp className="w-5 h-5" />}
          trend={weeklyTrend}
          description="vs prior 7 days"
          color="purple"
        />
        <StatCard
          title="Monthly Revenue"
          value={formatCurrency(stats?.monthRevenue ?? 0)}
          icon={<TrendingUp className="w-5 h-5" />}
          description="Selling price — last 30 days"
          color="blue"
        />
      </div>

      {/* Row 2 — Financial Health */}
      <div>
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Financial Health — Last 30 Days</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Tax Collected (Today)"
            value={formatCurrency(stats?.todayTax ?? 0)}
            icon={<Receipt className="w-5 h-5" />}
            description={`Month total: ${formatCurrency(stats?.monthTax ?? 0)}`}
            color="orange"
          />
          <StatCard
            title="Expenses (Today)"
            value={formatCurrency(stats?.todayExpenses ?? 0)}
            icon={<Wallet className="w-5 h-5" />}
            description={`Month total: ${formatCurrency(stats?.monthExpenses ?? 0)}`}
            color="red"
          />
          <StatCard
            title="Net Profit (Month)"
            value={formatCurrency(stats?.monthNetProfit ?? 0)}
            icon={(stats?.monthNetProfit ?? 0) >= 0
              ? <TrendingUp className="w-5 h-5" />
              : <TrendingDown className="w-5 h-5" />
            }
            description="Monthly Revenue − Expenses"
            color={profitColor}
            isAlert={(stats?.monthNetProfit ?? 0) < 0}
          />
          <StatCard
            title="Stock Alerts"
            value={stats?.lowStockCount ?? 0}
            icon={<Package className="w-5 h-5" />}
            description="items below reorder threshold"
            color="orange"
            isAlert={!!stats?.lowStockCount && stats.lowStockCount > 0}
          />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card-premium p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg">Sales Revenue Trend</h3>
            <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">Last 7 Days</span>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.salesTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} tickFormatter={(val) => `₦${val/1000}k`} />
                <Tooltip
                  cursor={{ fill: '#F1F5F9' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-premium p-6">
          <h3 className="font-bold text-lg mb-6">Sales by Category</h3>
          <div className="h-[300px] w-full flex items-center justify-center">
            {stats?.categoryDistribution?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.categoryDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value: number) => [formatCurrency(value), 'Sales']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-muted-foreground space-y-2">
                <Package className="w-8 h-8 mx-auto opacity-20" />
                <p className="text-sm">No categorical data yet</p>
              </div>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {stats?.categoryDistribution?.slice(0, 3).map((cat, i) => (
              <div key={cat.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                  <span className="text-muted-foreground">{cat.name}</span>
                </div>
                <span className="font-semibold">{formatCurrency(cat.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <QuickActionCard
          title="New POS Sale"
          description="Start a new retail transaction."
          href="/pos"
          icon={<ShoppingBag className="text-blue-600" />}
        />
        <QuickActionCard
          title="Inventory Check"
          description="Audit stock levels and manage product pricing."
          href="/dashboard/inventory"
          icon={<Package className="text-green-600" />}
        />
        <QuickActionCard
          title="Operational Reports"
          description="View EOD summaries and business performance."
          href="/dashboard/reports"
          icon={<FileTextIcon className="text-orange-600" />}
        />
      </div>
    </div>
  );
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
  );
}

function StatCard({ title, value, icon, trend, description, color, isAlert }: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string | null;
  description?: string;
  color: string;
  isAlert?: boolean;
}) {
  const colorMap: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800/30',
    green:  'bg-green-50 text-green-600 border-green-100 dark:bg-green-900/20 dark:border-green-800/30',
    purple: 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:border-purple-800/30',
    orange: 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-900/20 dark:border-orange-800/30',
    red:    'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:border-red-800/30',
  };

  const isPositive = trend ? !trend.startsWith('-') : true;

  return (
    <div className={`card-premium p-6 border ${isAlert ? 'border-destructive/50 ring-1 ring-destructive/20' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg ${colorMap[color] ?? colorMap.blue}`}>{icon}</div>
        {trend != null && (
          <div className={`flex items-center gap-1 text-xs font-semibold ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trend}
          </div>
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold mt-1 tracking-tight">{value}</p>
        {description && <p className="text-xs text-muted-foreground mt-2">{description}</p>}
      </div>
    </div>
  );
}

function QuickActionCard({ title, description, href, icon }: { title: string; description: string; href: string; icon: React.ReactNode }) {
  return (
    <a href={href} className="card-premium p-6 group">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-muted rounded-xl transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          {icon}
        </div>
        <div>
          <h4 className="font-bold text-sm">{title}</h4>
          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{description}</p>
        </div>
      </div>
    </a>
  );
}
