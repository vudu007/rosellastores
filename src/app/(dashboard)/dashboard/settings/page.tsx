'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Settings, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'business' | 'password'>('business');
  
  const [settings, setSettings] = useState({
    businessName: '',
    businessAddress: '',
    businessPhone: '',
    taxRate: '0',
    eodTime: '21:00',
    ownerEmail: '',
    currency: 'NGN',
    businessLogo: '',
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        // Merge fetched data with defaults
        if (Object.keys(data).length > 0) {
          setSettings(prev => ({ ...prev, ...data }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (session?.user.role !== 'OWNER') {
      setToast({ type: 'error', message: 'Only OWNER can update business settings' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setToast({ type: 'success', message: 'Settings saved successfully' });
    } catch (error: any) {
      setToast({ type: 'error', message: error.message || 'Error saving settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setToast({ type: 'error', message: 'Passwords do not match' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/settings/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setToast({ type: 'success', message: 'Password updated successfully' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      setToast({ type: 'error', message: error.message || 'Error updating password' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 animate-entrance">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-slide-up ${toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-2">Manage preferences and security parameters.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Navigation Sidebar */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-2">
          {session?.user.role === 'OWNER' && (
            <button
              onClick={() => setActiveTab('business')}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'business'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-foreground'
              }`}
            >
              <Settings className="w-4 h-4" />
              Business Settings
            </button>
          )}
          
          <button
            onClick={() => setActiveTab('password')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'password'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted text-foreground'
            }`}
          >
            <Lock className="w-4 h-4" />
            Change Password
          </button>
        </div>

        {/* Content Area */}
        <div className="w-full max-w-2xl bg-card rounded-2xl shadow-sm border border-border p-8">
          
          {activeTab === 'business' && session?.user.role === 'OWNER' && (
            <form onSubmit={handleSaveSettings} className="space-y-6 animate-fade-in">
              <h2 className="text-xl font-bold mb-6 border-b pb-4">Business Details</h2>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Business Name
                </label>
                <input
                  type="text"
                  value={settings.businessName}
                  onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                  className="input-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Business Logo
                </label>
                <div className="flex items-center gap-4">
                {settings.businessLogo && (
                  <img src={settings.businessLogo} alt="Logo Preview" className="w-16 h-16 object-contain border rounded bg-white" /> // eslint-disable-line @next/next/no-img-element
                )}
                  <input
                    type="file"
                    accept="image/png, image/jpeg"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setSettings({ ...settings, businessLogo: reader.result as string });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="input-base file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Recommended format: PNG or JPG. Logo will appear on terminal receipts and invoices.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Business Address
                </label>
                <textarea
                  value={settings.businessAddress}
                  onChange={(e) => setSettings({ ...settings, businessAddress: e.target.value })}
                  className="input-base"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Business Phone
                  </label>
                  <input
                    type="tel"
                    value={settings.businessPhone}
                    onChange={(e) => setSettings({ ...settings, businessPhone: e.target.value })}
                    className="input-base"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Owner Email (for reports)
                  </label>
                  <input
                    type="email"
                    value={settings.ownerEmail}
                    onChange={(e) => setSettings({ ...settings, ownerEmail: e.target.value })}
                    className="input-base"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Currency
                  </label>
                  <select
                    value={settings.currency}
                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                    className="input-base"
                  >
                    <option value="NGN">NGN (₦)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.taxRate}
                    onChange={(e) => setSettings({ ...settings, taxRate: e.target.value })}
                    className="input-base"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    End of Day Time
                  </label>
                  <input
                    type="time"
                    value={settings.eodTime}
                    onChange={(e) => setSettings({ ...settings, eodTime: e.target.value })}
                    className="input-base"
                  />
                </div>
              </div>

              <div className="pt-4 border-t">
                <button type="submit" disabled={saving} className="btn-primary w-full md:w-auto">
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handleSavePassword} className="space-y-6 animate-fade-in">
               <h2 className="text-xl font-bold mb-6 border-b pb-4">Update Password</h2>
               <p className="text-sm text-muted-foreground mb-6">Ensure your account uses a strong password to stay secure.</p>
               
               <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="input-base"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="input-base"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="input-base"
                  />
                </div>

                <div className="pt-4 border-t">
                  <button type="submit" disabled={saving} className="btn-primary w-full md:w-auto flex items-center gap-2 justify-center">
                    <Lock className="w-4 h-4" /> {saving ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
