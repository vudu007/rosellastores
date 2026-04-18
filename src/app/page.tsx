import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Always land on login — even if a session cookie exists.
// The login form handles role-based routing after successful sign-in.
export default function Home() {
  redirect('/login');
}
