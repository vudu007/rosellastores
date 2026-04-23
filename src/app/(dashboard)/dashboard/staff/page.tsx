'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Users, UserPlus, Trash2, Mail, Building,
  Shield, AlertCircle, CheckCircle2, Search, Pencil, Timer
} from 'lucide-react';
import { StaffMember, Branch } from '@/types';
import { StaffForm } from '@/components/dashboard/StaffForm';
import { deleteStaffAction } from '@/app/actions/staff.actions';

export default function StaffPage() {
  const { data: session } = useSession();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const canManage = ['ADMIN', 'OWNER'].includes(session?.user?.role || '');

  useEffect(() => {
    fetchStaff();
    fetchBranches();
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const fetchStaff = async () => {
    try {
      const res = await fetch('/api/staff');
      const data = await res.json();
      setStaff(Array.isArray(data) ? data : []);
    } catch {
      setToast({ type: 'error', message: 'Failed to fetch staff' });
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/branches');
      const data = await res.json();
      setBranches(Array.isArray(data) ? data : []);
    } catch {}
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove ${name}? Their access will be revoked immediately.`)) return;
    try {
      await deleteStaffAction(id);
      setToast({ type: 'success', message: 'Staff member removed' });
      fetchStaff();
    } catch (e: any) {
      setToast({ type: 'error', message: e.message });
    }
  };

  const filteredStaff = staff.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'OWNER':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'MANAGER':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'CASHIER':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTempStatus = (expiresAt?: string | Date | null) => {
    if (!expiresAt) return null;
    const exp = new Date(expiresAt);
    const now = new Date();
    if (now > exp) return { label: 'EXPIRED', color: 'bg-red-100 text-red-700 border-red-200' };
    const hrs = Math.ceil((exp.getTime() - now.getTime()) / 3600000);
    return { label: `Expires in ${hrs}h`, color: 'bg-amber-100 text-amber-700 border-amber-200' };
  };

  return (
    <div className="p-4 md:p-8 space-y-6 animate-entrance">
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-slide-up ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Staff Management</h1>
          <p className="text-muted-foreground mt-1">Manage team members, roles, and access levels.</p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              setEditingMember(null);
              setShowModal(true);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" /> Add Staff Member
          </button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-base pl-10"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="card-premium p-12 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg text-foreground">No staff found</h3>
          <p className="text-muted-foreground mt-1">No staff members match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStaff.map((member) => {
            const tempStatus = getTempStatus(member.tempExpiresAt);
            return (
              <div key={member.id} className="card-premium p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-lg">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    {canManage && member.id !== session?.user?.id && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingMember(member);
                            setShowModal(true);
                          }}
                          className="p-2 rounded-lg hover:bg-muted transition-colors"
                        >
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleDelete(member.id, member.name)}
                          className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-foreground mt-4">{member.name}</h3>
                  <div className="mt-2 text-sm flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-4 h-4 shrink-0" /> {member.email}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building className="w-4 h-4 shrink-0" /> {member.branch?.name || 'No Branch'}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span
                      className={`px-2.5 py-1 text-xs font-bold border rounded-lg flex items-center gap-1.5 ${getRoleBadgeColor(
                        member.role
                      )}`}
                    >
                      <Shield className="w-3 h-3" /> {member.role}
                    </span>
                    {tempStatus && (
                      <span
                        className={`px-2.5 py-1 text-xs font-bold border rounded-lg flex items-center gap-1.5 ${tempStatus.color}`}
                      >
                        <Timer className="w-3 h-3" /> {tempStatus.label}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <StaffForm
          editingMember={editingMember}
          branches={branches}
          onSuccess={() => {
            setShowModal(false);
            setEditingMember(null);
            fetchStaff();
            setToast({
              type: 'success',
              message: `Staff member ${editingMember ? 'updated' : 'added'} successfully`,
            });
          }}
          onCancel={() => {
            setShowModal(false);
            setEditingMember(null);
          }}
        />
      )}
    </div>
  );
}
