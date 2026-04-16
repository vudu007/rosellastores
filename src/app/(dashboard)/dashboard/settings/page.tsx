'use client';

import { useState } from 'react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    businessName: 'RetailPro Store',
    businessAddress: '123 Commerce Street',
    businessPhone: '+234-800-000-0000',
    taxRate: '7.5',
    eodTime: '21:00',
    ownerEmail: 'owner@store.com',
    currency: 'NGN',
  });

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // In a real app, this would save to the database
      alert('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">Manage business settings and preferences</p>
      </div>

      <div className="card p-8 max-w-2xl">
        <form className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Business Name
            </label>
            <input
              type="text"
              value={settings.businessName}
              onChange={(e) =>
                setSettings({ ...settings, businessName: e.target.value })
              }
              className="input-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Business Address
            </label>
            <textarea
              value={settings.businessAddress}
              onChange={(e) =>
                setSettings({ ...settings, businessAddress: e.target.value })
              }
              className="input-base"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Business Phone
            </label>
            <input
              type="tel"
              value={settings.businessPhone}
              onChange={(e) =>
                setSettings({ ...settings, businessPhone: e.target.value })
              }
              className="input-base"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Currency
              </label>
              <select
                value={settings.currency}
                onChange={(e) =>
                  setSettings({ ...settings, currency: e.target.value })
                }
                className="input-base"
              >
                <option value="NGN">NGN (Nigerian Naira)</option>
                <option value="USD">USD (US Dollar)</option>
                <option value="EUR">EUR (Euro)</option>
                <option value="GBP">GBP (British Pound)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End of Day Time (HH:mm)
            </label>
            <input
              type="time"
              value={settings.eodTime}
              onChange={(e) => setSettings({ ...settings, eodTime: e.target.value })}
              className="input-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Owner Email (for EOD reports)
            </label>
            <input
              type="email"
              value={settings.ownerEmail}
              onChange={(e) =>
                setSettings({ ...settings, ownerEmail: e.target.value })
              }
              className="input-base"
            />
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary disabled:opacity-50 w-full"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>
    </div>
  );
}
