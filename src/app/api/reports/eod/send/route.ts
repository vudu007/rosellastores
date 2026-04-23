export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendEODReport } from '@/lib/eod';
import { getEmailConfigError } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session || !['ADMIN', 'OWNER', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const emailConfigError = getEmailConfigError();
    if (emailConfigError) {
      return NextResponse.json({ error: emailConfigError }, { status: 500 });
    }

    const businessNameSetting = await prisma.setting.findUnique({
      where: { key: 'businessName' },
    });
    
    // Default to a fallback if setting is missing
    const businessName = businessNameSetting?.value || 'MekaERP Store';
    
    // Use the owner's email or a configured recipient
    const ownerEmailSetting = await prisma.setting.findUnique({
      where: { key: 'ownerEmail' },
    });
    
    const recipientEmail = ownerEmailSetting?.value || session.user.email;

    if (!recipientEmail) {
      return NextResponse.json({ error: 'Recipient email not configured' }, { status: 400 });
    }

    const success = await sendEODReport(businessName, recipientEmail);

    if (success) {
      // Log the event
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'SEND_EOD_REPORT',
          entity: 'REPORT',
          entityId: new Date().toISOString(),
          newValue: `Report sent to ${recipientEmail}`,
        },
      });

      return NextResponse.json({ message: 'EOD Report sent successfully' });
    } else {
      return NextResponse.json({ error: 'Failed to send report' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in manual EOD send:', error);
    return NextResponse.json({ error: (error as Error)?.message || 'Internal server error' }, { status: 500 });
  }
}
