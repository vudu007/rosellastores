'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  LayoutDashboard, ShoppingBag, Package, Tag,
  Users, Truck, BarChart2, Users2, CreditCard,
  Settings, ShoppingCart
} from 'lucide-react';

const menuItems = [
  { href: '/dashboard',            label: 'Overview',    icon: LayoutDashboard, roles: ['OWNER', 'MANAGER'] },
  { href: '/dashboard/sales',      label: 'Sales',       icon: ShoppingBag,     roles: ['OWNER', 'MANAGER'] },
  { href: '/dashboard/inventory',  label: 'Inventory',   icon: Package,         roles: ['OWNER', 'MANAGER'] },
  { href: '/dashboard/categories', label: 'Categories',  icon: Tag,             roles: ['OWNER', 'MANAGER'] },
  { href: '/dashboard/customers',  label: 'Customers',   icon: Users,           roles: ['OWNER', 'MANAGER'] },
  { href: '/dashboard/suppliers',  label: 'Suppliers',   icon: Truck,           roles: ['OWNER', 'MANAGER'] },
  { href: '/dashboard/expenses',   label: 'Expenses',    icon: CreditCard,      roles: ['OWNER', 'MANAGER'] },
  { href: '/dashboard/reports',    label: 'Reports',     icon: BarChart2,       roles: ['OWNER', 'MANAGER'] },
  { href: '/dashboard/staff',      label: 'Staff',       icon: Users2,          roles: ['OWNER', 'MANAGER'] },
  { href: '/dashboard/settings',   label: 'Settings',    icon: Settings,        roles: ['OWNER'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  if (!session) return null;

  const visibleItems = menuItems.filter((item) => item.roles.includes(session.user.role));
  if (visibleItems.length === 0) return null;

  return (
    <aside className="w-64 bg-card border-r min-h-[calc(100vh-64px)] flex flex-col">
      {/* POS shortcut */}
      <div className="p-4 border-b">
        <Link
          href="/pos"
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.02] transition-all"
        >
          <ShoppingCart className="w-4 h-4 shrink-0" />
          Open POS Terminal
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest px-3 mb-3">
          Navigation
        </p>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : ''}`} />
              {item.label}
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User card at bottom */}
      <div className="p-4 border-t">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
            {session.user.name?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{session.user.name}</p>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{session.user.role}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
