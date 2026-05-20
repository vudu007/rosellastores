import { NextRequest, NextResponse } from 'next/server';
import { authWithSession } from '@/lib/authz';
import { DashboardService } from '@/services/dashboard.service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await authWithSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const branchId = session.user.branchId ?? undefined;
    const stats = await DashboardService.getStats(branchId);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
