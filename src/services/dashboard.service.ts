import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';
import { DashboardStats, ChartData, CategoryData } from '@/types';

export class DashboardService {
  static async getStats(branchId?: string): Promise<DashboardStats> {
    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    const yesterdayStart = startOfDay(subDays(today, 1));
    const yesterdayEnd = endOfDay(subDays(today, 1));

    const weekStart = startOfDay(subDays(today, 7));
    const prevWeekStart = startOfDay(subDays(today, 14));
    const prevWeekEnd = endOfDay(subDays(today, 8));
    const monthStart = startOfDay(subDays(today, 30));

    const [
      todaySales, yesterdaySales, weekSales, prevWeekSales, monthSales,
      todayExpensesAgg, monthExpensesAgg,
    ] = await Promise.all([
      prisma.sale.findMany({
        where: { branchId, status: 'COMPLETED', createdAt: { gte: todayStart, lte: todayEnd } },
        select: { subtotal: true, tax: true, total: true },
      }),
      prisma.sale.findMany({
        where: { branchId, status: 'COMPLETED', createdAt: { gte: yesterdayStart, lte: yesterdayEnd } },
        select: { subtotal: true, tax: true, total: true },
      }),
      prisma.sale.findMany({
        where: { branchId, status: 'COMPLETED', createdAt: { gte: weekStart } },
        select: { id: true, subtotal: true, tax: true, total: true, createdAt: true },
      }),
      prisma.sale.findMany({
        where: { branchId, status: 'COMPLETED', createdAt: { gte: prevWeekStart, lte: prevWeekEnd } },
        select: { subtotal: true, tax: true, total: true },
      }),
      prisma.sale.findMany({
        where: { branchId, status: 'COMPLETED', createdAt: { gte: monthStart } },
        select: { subtotal: true, tax: true, total: true },
      }),
      prisma.expense.aggregate({
        where: { branchId, date: { gte: todayStart, lte: todayEnd } },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { branchId, date: { gte: monthStart } },
        _sum: { amount: true },
      }),
    ]);

    const todayRevenue     = todaySales.reduce((s, x) => s + x.subtotal, 0);
    const yesterdayRevenue = yesterdaySales.reduce((s, x) => s + x.subtotal, 0);
    const weekRevenue      = weekSales.reduce((s, x) => s + x.subtotal, 0);
    const prevWeekRevenue  = prevWeekSales.reduce((s, x) => s + x.subtotal, 0);
    const monthRevenue     = monthSales.reduce((s, x) => s + x.subtotal, 0);

    const todayTax  = todaySales.reduce((s, x) => s + x.tax, 0);
    const monthTax  = monthSales.reduce((s, x) => s + x.tax, 0);

    const todayExpenses = todayExpensesAgg._sum.amount ?? 0;
    const monthExpenses = monthExpensesAgg._sum.amount ?? 0;

    const monthNetProfit = monthRevenue - monthExpenses;

    const allProducts = await prisma.product.findMany({
      where: { branchId, isActive: true },
      select: { stockQty: true, lowStockThreshold: true },
    });
    const lowStockCount = allProducts.filter(p => p.stockQty <= (p.lowStockThreshold || 0)).length;

    const salesTrend: ChartData[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = subDays(today, i);
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      const daySales = weekSales.filter(
        s => s.createdAt.getTime() >= dayStart.getTime() && s.createdAt.getTime() <= dayEnd.getTime()
      );
      salesTrend.push({
        date: format(day, 'EEE'),
        revenue: daySales.reduce((s, x) => s + x.subtotal, 0),
        count: daySales.length,
      });
    }

    const weekSaleIds = weekSales.map(s => s.id).filter(Boolean) as string[];
    const categoryDistribution: CategoryData[] = [];
    if (weekSaleIds.length > 0) {
      const saleItems = await prisma.saleItem.findMany({
        where: { saleId: { in: weekSaleIds } },
        include: { product: { include: { category: true } } },
      });
      const catMap: Record<string, number> = {};
      for (const item of saleItems) {
        const catName = item.product?.category?.name ?? 'Uncategorized';
        catMap[catName] = (catMap[catName] ?? 0) + item.total;
      }
      for (const [name, value] of Object.entries(catMap)) {
        categoryDistribution.push({ name, value });
      }
      categoryDistribution.sort((a, b) => b.value - a.value);
    }

    return {
      todaySales: todaySales.length,
      yesterdaySales: yesterdaySales.length,
      todayRevenue,
      yesterdayRevenue,
      weekRevenue,
      prevWeekRevenue,
      monthRevenue,
      todayTax,
      monthTax,
      todayExpenses,
      monthExpenses,
      monthNetProfit,
      lowStockCount,
      salesTrend,
      categoryDistribution,
    };
  }
}
