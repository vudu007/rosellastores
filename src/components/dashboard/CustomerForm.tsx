'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import { Customer, CustomerCreateInput } from '@/types';
import { createCustomerAction, updateCustomerAction } from '@/app/actions/customer.actions';

interface CustomerFormProps {
  editingCustomer?: Customer | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const emptyForm: CustomerCreateInput = {
  name: '',
  email: '',
  phone: '',
};

export function CustomerForm({ editingCustomer, onSuccess, onCancel }: CustomerFormProps) {
  const [formData, setFormData] = useState<CustomerCreateInput>(
    editingCustomer
      ? {
          name: editingCustomer.name,
          email: editingCustomer.email ?? '',
          phone: editingCustomer.phone ?? '',
        }
      : emptyForm
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingCustomer) {
        await updateCustomerAction(editingCustomer.id, formData);
      } else {
        await createCustomerAction(formData);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card-premium p-6 border-none ring-1 ring-primary/20 animate-slide-up">
      <h2 className="text-base font-bold mb-5 flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" />
        {editingCustomer ? 'Edit Customer' : 'New Customer'}
      </h2>
      {error && <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-lg">{error}</div>}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Full Name *</label>
          <input
            type="text"
            placeholder="e.g. Amina Okafor"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="input-base bg-muted/30 border-none"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Email</label>
          <input
            type="email"
            placeholder="email@example.com"
            value={formData.email || ''}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="input-base bg-muted/30 border-none"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Phone</label>
          <input
            type="tel"
            placeholder="+234 800 000 0000"
            value={formData.phone || ''}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="input-base bg-muted/30 border-none"
          />
        </div>
        <div className="col-span-full flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving…' : editingCustomer ? 'Update Customer' : 'Add Customer'}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary px-6">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
