'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Users, UserPlus, Trash2, Mail, Building, Key,
  Shield, AlertCircle, CheckCircle2, Search, X, Pencil
} from 'lucide-react';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  branch: { name: string } | null;
  createdAt: string;
}

interface Branch {
  id: string;
  name: string;
}

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
  
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'CASHIER',
    branchId: '',
  });

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
      setStaff(data);
    } catch (error) {
      setToast({ type: 'error', message: 'Failed to fetch staff' });
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/branches');
      const data = await res.json();
      setBranches(data);
    } catch {
      // Ignoring branch error if there are no branches setup yet
    }
  };

  const handleSaveStaff = async () => {
    if (!form.name || !form.email || (!isEditing && !form.password) || !form.role || !form.branchId) {
      setToast({ type: 'error', message: 'Please fill in all required fields' });
      return;
    }

    try {
      const payload = isEditing ? { id: editId, ...form } : form;
      const res = await fetch('/api/staff', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save staff');
      }

      setToast({ type: 'success', message: `Staff member ${isEditing ? 'updated' : 'added'} successfully` });
      setShowModal(false);
      setForm({ name: '', email: '', password: '', role: 'CASHIER', branchId: '' });
      setIsEditing(false);
      setEditId(null);
      fetchStaff();
    } catch (error: any) {
      setToast({ type: 'error', message: error.message });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}? Access will be revoked immediately.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/staff?id=${id}`, {
        method: 'DELETE',
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setToast({ type: 'success', message: 'Staff member removed' });
      fetchStaff();
    } catch (error: any) {
      setToast({ type: 'error', message: error.message });
    }
  };

  const filteredStaff = staff.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'OWNER': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'MANAGER': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="p-8 space-y-6 animate-entrance">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-slide-up ${toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Staff Management</h1>
          <p className="text-muted-foreground mt-1">Manage team members, roles, and branch assignments.</p>
        </div>
        {session?.user.role === 'OWNER' && (
          <button onClick={() => {
            setIsEditing(false);
            setEditId(null);
            setForm({ name: '', email: '', password: '', role: 'CASHIER', branchId: '' });
            setShowModal(true);
          }} className="btn-primary flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Add Staff Member
          </button>
        )}
      </div>

      {/* Search */}
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="card-premium p-12 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg text-foreground">No staff found</h3>
          <p className="text-muted-foreground mt-1">You haven&apos;t added any staff members yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStaff.map((member) => (
            <div key={member.id} className="card-premium p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  {session?.user.role === 'OWNER' && member.id !== session.user.id && (
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => {
                          setIsEditing(true);
                          setEditId(member.id);
                          setForm({ name: member.name, email: member.email, password: '', role: member.role, branchId: branches.find(b => b.name === member.branch?.name)?.id || '' });
                          setShowModal(true);
                        }} 
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Edit Staff"
                      >
                        <Pencil className="w-4 h-4 text-gray-500" />
                      </button>
                      <button 
                        onClick={() => handleDelete(member.id, member.name)} 
                        className="p-2 rounded-lg hover:bg-red-50 transition-colors" title="Remove Access"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  )}
                </div>
                <h3 className="text-lg font-bold text-foreground mt-4">{member.name}</h3>
                
                <div className="mt-2 text-sm flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4" /> {member.email}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building className="w-4 h-4" /> {member.branch?.name || 'No Branch'}
                  </div>
                </div>
                
                <div className="mt-4">
                  <span className={`px-2.5 py-1 text-xs font-bold border rounded-lg flex items-center w-max gap-1.5 ${getRoleBadgeColor(member.role)}`}>
                    <Shield className="w-3 h-3" />
                    {member.role}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Staff Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">{isEditing ? 'Edit Staff Details' : 'Add New Staff'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-muted/50"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Full Name *</label>
                <input 
                  value={form.name} 
                  onChange={(e) => setForm({ ...form, name: e.target.value })} 
                  className="input-base mt-1" 
                  placeholder="e.g. Jane Doe" 
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-foreground">Email Address (for login) *</label>
                <input 
                  type="email" 
                  value={form.email} 
                  onChange={(e) => setForm({ ...form, email: e.target.value })} 
                  className="input-base mt-1" 
                  placeholder="jane@mekaerp.com"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-foreground">{isEditing ? 'New Password (leave blank to keep current)' : 'Password *'}</label>
                <input 
                  type="text" 
                  value={form.password} 
                  onChange={(e) => setForm({ ...form, password: e.target.value })} 
                  className="input-base mt-1" 
                  placeholder={isEditing ? 'Enter new password...' : 'Generated/Temporary password'} 
                />
                {!isEditing && <p className="text-xs text-muted-foreground mt-1">Provide this password to the staff member so they can log in.</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Role *</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="input-base mt-1"
                  >
                    <option value="CASHIER">Cashier (POS Only)</option>
                    <option value="MANAGER">Manager (Full Access)</option>
                    {session?.user.role === 'OWNER' && (
                      <option value="OWNER">Owner (Admin)</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Assigned Branch *</label>
                  <select 
                    value={form.branchId} 
                    onChange={(e) => setForm({ ...form, branchId: e.target.value })} 
                    className="input-base mt-1"
                  >
                    <option value="">Select a branch</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>
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
