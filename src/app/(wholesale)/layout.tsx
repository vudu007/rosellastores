import Navbar from '@/components/shared/Navbar';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function WholesaleLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session || session.user.role !== 'WHOLESALE_CUSTOMER') {
    redirect('/login');
  }

  return (
    <>
      <Navbar />
      <main>{children}</main>
    </>
  );
}
