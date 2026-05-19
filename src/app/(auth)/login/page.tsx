'use client';

import { Suspense, useState } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const normalizeCallbackUrl = (value: string | null) => {
    if (!value) return null;
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith('/')) return decoded;
    try {
      const url = new URL(decoded);
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return null;
    }
  };

  const isSafeRedirectTarget = (path: string) => {
    if (!path.startsWith('/')) return false;
    if (path.startsWith('/api')) return false;
    if (path.startsWith('/_next')) return false;
    if (path.startsWith('/login')) return false;
    return true;
  };

  const getDefaultLanding = (role: string | undefined) => {
    if (role === 'CASHIER') return '/pos';
    return '/dashboard';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
      } else if (result?.ok) {
        // Fetch the fresh session to get the user's role, then route directly
        const session = await getSession();
        const role = (session?.user as any)?.role as string | undefined;

        const callbackUrlRaw = searchParams.get('callbackUrl');
        const candidate = normalizeCallbackUrl(callbackUrlRaw);
        const safeCandidate = candidate && isSafeRedirectTarget(candidate) ? candidate : null;

        const defaultLanding = getDefaultLanding(role);

        let target = safeCandidate ?? defaultLanding;

        if (role === 'CASHIER') {
          if (!target.startsWith('/pos')) target = '/pos';
        }

        router.push(target);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen brand-hero flex items-center justify-center p-4 relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 hidden lg:flex items-center justify-start w-[28vw]"
      >
        <ShoppingCart className="w-[320px] h-[320px] text-primary/25 drop-shadow-[0_20px_60px_rgba(255,106,0,0.25)] -rotate-12 translate-x-[-20%] blur-[0.2px]" />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 hidden lg:flex items-center justify-end w-[28vw]"
      >
        <ShoppingCart className="w-[300px] h-[300px] text-primary/20 drop-shadow-[0_20px_60px_rgba(255,106,0,0.22)] rotate-12 translate-x-[20%] blur-[0.2px]" />
      </div>

      <div className="w-full max-w-md card shadow-2xl overflow-hidden relative z-10">
        <div className="px-6 py-8 bg-card border-b">
          <h1 className="text-3xl font-black text-foreground text-center tracking-tight">Rosella Stores</h1>
          <p className="text-muted-foreground text-center mt-2">Kiddies Hub ERP System</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="input-base"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="input-base"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed h-12 text-base"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          {/* Removed demo credentials */}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen brand-hero flex items-center justify-center p-4 relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 hidden lg:flex items-center justify-start w-[28vw]"
          >
            <ShoppingCart className="w-[320px] h-[320px] text-primary/25 drop-shadow-[0_20px_60px_rgba(255,106,0,0.25)] -rotate-12 translate-x-[-20%] blur-[0.2px]" />
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 hidden lg:flex items-center justify-end w-[28vw]"
          >
            <ShoppingCart className="w-[300px] h-[300px] text-primary/20 drop-shadow-[0_20px_60px_rgba(255,106,0,0.22)] rotate-12 translate-x-[20%] blur-[0.2px]" />
          </div>

          <div className="w-full max-w-md card shadow-2xl overflow-hidden relative z-10">
            <div className="px-6 py-8 bg-card border-b">
              <h1 className="text-3xl font-black text-foreground text-center tracking-tight">Rosella Stores</h1>
              <p className="text-muted-foreground text-center mt-2">Kiddies Hub ERP System</p>
            </div>
            <div className="p-8">
              <div className="text-center text-sm text-muted-foreground">Loading…</div>
            </div>
          </div>
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
