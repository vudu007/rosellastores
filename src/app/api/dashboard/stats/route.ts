import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    const yesterdayStart = startOfDay(subDays(today, 1));
    const yesterdayEnd = endOfDay(subDays(today, 1));

    const weekStart = startOfDay(subDays(today, 7));
    const prevWeekStart = startOfDay(subDays(today, 14));
    const prevWeekEnd = endOfDay(subDays(today, 8));
    const monthStart = startOfDay(subDays(today, 30));

    const branchId = session.user.branchId ?? undefined;

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
      // Today expenses sum
      prisma.expense.aggregate({
        where: { branchId, date: { gte: todayStart, lte: todayEnd } },
        _sum: { amount: true },
      }),
      // Month expenses sum
      prisma.expense.aggregate({
        where: { branchId, date: { gte: monthStart } },
        _sum: { amount: true },
      }),
    ]);

    // Revenue = subtotal (actual selling price, before added VAT)
    const todayRevenue     = todaySales.reduce((s, x) => s + x.subtotal, 0);
    const yesterdayRevenue = yesterdaySales.reduce((s, x) => s + x.subtotal, 0);
    const weekRevenue      = weekSales.reduce((s, x) => s + x.subtotal, 0);
    const prevWeekRevenue  = prevWeekSales.reduce((s, x) => s + x.subtotal, 0);
    const monthRevenue     = monthSales.reduce((s, x) => s + x.subtotal, 0);

    // Tax collected (exclusive VAT added on top of selling price)
    const todayTax  = todaySales.reduce((s, x) => s + x.tax, 0);
    const monthTax  = monthSales.reduce((s, x) => s + x.tax, 0);

    // Expenses
    const todayExpenses = todayExpensesAgg._sum.amount ?? 0;
    const monthExpenses = monthExpensesAgg._sum.amount ?? 0;

    // Net profit for the month (Revenue – Expenses, simple approximation)
    const monthNetProfit = monthRevenue - monthExpenses;

    // Low stock
    const allProducts = await prisma.product.findMany({
      where: { branchId, isActive: true },
      select: { stockQty: true, lowStockThreshold: true },
    });
    const lowStockCount = allProducts.filter(p => p.stockQty <= p.lowStockThreshold).length;

    // Sales trend: last 7 days
    const salesTrend = [];
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

    // Category distribution from week sales
    const weekSaleIds = weekSales.map(s => s.id).filter(Boolean) as string[];
    const categoryDistribution: { name: string; value: number }[] = [];
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

    return NextResponse.json({
      // Sales counts
      todaySales: todaySales.length,
      yesterdaySales: yesterdaySales.length,
      // Revenue (= selling price / subtotal)
      todayRevenue,
      yesterdayRevenue,
      weekRevenue,
      prevWeekRevenue,
      monthRevenue,
      // Tax collected
      todayTax,
      monthTax,
      // Expenses
      todayExpenses,
      monthExpenses,
      // Profitability
      monthNetProfit,
      // Other
      lowStockCount,
      salesTrend,
      categoryDistribution,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
