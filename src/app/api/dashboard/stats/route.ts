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
        branchId: session.user.branchId,
        status: 'COMPLETED',
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    const weekSales = await prisma.sale.findMany({
      where: {
        branchId: session.user.branchId,
        status: 'COMPLETED',
        createdAt: {
          gte: weekStart,
        },
      },
    });

    const monthSales = await prisma.sale.findMany({
      where: {
        branchId: session.user.branchId,
        status: 'COMPLETED',
        createdAt: {
          gte: monthStart,
        },
      },
    });

    const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.total, 0);
    const weekRevenue = weekSales.reduce((sum, sale) => sum + sale.total, 0);
    const monthRevenue = monthSales.reduce((sum, sale) => sum + sale.total, 0);

    const lowStockItems = await prisma.product.count({
      where: {
        branchId: session.user.branchId,
        isActive: true,
        stockQty: {
          lte: prisma.product.fields.lowStockThreshold,
        },
      },
    });

    // Chart Data: Last 7 days trend
    const salesTrend = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(today, i);
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      const daySales = weekSales.filter(s => s.createdAt >= dayStart && s.createdAt <= dayEnd);
      salesTrend.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        revenue: daySales.reduce((sum, s) => sum + s.total, 0),
        count: daySales.length,
      });
    }

    // Category Distribution (based on this month's sales)
    const categorySales: Record<string, number> = {};
    const salesWithItems = await prisma.sale.findMany({
      where: {
        branchId: session.user.branchId,
        status: 'COMPLETED',
        createdAt: { gte: monthStart },
      },
      include: {
        items: {
          include: {
            product: {
              include: { category: true }
            }
          }
        }
      }
    });

    for (const sale of salesWithItems) {
      for (const item of sale.items) {
        const catName = item.product.category.name;
        categorySales[catName] = (categorySales[catName] || 0) + item.total;
      }
    }

    const categoryDistribution = Object.entries(categorySales).map(([name, value]) => ({
      name,
      value,
    }));

    return NextResponse.json({
      todaySales: todaySales.length,
      todayRevenue,
      weekRevenue,
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
