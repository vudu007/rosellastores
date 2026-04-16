import Navbar from '@/components/shared/Navbar';
import Sidebar from '@/components/shared/Sidebar';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session || !session.user || !['OWNER', 'MANAGER'].includes(session.user.role)) {
    redirect('/login');
  }

  return (
    <>
      <Navbar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1">{children}</main>
      </div>
    </>
  );
}
