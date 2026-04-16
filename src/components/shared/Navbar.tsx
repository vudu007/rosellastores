'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useState } from 'react';

export default function Navbar() {
  const { data: session } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (!session) return null;

  return (
    <nav className="bg-white shadow-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">R</span>
            </div>
            <span className="font-bold text-gray-800 hidden sm:inline">RetailPro</span>
          </Link>

          <div className="flex items-center space-x-6">
            {session.user.role === 'CASHIER' ? (
              <Link href="/pos" className="text-gray-600 hover:text-blue-600 font-medium">
                POS
              </Link>
            ) : session.user.role === 'WHOLESALE_CUSTOMER' ? (
              <Link href="/wholesale" className="text-gray-600 hover:text-blue-600 font-medium">
                Orders
              </Link>
            ) : (
              <>
                <Link href="/dashboard" className="text-gray-600 hover:text-blue-600 font-medium">
                  Dashboard
                </Link>
                <Link href="/dashboard/sales" className="text-gray-600 hover:text-blue-600 font-medium">
                  Sales
                </Link>
                <Link href="/dashboard/inventory" className="text-gray-600 hover:text-blue-600 font-medium">
                  Inventory
                </Link>
              </>
            )}

            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-2 text-gray-700 hover:text-blue-600"
              >
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  {session.user.name.charAt(0)}
                </div>
                <span className="text-sm font-medium hidden sm:inline">{session.user.name}</span>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 z-50">
                  <div className="px-4 py-2 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-800">{session.user.email}</p>
                    <p className="text-xs text-gray-500">{session.user.role}</p>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
