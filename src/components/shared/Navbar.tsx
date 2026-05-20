'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { LogOut, ChevronDown, Bell, User, Menu } from 'lucide-react';

interface NavbarProps {
  onMenuToggle?: () => void;
}

export default function Navbar({ onMenuToggle }: NavbarProps) {
  const { data: session } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userId = session?.user?.id;
  const hasUser = !!session?.user;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const ping = async () => {
      if (!hasUser) return;
      if (cancelled) return;
      try {
        const res = await fetch('/api/sessions/ping', { method: 'POST' });
        if (res.status === 401) {
          await signOut({ callbackUrl: '/login' });
        }
      } catch {}
    };

    ping();

    const interval = window.setInterval(ping, 60_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') ping();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [hasUser, userId]);

  if (!session) return null;

  const initials = session.user.name
    ? session.user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const roleLabel: Record<string, string> = {
    OWNER: 'Owner',
    MANAGER: 'Manager',
    CASHIER: 'Cashier',
  };

  return (
    <nav className="bg-card border-b border-border h-16 flex items-center px-6 gap-4 sticky top-0 z-40 shadow-sm">
      {/* Hamburger — mobile only */}
      {onMenuToggle && (
        <button
          onClick={onMenuToggle}
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Brand */}
      <Link href="/" className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-sm shadow-primary/30">
          <span className="text-primary-foreground font-black text-sm">R</span>
        </div>
        <span className="font-black text-foreground text-base tracking-tight hidden sm:inline">
          Rosella Stores
        </span>
      </Link>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side controls */}
      <div className="flex items-center gap-2">
        {/* Bell — placeholder for future notifications */}
        <button className="relative w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Bell className="w-4 h-4" />
        </button>

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <div className="w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-black shrink-0">
              {initials}
            </div>
            <div className="hidden sm:block text-left leading-none">
              <p className="text-sm font-semibold text-foreground truncate max-w-[120px]">
                {session.user.name || 'User'}
              </p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">
                {roleLabel[session.user.role] ?? session.user.role}
              </p>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-xl shadow-xl py-1.5 z-50 animate-entrance">
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-black shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{session.user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
                  </div>
                </div>
              </div>

              <div className="py-1">
                <Link
                  href="/dashboard/settings"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <User className="w-4 h-4 text-muted-foreground" />
                  Account Settings
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-destructive hover:bg-destructive/5 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
