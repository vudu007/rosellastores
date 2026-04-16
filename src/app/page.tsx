import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await auth();

  if (!session || !session.user) {
    redirect('/login');
  }

  if (session.user.role === 'CASHIER') {
    redirect('/pos');
  }

  if (session.user.role === 'WHOLESALE_CUSTOMER') {
    redirect('/wholesale');
  }

  redirect('/dashboard');
}
