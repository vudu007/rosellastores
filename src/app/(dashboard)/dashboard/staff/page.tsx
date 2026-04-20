'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Users, UserPlus, Trash2, Mail, Building, Key,
  Shield, AlertCircle, CheckCircle2, Search, X, Pencil, Clock, Timer
} from 'lucide-react';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  branch: { name: string } | null;
  createdAt: string;
  tempExpiresAt?: string | null;
}

interface Branch {
  id: string;
  name: string;
}

const emptyForm = {
  name: '', email: '', password: '', role: 'CASHIER', branchId: '', tempAccount: false,
};

export default function StaffPage() {
  const { data: session } = useSession();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [form, setForm] = useState(emptyForm);

  const canManage = ['ADMIN', 'OWNER'].includes(session?.user?.role || '');

  useEffect(() => { fetchStaff(); fetchBranches(); }, []);
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }
  }, [toast]);

  const fetchStaff = async () => {
    try {
      const res = await fetch('/api/staff');
      const data = await res.json();
      setStaff(Array.isArray(data) ? data : []);
    } catch { setToast({ type: 'error', message: 'Failed to fetch staff' }); }
    finally { setLoading(false); }
  };

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/branches');
      const data = await res.json();
      setBranches(Array.isArray(data) ? data : []);
    } catch {}
  };

  const handleSaveStaff = async () => {
    if (!form.name || !form.email || (!isEditing && !form.password) || !form.role) {
      setToast({ type: 'error', message: 'Name, email, password, and role are required' });
      return;
    }
    try {
      const payload: any = { ...form };
      if (isEditing) payload.id = editId;
      const res = await fetch('/api/staff', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setToast({ type: 'success', message: `Staff member ${isEditing ? 'updated' : 'added'} successfully` });
      setShowModal(false);
      setForm(emptyForm);
      setIsEditing(false);
      setEditId(null);
      fetchStaff();
    } catch (e: any) { setToast({ type: 'error', message: e.message }); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove ${name}? Their access will be revoked immediately.`)) return;
    try {
      const res = await fetch(`/api/staff?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setToast({ type: 'success', message: 'Staff member removed' });
      fetchStaff();
    } catch (e: any) { setToast({ type: 'error', message: e.message }); }
  };

  const filteredStaff = staff.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':    return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'OWNER':    return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'MANAGER':  return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'CASHIER':  return 'bg-green-100 text-green-800 border-green-200';
      default:         return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTempStatus = (expiresAt?: string | null) => {
    if (!expiresAt) return null;
    const exp = new Date(expiresAt);
    const now = new Date();
    if (now > exp) return { label: 'EXPIRED', color: 'bg-red-100 text-red-700 border-red-200' };
    const hrs = Math.ceil((exp.getTime() - now.getTime()) / 3600000);
    return { label: `Expires in ${hrs}h`, color: 'bg-amber-100 text-amber-700 border-amber-200' };
  };

  const roleOptions = () => {
    const base = [
      { value: 'CASHIER', label: 'Cashier — POS Terminal only' },
      { value: 'MANAGER', label: 'Manager — Full dashboard access' },
    ];
    if (session?.user?.role === 'ADMIN') {
      return [
        { value: 'ADMIN',  label: 'Admin — Full system access incl. Settings' },
        { value: 'OWNER',  label: 'Owner — Full access except Settings' },
        ...base,
      ];
    }
    if (session?.user?.role === 'OWNER') {
      return base;
    }
    return base;
  };

  return (
    <div className="p-4 md:p-8 space-y-6 animate-entrance">
      {toast && (
        <div className={`fixed top-6 right-6 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-slide-up ${toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
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
          <button onClick={() => { setIsEditing(false); setEditId(null); setForm(emptyForm); setShowModal(true); }}
            className="btn-primary flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Add Staff Member
          </button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Search by name or email..." value={search}
          onChange={(e) => setSearch(e.target.value)} className="input-base pl-10" />
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
                        <button onClick={() => {
                          setIsEditing(true); setEditId(member.id);
                          setForm({ name: member.name, email: member.email, password: '', role: member.role, branchId: branches.find(b => b.name === member.branch?.name)?.id || '', tempAccount: !!member.tempExpiresAt });
                          setShowModal(true);
                        }} className="p-2 rounded-lg hover:bg-muted transition-colors">
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <button onClick={() => handleDelete(member.id, member.name)}
                          className="p-2 rounded-lg hover:bg-red-50 transition-colors">
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
                    <span className={`px-2.5 py-1 text-xs font-bold border rounded-lg flex items-center gap-1.5 ${getRoleBadgeColor(member.role)}`}>
                      <Shield className="w-3 h-3" /> {member.role}
                    </span>
                    {tempStatus && (
                      <span className={`px-2.5 py-1 text-xs font-bold border rounded-lg flex items-center gap-1.5 ${tempStatus.color}`}>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">{isEditing ? 'Edit Staff Details' : 'Add New Staff Member'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-muted/50"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Full Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-base mt-1" placeholder="e.g. Jane Doe" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Email Address *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input-base mt-1" placeholder="jane@example.com" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">{isEditing ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input-base mt-1" placeholder={isEditing ? 'Enter new password...' : 'Temporary password'} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Role *</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input-base mt-1">
                    {roleOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Branch</label>
                  <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} className="input-base mt-1">
                    <option value="">No branch</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Temporary Account Toggle */}
              <div className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${form.tempAccount ? 'border-amber-400 bg-amber-50' : 'border-border bg-muted/20'}`}
                onClick={() => setForm({ ...form, tempAccount: !form.tempAccount })}>
                <div className="flex items-center gap-3">
                  <Clock className={`w-5 h-5 ${form.tempAccount ? 'text-amber-600' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Temporary Account (24 hours)</p>
                    <p className="text-xs text-muted-foreground">Account expires automatically after 24 hours</p>
                  </div>
                </div>
                <div className={`w-11 h-6 rounded-full transition-colors relative ${form.tempAccount ? 'bg-amber-400' : 'bg-muted'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.tempAccount ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </div>
              {form.tempAccount && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  This account will automatically stop working 24 hours after creation. Useful for contractors, auditors, or temporary staff.
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSaveStaff} className="btn-primary flex-1 flex justify-center gap-2 items-center">
                {isEditing ? <Pencil className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                {isEditing ? 'Save Changes' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
