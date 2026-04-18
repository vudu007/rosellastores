import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

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

    const [todaySales, yesterdaySales, weekSales, prevWeekSales, monthSales] = await Promise.all([
      prisma.sale.findMany({
        where: { branchId: session.user.branchId ?? undefined, status: 'COMPLETED', createdAt: { gte: todayStart, lte: todayEnd } },
      }),
      prisma.sale.findMany({
        where: { branchId: session.user.branchId ?? undefined, status: 'COMPLETED', createdAt: { gte: yesterdayStart, lte: yesterdayEnd } },
      }),
      prisma.sale.findMany({
        where: { branchId: session.user.branchId ?? undefined, status: 'COMPLETED', createdAt: { gte: weekStart } },
      }),
      prisma.sale.findMany({
        where: { branchId: session.user.branchId ?? undefined, status: 'COMPLETED', createdAt: { gte: prevWeekStart, lte: prevWeekEnd } },
      }),
      prisma.sale.findMany({
        where: { branchId: session.user.branchId ?? undefined, status: 'COMPLETED', createdAt: { gte: monthStart } },
      }),
    ]);

    const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.total, 0);
    const yesterdayRevenue = yesterdaySales.reduce((sum, sale) => sum + sale.total, 0);
    const weekRevenue = weekSales.reduce((sum, sale) => sum + sale.total, 0);
    const prevWeekRevenue = prevWeekSales.reduce((sum, sale) => sum + sale.total, 0);
    const monthRevenue = monthSales.reduce((sum, sale) => sum + sale.total, 0);

    // FIX: fetch products then filter in JS (Prisma can't do column-to-column WHERE comparisons)
    const allProducts = await prisma.product.findMany({
      where: { branchId: session.user.branchId ?? undefined, isActive: true },
      select: { stockQty: true, lowStockThreshold: true },
    });
    const lowStockItems = allProducts.filter(
      (p) => p.stockQty <= p.lowStockThreshold
    ).length;

    // Build salesTrend: last 7 days
    const salesTrend = [];
    for (let i = 6; i >= 0; i--) {
      const day = subDays(today, i);
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      const daySales = weekSales.filter(
        (s) => s.createdAt.getTime() >= dayStart.getTime() && s.createdAt.getTime() <= dayEnd.getTime()
      );
      salesTrend.push({
        date: format(day, 'EEE'),
        revenue: daySales.reduce((sum, s) => sum + s.total, 0),
        count: daySales.length,
      });
    }

    // Build categoryDistribution from week sales items
    const weekSaleIds = weekSales.map((s) => s.id);
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
      todaySales: todaySales.length,
      yesterdaySales: yesterdaySales.length,
      todayRevenue,
      yesterdayRevenue,
      weekRevenue,
      prevWeekRevenue,
      monthRevenue,
      lowStockCount: lowStockItems,
      salesTrend,
      categoryDistribution,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
