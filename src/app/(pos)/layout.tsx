import Navbar from '@/components/shared/Navbar';
import IdleTimer from '@/components/shared/IdleTimer';
import { authWithSession } from '@/lib/authz';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function POSLayout({ children }: { children: React.ReactNode }) {
  const session = await authWithSession();

  if (!session || !['CASHIER', 'MANAGER', 'OWNER', 'ADMIN'].includes(session.user.role)) {
    redirect('/login');
  }

  return (
    <>
      <IdleTimer />
      <Navbar />
      <main>{children}</main>
    </>
  );
}
