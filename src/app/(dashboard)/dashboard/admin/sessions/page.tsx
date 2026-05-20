'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AlertCircle, CheckCircle2, Shield, RefreshCcw, LogOut } from 'lucide-react';

type SessionStatus = 'ACTIVE' | 'INACTIVE';

type SessionRow = {
  id: string;
  status: SessionStatus;
  ip: string | null;
  userAgent: string | null;
  device: string | null;
  createdAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
  user: { id: string; name: string; email: string; role: string };
  revokedBy: { id: string; name: string; email: string } | null;
};

type LoginEventRow = {
  id: string;
  email: string;
  success: boolean;
  error: string | null;
  ip: string | null;
  userAgent: string | null;
  device: string | null;
  timestamp: string;
  user: { id: string; name: string; email: string; role: string } | null;
};

export default function AdminSessionsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';
  const mySessionId = (session?.user as any)?.sessionId as string | undefined;

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [events, setEvents] = useState<LoginEventRow[]>([]);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/sessions?takeSessions=200&takeEvents=300');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch (e: any) {
      setToast({ type: 'error', message: e.message || 'Failed to load sessions' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    refresh();
    const t = window.setInterval(refresh, 10_000);
    return () => window.clearInterval(t);
  }, [isAdmin]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const forceLogout = async (targetSessionId: string) => {
    if (targetSessionId === mySessionId) {
      setToast({ type: 'error', message: 'You cannot force logout your own session from here.' });
      return;
    }

    const reason = prompt('Reason for forced logout (required):')?.trim();
    if (!reason) return;

    setRevokingId(targetSessionId);
    try {
      const res = await fetch('/api/admin/sessions/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: targetSessionId, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revoke session');
      setToast({ type: 'success', message: 'Session revoked' });
      await refresh();
    } catch (e: any) {
      setToast({ type: 'error', message: e.message || 'Failed to revoke session' });
    } finally {
      setRevokingId(null);
    }
  };

  const activeCount = useMemo(() => sessions.filter((s) => s.status === 'ACTIVE').length, [sessions]);

  if (session && !isAdmin) {
    return (
      <div className="p-4 md:p-8 animate-entrance">
        <div className="card-premium p-10 text-center">
          <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground">Admin Only</h1>
          <p className="text-muted-foreground mt-2">Login monitoring is restricted to the Admin account.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-entrance">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="w-7 h-7 text-primary" />
            Login Monitor
          </h1>
          <p className="text-muted-foreground mt-1">
            {sessions.length} session(s) • {activeCount} active
          </p>
        </div>
        <button onClick={refresh} disabled={loading} className="btn-secondary h-10 px-4 flex items-center gap-2">
          <RefreshCcw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent mb-4"></div>
          <p className="text-muted-foreground font-medium">Loading login activity…</p>
        </div>
      ) : (
        <>
          <div className="card-premium overflow-hidden border-none shadow-xl">
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-left">
                <thead className="bg-muted/50 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 md:px-6 py-4">User</th>
                    <th className="px-4 md:px-6 py-4">Status</th>
                    <th className="px-4 md:px-6 py-4">IP</th>
                    <th className="px-4 md:px-6 py-4">Device</th>
                    <th className="px-4 md:px-6 py-4">Last Seen</th>
                    <th className="px-4 md:px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 md:px-6 py-4">
                        <div className="font-semibold text-foreground">{s.user.name}</div>
                        <div className="text-xs text-muted-foreground">{s.user.email} • {s.user.role}</div>
                      </td>
                      <td className="px-4 md:px-6 py-4">
                        <span
                          className={[
                            'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                            s.status === 'ACTIVE'
                              ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'
                              : 'text-muted-foreground bg-muted/40 border-border',
                          ].join(' ')}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-4 text-sm text-muted-foreground font-mono">
                        {s.ip || '—'}
                      </td>
                      <td className="px-4 md:px-6 py-4 text-sm text-muted-foreground">
                        {s.device ? (() => { try { const d = JSON.parse(s.device); return `${d.deviceType} • ${d.os} • ${d.browser}`; } catch { return s.device; } })() : (s.userAgent || '—')}
                      </td>
                      <td className="px-4 md:px-6 py-4 text-sm text-muted-foreground">
                        {new Date(s.lastSeenAt).toLocaleString()}
                      </td>
                      <td className="px-4 md:px-6 py-4 text-right">
                        <button
                          onClick={() => forceLogout(s.id)}
                          disabled={revokingId === s.id || s.status !== 'ACTIVE' || s.id === mySessionId}
                          className="btn-secondary h-9 px-3 inline-flex items-center gap-2 disabled:opacity-40"
                        >
                          <LogOut className="w-4 h-4" />
                          Force Logout
                        </button>
                      </td>
                    </tr>
                  ))}
                  {sessions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                        No sessions found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card-premium overflow-hidden border-none shadow-xl">
            <div className="px-4 md:px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-foreground">Login Events</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Recent authentication attempts</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-left">
                <thead className="bg-muted/50 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 md:px-6 py-4">Result</th>
                    <th className="px-4 md:px-6 py-4">Email</th>
                    <th className="px-4 md:px-6 py-4">IP</th>
                    <th className="px-4 md:px-6 py-4">Device</th>
                    <th className="px-4 md:px-6 py-4">Time</th>
                    <th className="px-4 md:px-6 py-4">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {events.map((e) => (
                    <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 md:px-6 py-4">
                        {e.success ? (
                          <span className="inline-flex items-center gap-2 text-emerald-600 text-sm font-semibold">
                            <CheckCircle2 className="w-4 h-4" /> Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-destructive text-sm font-semibold">
                            <AlertCircle className="w-4 h-4" /> Failed
                          </span>
                        )}
                      </td>
                      <td className="px-4 md:px-6 py-4 text-sm text-muted-foreground">{e.email}</td>
                      <td className="px-4 md:px-6 py-4 text-sm text-muted-foreground font-mono">{e.ip || '—'}</td>
                      <td className="px-4 md:px-6 py-4 text-sm text-muted-foreground">
                        {e.device ? (() => { try { const d = JSON.parse(e.device); return `${d.deviceType} • ${d.os} • ${d.browser}`; } catch { return e.device; } })() : (e.userAgent || '—')}
                      </td>
                      <td className="px-4 md:px-6 py-4 text-sm text-muted-foreground">
                        {new Date(e.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 md:px-6 py-4 text-sm text-muted-foreground">
                        {e.error || '—'}
                      </td>
                    </tr>
                  ))}
                  {events.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                        No login events found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div
          className={[
            'fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium',
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-destructive/10 text-destructive border-destructive/20',
          ].join(' ')}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

