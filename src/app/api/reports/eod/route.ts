import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generateEODReport, generateEODPDF, sendEODReport } from '@/lib/eod';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !['OWNER', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date');
    const date = dateStr ? new Date(dateStr) : new Date();

    const report = await generateEODReport(date);

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error generating EOD report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !['OWNER', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, date } = body;

    if (action === 'send-email') {
      const businessNameSetting = await prisma.setting.findUnique({
        where: { key: 'businessName' },
      });
      const ownerEmailSetting = await prisma.setting.findUnique({
        where: { key: 'ownerEmail' },
      });

      if (!businessNameSetting || !ownerEmailSetting) {
        return NextResponse.json({ error: 'Missing settings' }, { status: 400 });
      }

      const success = await sendEODReport(
        businessNameSetting.value,
        ownerEmailSetting.value,
        date ? new Date(date) : new Date()
      );

      return NextResponse.json({
        success,
        message: success ? 'EOD report sent successfully' : 'Failed to send EOD report',
      });
    }

    if (action === 'generate-pdf') {
      const report = await generateEODReport(date ? new Date(date) : new Date());
      const pdfBuffer = await generateEODPDF(report);

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="eod-report-${new Date().toISOString().split('T')[0]}.pdf"`,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error processing EOD report action:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
