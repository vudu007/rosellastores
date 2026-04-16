'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

const menuItems = [
  { href: '/dashboard', label: 'Overview', roles: ['OWNER', 'MANAGER'] },
  { href: '/dashboard/sales', label: 'Sales', roles: ['OWNER', 'MANAGER'] },
  { href: '/dashboard/inventory', label: 'Inventory', roles: ['OWNER', 'MANAGER'] },
  { href: '/dashboard/categories', label: 'Categories', roles: ['OWNER', 'MANAGER'] },
  { href: '/dashboard/customers', label: 'Customers', roles: ['OWNER', 'MANAGER'] },
  { href: '/dashboard/suppliers', label: 'Suppliers', roles: ['OWNER', 'MANAGER'] },
  { href: '/dashboard/reports', label: 'Reports', roles: ['OWNER', 'MANAGER'] },
  { href: '/dashboard/staff', label: 'Staff', roles: ['OWNER', 'MANAGER'] },
  { href: '/dashboard/expenses', label: 'Expenses', roles: ['OWNER', 'MANAGER'] },
  { href: '/dashboard/settings', label: 'Settings', roles: ['OWNER'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  if (!session) return null;

  const visibleItems = menuItems.filter((item) => item.roles.includes(session.user.role));

  if (visibleItems.length === 0) return null;

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-[calc(100vh-64px)] shadow-lg">
      <div className="p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Main Menu</h2>
        <nav className="mt-6 space-y-2">
          {visibleItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-4 py-2 rounded-lg transition-colors ${
                pathname === item.href
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}
