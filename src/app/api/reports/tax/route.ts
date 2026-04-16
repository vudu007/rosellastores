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

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId') || session.user.branchId;

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

    // Generate CSV
    const csvHeaders = ['Date', 'Sale ID', 'Customer', 'Customer Type', 'Payment Method', 'Gross Total', 'Discount Given', 'Tax Collected', 'Net Total'];
    let csvRows = [csvHeaders.join(',')];
    
    let totalTax = 0;
    let totalGross = 0;
    let totalNet = 0;

    for (const s of sales) {
      totalTax += s.tax;
      totalGross += s.subtotal;
      totalNet += s.total;

      const row = [
        `"${format(new Date(s.createdAt), 'yyyy-MM-dd HH:mm')}"`,
        `"${s.id}"`,
        `"${s.customer?.name || 'Walk-in'}"`,
        `"${s.customer?.type || 'RETAIL'}"`,
        `"${s.paymentMethod}"`,
        s.subtotal.toFixed(2),
        s.discount.toFixed(2),
        s.tax.toFixed(2),
        s.total.toFixed(2)
      ];
      csvRows.push(row.join(','));
    }

    // Add aggregate total row
    csvRows.push('');
    csvRows.push(`"TOTAL FOR MONTH","","","","",${totalGross.toFixed(2)},"",${totalTax.toFixed(2)},${totalNet.toFixed(2)}`);

    const csvData = csvRows.join('\n');
    
    // Send as file download
    return new NextResponse(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="tax-summary-${format(today, 'yyyy-MM')}.csv"`
      }
    });

  } catch (error) {
    console.error('Error generating tax report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
