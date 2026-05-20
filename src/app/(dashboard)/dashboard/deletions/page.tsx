'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AlertCircle, CheckCircle2, Clock, RefreshCcw, ShieldAlert, Trash2 } from 'lucide-react';

type DeletionStatus = 'SOFT_DELETED' | 'APPROVED' | 'PERMANENT_DELETED' | 'CANCELLED';
type DeletionEntityType = 'CATEGORY' | 'PRODUCT' | 'SUPPLIER';

type DeletionRow = {
  id: string;
  entityType: DeletionEntityType;
  entityId: string;
  reason: string;
  status: DeletionStatus;
  requestedAt: string;
  earliestPermanentAt: string;
  approvedAt: string | null;
  executedAt: string | null;
  requestedById: string;
  requestedBy: { id: string; name: string; email: string; role: string };
  approvedById: string | null;
  approvedBy: { id: string; name: string; email: string; role: string } | null;
  executedById: string | null;
  executedBy: { id: string; name: string; email: string; role: string } | null;
  entity: any | null;
};

export default function DeletionsPage() {
  const { data: session } = useSession();
  const canManage = session?.user?.role === 'ADMIN' || session?.user?.role === 'OWNER';
  const isAdmin = session?.user?.role === 'ADMIN';

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DeletionRow[]>([]);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/deletions?take=300');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setRows(Array.isArray(data.requests) ? data.requests : []);
    } catch (e: any) {
      setToast({ type: 'error', message: e.message || 'Failed to load deletions' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canManage) return;
    refresh();
  }, [canManage]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const approve = async (id: string) => {
    setWorkingId(id);
    try {
      const res = await fetch(`/api/deletions/${id}/approve`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve');
      setToast({ type: 'success', message: 'Approved' });
      await refresh();
    } catch (e: any) {
      setToast({ type: 'error', message: e.message || 'Failed to approve' });
    } finally {
      setWorkingId(null);
    }
  };

  const permanentlyDelete = async (id: string) => {
    if (!confirm('Permanently delete this record? This cannot be undone.')) return;
    setWorkingId(id);
    try {
      const res = await fetch(`/api/deletions/${id}/permanent`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to permanently delete');
      setToast({ type: 'success', message: 'Permanently deleted' });
      await refresh();
    } catch (e: any) {
      setToast({ type: 'error', message: e.message || 'Failed to permanently delete' });
    } finally {
      setWorkingId(null);
    }
  };

  const purgeAll = async () => {
    if (!confirm('Permanently delete ALL soft-deleted items, categories, and suppliers now? This cannot be undone.')) return;
    setWorkingId('purge-all');
    try {
      const res = await fetch('/api/deletions/purge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to purge');
      const msg = `Purged: ${data.summary?.deleted ?? 0} deleted, ${data.summary?.failed ?? 0} failed`;
      setToast({ type: 'success', message: msg });
      await refresh();
    } catch (e: any) {
      setToast({ type: 'error', message: e.message || 'Failed to purge' });
    } finally {
      setWorkingId(null);
    }
  };

  const purgeDummy = async () => {
    if (!confirm('Permanently delete dummy suppliers/categories/products (E2E / Imported / IMP-)? This cannot be undone.')) return;
    setWorkingId('purge-dummy');
    try {
      const res = await fetch('/api/admin/purge-dummy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete dummy data');
      const msg = `Deleted dummy: ${data.deleted?.products ?? 0} products, ${data.deleted?.categories ?? 0} categories, ${data.deleted?.suppliers ?? 0} suppliers`;
      setToast({ type: 'success', message: msg });
      await refresh();
    } catch (e: any) {
      setToast({ type: 'error', message: e.message || 'Failed to delete dummy data' });
    } finally {
      setWorkingId(null);
    }
  };

  const activeCount = useMemo(() => rows.filter((r) => r.status !== 'PERMANENT_DELETED').length, [rows]);

  const describeEntity = (r: DeletionRow) => {
    if (!r.entity) return `${r.entityType} • ${r.entityId}`;
    if (r.entityType === 'PRODUCT') return `${r.entity.name} (${r.entity.sku})`;
    return r.entity.name;
  };

  const statusBadge = (status: DeletionStatus) => {
    if (status === 'SOFT_DELETED') return 'text-amber-600 bg-amber-500/10 border-amber-500/20';
    if (status === 'APPROVED') return 'text-blue-600 bg-blue-500/10 border-blue-500/20';
    if (status === 'PERMANENT_DELETED') return 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20';
    return 'text-muted-foreground bg-muted/40 border-border';
  };

  if (session && !canManage) {
    return (
      <div className="p-4 md:p-8 animate-entrance">
        <div className="card-premium p-10 text-center">
          <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground">Restricted</h1>
          <p className="text-muted-foreground mt-2">Deletion management is available to Owner and Admin only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-entrance">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <ShieldAlert className="w-7 h-7 text-primary" />
            Deletions
          </h1>
          <p className="text-muted-foreground mt-1">{rows.length} request(s) • {activeCount} active</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={purgeAll}
              disabled={workingId === 'purge-all' || loading}
              className="btn-secondary h-10 px-4 flex items-center gap-2 disabled:opacity-40"
            >
              <Trash2 className="w-4 h-4" />
              Purge All
            </button>
          )}
          {isAdmin && (
            <button
              onClick={purgeDummy}
              disabled={workingId === 'purge-dummy' || loading}
              className="btn-secondary h-10 px-4 flex items-center gap-2 disabled:opacity-40"
            >
              <Trash2 className="w-4 h-4" />
              Delete Dummy
            </button>
          )}
          <button onClick={refresh} disabled={loading} className="btn-secondary h-10 px-4 flex items-center gap-2">
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent mb-4"></div>
          <p className="text-muted-foreground font-medium">Loading deletion requests…</p>
        </div>
      ) : (
        <div className="card-premium overflow-hidden border-none shadow-xl">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 md:px-6 py-4">Entity</th>
                  <th className="px-4 md:px-6 py-4">Reason</th>
                  <th className="px-4 md:px-6 py-4">Requested</th>
                  <th className="px-4 md:px-6 py-4">Status</th>
                  <th className="px-4 md:px-6 py-4">72h Lock</th>
                  <th className="px-4 md:px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => {
                  const now = Date.now();
                  const unlockAt = new Date(r.earliestPermanentAt).getTime();
                  const locked = now < unlockAt;
                  const canApprove =
                    r.status === 'SOFT_DELETED' &&
                    (session?.user?.role === 'ADMIN' || r.requestedById !== session?.user?.id);
                  const canPermanent = isAdmin
                    ? r.status !== 'PERMANENT_DELETED' && r.status !== 'CANCELLED'
                    : r.status === 'APPROVED' && !locked;

                  const lockText = locked
                    ? (() => {
                        const mins = Math.ceil((unlockAt - now) / 60_000);
                        const hrs = Math.floor(mins / 60);
                        const rem = mins % 60;
                        return `${hrs}h ${rem}m`;
                      })()
                    : 'Unlocked';

                  return (
                    <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 md:px-6 py-4">
                        <div className="font-semibold text-foreground">{describeEntity(r)}</div>
                        <div className="text-xs text-muted-foreground">{r.entityType} • by {r.requestedBy.name}</div>
                      </td>
                      <td className="px-4 md:px-6 py-4 text-sm text-muted-foreground">{r.reason}</td>
                      <td className="px-4 md:px-6 py-4 text-sm text-muted-foreground">
                        {new Date(r.requestedAt).toLocaleString()}
                      </td>
                      <td className="px-4 md:px-6 py-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-4 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          {lockText}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => approve(r.id)}
                            disabled={!canApprove || workingId === r.id}
                            className="btn-secondary h-9 px-3 disabled:opacity-40"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => permanentlyDelete(r.id)}
                            disabled={!canPermanent || workingId === r.id}
                            className="btn-secondary h-9 px-3 inline-flex items-center gap-2 disabled:opacity-40"
                          >
                            <Trash2 className="w-4 h-4" />
                            Permanent
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                      No deletion requests found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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
          {toast.type === 'success' ? (
            <span className="inline-flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{toast.message}</span>
          ) : (
            <span className="inline-flex items-center gap-2"><AlertCircle className="w-4 h-4" />{toast.message}</span>
          )}
        </div>
      )}
    </div>
  );
}
