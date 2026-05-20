import { redirect } from 'next/navigation';
import { authWithSession } from '@/lib/authz';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await authWithSession();
  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role === 'CASHIER') {
    redirect('/pos');
  }

  redirect('/dashboard');
}
