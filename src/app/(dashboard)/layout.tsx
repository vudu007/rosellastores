import DashboardShell from '@/components/shared/DashboardShell';
import { redirect } from 'next/navigation';
import { authWithSession } from '@/lib/authz';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await authWithSession();

  if (!session || !session.user || !['ADMIN', 'OWNER', 'MANAGER'].includes(session.user.role)) {
    redirect('/login');
  }

  return <DashboardShell>{children}</DashboardShell>;
}
