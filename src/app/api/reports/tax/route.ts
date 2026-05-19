export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !['OWNER', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Always use the session's branchId — never allow caller to override
    const branchId = session.user.branchId;

    const today = new Date();
    const startDate = startOfMonth(today);
    const endDate = endOfMonth(today);

    const query: any = {
      where: {
        status: 'COMPLETED',
        createdAt: {
          gte: startDate,
          lte: endDate,
        }
      }
    };

    if (branchId) {
      query.where.branchId = branchId;
    }

    const sales: any[] = await prisma.sale.findMany({
      ...query,
      include: {
        customer: true,
        items: {
          include: {
             product: {
               include: { category: true }
             }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    let totalTax = 0;
    let totalGross = 0;
    let totalNet = 0;

    const formattedSales = sales.map(s => {
      totalTax += s.tax;
      totalGross += s.subtotal;
      totalNet += s.total;

      return {
        date: format(new Date(s.createdAt), 'yyyy-MM-dd HH:mm'),
        id: s.id,
        customer: s.customer?.name || 'Walk-in',
        type: 'RETAIL',
        paymentMethod: s.paymentMethod,
        subtotal: s.subtotal,
        discount: s.discount,
        tax: s.tax,
        total: s.total
      };
    });

    return NextResponse.json({
      period: format(today, 'yyyy-MM'),
      sales: formattedSales,
      summary: {
        totalGross,
        totalTax,
        totalNet
      }
    });

  } catch (error) {
    console.error('Error generating tax report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

