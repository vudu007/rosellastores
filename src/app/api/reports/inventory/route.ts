import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !['OWNER', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId') || session.user.branchId;

    const query: any = {
      where: { isActive: true }
    };
    if (branchId) {
      query.where.branchId = branchId;
    }

    const products: any[] = await prisma.product.findMany({
      ...query,
      include: {
        category: true,
        supplier: true,
        branch: true
      },
      orderBy: { name: 'asc' }
    });

    // Generate CSV
    const csvHeaders = ['SKU', 'Barcode', 'Product Name', 'Category', 'Supplier', 'Retail Price', 'Wholesale Price', 'System Stock', 'Physical Count', 'Discrepancy'];
    
    let csvRows = [csvHeaders.join(',')];
    
    for (const p of products) {
      const row = [
        `"${p.sku}"`,
        `"${p.barcode || ''}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.category?.name || ''}"`,
        `"${p.supplier?.name || ''}"`,
        p.retailPrice,
        p.wholesalePrice,
        p.stockQty,
        '', // Physical Count (Blank for printing)
        ''  // Discrepancy (Blank for printing)
      ];
      csvRows.push(row.join(','));
    }

    const csvData = csvRows.join('\n');
    
    // Send as file download
    return new NextResponse(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="inventory-audit-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
  } catch (error) {
    console.error('Error generating inventory audit:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
