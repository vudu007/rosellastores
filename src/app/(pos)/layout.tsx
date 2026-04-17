import Navbar from '@/components/shared/Navbar';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function POSLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session || !['CASHIER', 'MANAGER', 'OWNER'].includes(session.user.role)) {
    redirect('/login');
  }

  return (
    <>
      <Navbar />
      <main>{children}</main>
    </>
  );
}
