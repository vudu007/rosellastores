import Navbar from '@/components/shared/Navbar';
import IdleTimer from '@/components/shared/IdleTimer';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function POSLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session || !['CASHIER', 'MANAGER', 'OWNER'].includes(session.user.role)) {
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
