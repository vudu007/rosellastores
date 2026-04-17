import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay, subDays } from 'date-fns';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    const weekStart = startOfDay(subDays(today, 7));
    const monthStart = startOfDay(subDays(today, 30));

    const todaySales = await prisma.sale.findMany({
      where: {
        branchId: session.user.branchId || undefined,
        status: 'COMPLETED',
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    const weekSales = await prisma.sale.findMany({
      where: {
        branchId: session.user.branchId || undefined,
        status: 'COMPLETED',
        createdAt: {
          gte: weekStart,
        },
      },
    });

    const monthSales = await prisma.sale.findMany({
      where: {
        branchId: session.user.branchId || undefined,
        status: 'COMPLETED',
        createdAt: {
          gte: monthStart,
        },
      },
    });

    const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.total, 0);
    const weekRevenue = weekSales.reduce((sum, sale) => sum + sale.total, 0);
    const monthRevenue = monthSales.reduce((sum, sale) => sum + sale.total, 0);

    // FIX: fetch products then filter in JS (Prisma can't do column-to-column WHERE comparisons)
    const allProducts = await prisma.product.findMany({
      where: { branchId: session.user.branchId || undefined, isActive: true },
      select: { stockQty: true, lowStockThreshold: true },
    });
    const lowStockItems = allProducts.filter(
      (p) => p.stockQty <= p.lowStockThreshold
    ).length;

    return NextResponse.json({
      todaySales: todaySales.length,
      todayRevenue,
      weekRevenue,
      monthRevenue,
      lowStockCount: lowStockItems,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
