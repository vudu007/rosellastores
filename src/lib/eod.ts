import { prisma } from './prisma';
import { startOfDay, endOfDay, subDays } from 'date-fns';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import { sendEmail, generateEODEmailHTML } from './email';
import { EODReport } from '@/types';

export async function generateEODReport(date: Date = new Date()): Promise<EODReport> {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const previousDayStart = startOfDay(subDays(date, 1));
  const previousDayEnd = endOfDay(subDays(date, 1));

  const sales = await prisma.sale.findMany({
    where: {
      createdAt: {
        gte: dayStart,
        lte: dayEnd,
      },
      status: 'COMPLETED',
    },
    include: {
      items: true,
    },
  });

  const previousDaySales = await prisma.sale.findMany({
    where: {
      createdAt: {
        gte: previousDayStart,
        lte: previousDayEnd,
      },
      status: 'COMPLETED',
    },
  });

  const expenses = await prisma.expense.findMany({
    where: {
      date: {
        gte: dayStart,
        lte: dayEnd,
      },
    },
  });

  // FIX: fetch all active products then filter in JS (Prisma can't compare two columns in WHERE)
  const allActiveProducts = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { stockQty: 'asc' },
  });
  const lowStockItems = allActiveProducts
    .filter((p) => p.stockQty <= p.lowStockThreshold)
    .slice(0, 10);

  // FIX: pre-fetch all products referenced in sales to avoid N+1 queries
  const productIds = [
    ...new Set(sales.flatMap((sale) => sale.items.map((item) => item.productId))),
  ];
  const productsMap = new Map(
    (
      await prisma.product.findMany({
        where: { id: { in: productIds } },
      })
    ).map((p) => [p.id, p])
  );

  let totalRevenue = 0;
  let totalDiscounts = 0;
  const paymentMethodBreakdown: Record<
    string,
    { count: number; total: number }
  > = {};
  const productSalesMap = new Map<
    string,
    { name: string; quantity: number; revenue: number }
  >();

  for (const sale of sales) {
    totalRevenue += sale.total;
    totalDiscounts += sale.discount;

    const method = sale.paymentMethod;
    if (!paymentMethodBreakdown[method]) {
      paymentMethodBreakdown[method] = { count: 0, total: 0 };
    }
    paymentMethodBreakdown[method].count += 1;
    paymentMethodBreakdown[method].total += sale.total;

    for (const item of sale.items) {
      const product = productsMap.get(item.productId);
      if (product) {
        const existing = productSalesMap.get(product.id) || {
          name: product.name,
          quantity: 0,
          revenue: 0,
        };
        existing.quantity += item.qty;
        existing.revenue += item.total;
        productSalesMap.set(product.id, existing);
      }
    }
  }

  const topProducts = Array.from(productSalesMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  return {
    date,
    totalSalesCount: sales.length,
    totalRevenue,
    totalDiscounts,
    totalExpenses,
    paymentMethodBreakdown,
    topProducts,
    lowStockItems: lowStockItems.map((item) => ({
      name: item.name,
      stockQty: item.stockQty,
      lowStockThreshold: item.lowStockThreshold,
    })),
    previousDaySalesCount: previousDaySales.length,
  };
}

export async function generateEODPDF(report: EODReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 0,
      }).format(value);
    };

    const formatDate = (date: Date) => {
      return new Intl.DateTimeFormat('en-NG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date);
    };

    doc.fontSize(24).font('Helvetica-Bold').text('End of Day Report', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica').text(formatDate(report.date), { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(12).font('Helvetica-Bold').text('Summary');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.3);

    doc.fontSize(10);
    doc.text(`Total Sales: ${report.totalSalesCount}`, 50);
    doc.text(`Total Revenue: ${formatCurrency(report.totalRevenue)}`);
    doc.text(`Total Discounts: ${formatCurrency(report.totalDiscounts)}`);
    doc.text(`Total Expenses: ${formatCurrency(report.totalExpenses)}`);
    doc.moveDown(1);

    doc.fontSize(12).font('Helvetica-Bold').text('Payment Method Breakdown');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.3);

    doc.fontSize(9);
    for (const [method, data] of Object.entries(report.paymentMethodBreakdown)) {
      doc.text(
        `${method.replace(/_/g, ' ')}: ${data.count} transactions - ${formatCurrency(data.total)}`,
        50
      );
    }
    doc.moveDown(1);

    if (report.topProducts.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Top Products');
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.3);

      doc.fontSize(9);
      for (const product of report.topProducts) {
        doc.text(
          `${product.name}: ${product.quantity} units - ${formatCurrency(product.revenue)}`,
          50
        );
      }
      doc.moveDown(1);
    }

    if (report.lowStockItems.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Low Stock Alerts');
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.3);

      doc.fontSize(9);
      for (const item of report.lowStockItems) {
        doc.text(
          `${item.name}: ${item.stockQty} units (Threshold: ${item.lowStockThreshold})`,
          50
        );
      }
      doc.moveDown(1);
    }

    doc.fontSize(8)
      .text('This is an automated end-of-day report.', 50, doc.page.height - 50, {
        align: 'center',
      });

    doc.end();
  });
}

export async function sendEODReport(
  businessName: string,
  ownerEmail: string,
  date: Date = new Date()
): Promise<boolean> {
  try {
    const report = await generateEODReport(date);
    const pdfBuffer = await generateEODPDF(report);
    const htmlContent = generateEODEmailHTML(report, businessName);

    const success = await sendEmail(ownerEmail, `End of Day Report - ${new Date().toDateString()}`, htmlContent, [
      {
        filename: `eod-report-${new Date().toISOString().split('T')[0]}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ]);

    return success;
  } catch (error) {
    console.error('Error sending EOD report:', error);
    return false;
  }
}
