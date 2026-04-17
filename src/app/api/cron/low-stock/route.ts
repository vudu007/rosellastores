import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

/**
 * Vercel Cron Job endpoint — Daily Low Stock Alert
 * Triggered every morning at 8:00 AM via vercel.json schedule.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const allProducts = await prisma.product.findMany({
      where: { isActive: true },
      include: { category: true },
    });

    const lowStockItems = allProducts.filter(p => p.stockQty <= p.lowStockThreshold);

    if (lowStockItems.length === 0) {
      return NextResponse.json({ success: true, message: 'No low stock items' });
    }

    const ownerEmailSetting = await prisma.setting.findUnique({ where: { key: 'ownerEmail' } });
    const businessNameSetting = await prisma.setting.findUnique({ where: { key: 'businessName' } });

    if (ownerEmailSetting) {
      const html = `
        <h2 style="color:#F59E0B">⚠️ Low Stock Alert — ${businessNameSetting?.value ?? 'RetailPro'}</h2>
        <p>${lowStockItems.length} product(s) are below their minimum stock threshold:</p>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#F3F4F6">
              <th style="padding:10px;text-align:left">Product</th>
              <th style="padding:10px;text-align:right">Stock</th>
              <th style="padding:10px;text-align:right">Threshold</th>
            </tr>
          </thead>
          <tbody>
            ${lowStockItems.map(p => `
              <tr>
                <td style="padding:10px;border-bottom:1px solid #E5E7EB">${p.name}</td>
                <td style="padding:10px;border-bottom:1px solid #E5E7EB;text-align:right;color:#EF4444">${p.stockQty}</td>
                <td style="padding:10px;border-bottom:1px solid #E5E7EB;text-align:right">${p.lowStockThreshold}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <p style="margin-top:20px;color:#6B7280;font-size:12px">This is an automated alert from RetailPro.</p>
      `;

      await sendEmail(
        ownerEmailSetting.value,
        `⚠️ Low Stock Alert — ${lowStockItems.length} item(s) need restocking`,
        html
      );
    }

    console.log(`[CRON/LOW-STOCK] Alert sent for ${lowStockItems.length} items`);
    return NextResponse.json({ success: true, lowStockCount: lowStockItems.length });
  } catch (error) {
    console.error('[CRON/LOW-STOCK] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
