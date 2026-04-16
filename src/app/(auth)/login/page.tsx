'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        router.push('/');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8">
          <h1 className="text-3xl font-bold text-white text-center">RetailPro</h1>
          <p className="text-blue-100 text-center mt-2">Management System</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-xs text-gray-600 text-center mb-4 font-semibold">DEMO CREDENTIALS</p>
            <div className="space-y-3">
              <div className="bg-blue-50 p-3 rounded text-xs">
                <p className="font-semibold text-blue-900">Owner</p>
                <p className="text-blue-700">owner@store.com / owner123</p>
              </div>
              <div className="bg-green-50 p-3 rounded text-xs">
                <p className="font-semibold text-green-900">Manager</p>
                <p className="text-green-700">manager@store.com / manager123</p>
              </div>
              <div className="bg-purple-50 p-3 rounded text-xs">
                <p className="font-semibold text-purple-900">Cashier</p>
                <p className="text-purple-700">cashier1@store.com / cashier123</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
