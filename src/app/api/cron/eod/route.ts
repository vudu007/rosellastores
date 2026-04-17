import { NextRequest, NextResponse } from 'next/server';
import { sendEODReport } from '@/lib/eod';
import { prisma } from '@/lib/prisma';

/**
 * Vercel Cron Job endpoint — End of Day Report
 * Triggered automatically by vercel.json schedule (default 9:00 PM WAT / 20:00 UTC)
 * Also callable manually from the dashboard with the correct CRON_SECRET header.
 */
export async function GET(req: NextRequest) {
  // Verify the request is from Vercel Cron or an authorised caller
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const businessNameSetting = await prisma.setting.findUnique({
      where: { key: 'businessName' },
    });
    const ownerEmailSetting = await prisma.setting.findUnique({
      where: { key: 'ownerEmail' },
    });

    if (!businessNameSetting || !ownerEmailSetting) {
      return NextResponse.json(
        { error: 'Missing business settings (businessName / ownerEmail)' },
        { status: 400 }
      );
    }

    const success = await sendEODReport(
      businessNameSetting.value,
      ownerEmailSetting.value
    );

    if (success) {
      console.log('[CRON/EOD] Report sent successfully to', ownerEmailSetting.value);
      return NextResponse.json({ success: true, message: 'EOD report sent' });
    } else {
      return NextResponse.json({ success: false, message: 'Failed to send EOD report' }, { status: 500 });
    }
  } catch (error) {
    console.error('[CRON/EOD] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
