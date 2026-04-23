'use client';

import { useState, useEffect } from 'react';
import { X, Shield, Building, Mail, Key, Timer } from 'lucide-react';
import { StaffMember, Branch, UserRole } from '@/types';
import { createStaffAction, updateStaffAction } from '@/app/actions/staff.actions';
import { useSession } from 'next-auth/react';

interface StaffFormProps {
  editingMember?: any | null;
  branches: Branch[];
  onSuccess: () => void;
  onCancel: () => void;
}

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role: 'CASHIER' as UserRole,
  branchId: '',
  tempAccount: false,
};

export function StaffForm({ editingMember, branches, onSuccess, onCancel }: StaffFormProps) {
  const { data: session } = useSession();
  const [form, setForm] = useState(
    editingMember
      ? {
          name: editingMember.name,
          email: editingMember.email,
          password: '',
          role: editingMember.role as UserRole,
          branchId: editingMember.branchId || '',
          tempAccount: !!editingMember.tempExpiresAt,
        }
      : emptyForm
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleOptions = () => {
    const base = [
      { value: 'CASHIER', label: 'Cashier — POS Terminal only' },
      { value: 'MANAGER', label: 'Manager — Full dashboard access' },
    ];
    if (session?.user?.role === 'ADMIN') {
      return [
        { value: 'ADMIN', label: 'Admin — Full system access incl. Settings' },
        { value: 'OWNER', label: 'Owner — Full access except Settings' },
        ...base,
      ];
    }
    if (session?.user?.role === 'OWNER') {
      return base;
    }
    return base;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingMember) {
        await updateStaffAction(editingMember.id, form);
      } else {
        await createStaffAction(form);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">
            {editingMember ? 'Edit Staff Details' : 'Add New Staff Member'}
          </h2>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-muted/50">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-lg text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Full Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-base mt-1"
              placeholder="e.g. Jane Doe"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Email Address *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input-base mt-1"
              placeholder="jane@example.com"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">
              {editingMember ? 'New Password (leave blank to keep current)' : 'Password *'}
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="input-base mt-1 pl-10"
                placeholder="••••••••"
                required={!editingMember}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">Role *</label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                  className="input-base mt-1 pl-10"
                >
                  {roleOptions().map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Branch Assignment</label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <select
                  value={form.branchId}
                  onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                  className="input-base mt-1 pl-10"
                >
                  <option value="">No Branch (Global Access)</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="p-4 bg-muted/30 rounded-xl space-y-3">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={form.tempAccount}
                  onChange={(e) => setForm({ ...form, tempAccount: e.target.checked })}
                  className="peer h-5 w-5 appearance-none rounded border border-input bg-background checked:bg-primary checked:border-primary transition-all"
                />
                <X className="absolute h-4 w-4 text-white opacity-0 peer-checked:opacity-100 left-0.5 pointer-events-none" />
              </div>
              <div>
                <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  Temporary Account
                </span>
                <p className="text-xs text-muted-foreground">Access will automatically expire in 24 hours.</p>
              </div>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : editingMember ? 'Update Staff Member' : 'Create Staff Member'}
            </button>
            <button type="button" onClick={onCancel} className="btn-secondary px-6">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
