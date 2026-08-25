import React, { useState } from 'react';
import { Store, Save, CheckCircle2, Phone, MessageSquare, MapPin, Award, Palette, Sparkles } from 'lucide-react';
import { ShopSettings } from '@shared/types';
import { api } from '../services/api';

interface SettingsPageProps {
  settings: ShopSettings | null;
  onSettingsSaved: (updated: ShopSettings) => void;
}

const THEME_OPTIONS: {
  id: ShopSettings['themeId'];
  name: string;
  desc: string;
  primaryBg: string;
  accent: string;
  badge: string;
}[] = [
  {
    id: 'emerald-classic',
    name: 'Emerald Classic (Recommended)',
    desc: 'Deep mandi emerald green with amber gold badges',
    primaryBg: 'bg-emerald-950',
    accent: '#f59e0b',
    badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
  },
  {
    id: 'sapphire-modern',
    name: 'Sapphire Modern',
    desc: 'Corporate dark navy sapphire with electric cyan accents',
    primaryBg: 'bg-slate-900',
    accent: '#38bdf8',
    badge: 'bg-sky-500/20 text-sky-400 border-sky-500/30'
  },
  {
    id: 'ruby-wholesale',
    name: 'Ruby Onion Red',
    desc: 'Signature agricultural onion magenta-red and gold',
    primaryBg: 'bg-rose-950',
    accent: '#f59e0b',
    badge: 'bg-rose-500/20 text-rose-400 border-rose-500/30'
  },
  {
    id: 'golden-harvest',
    name: 'Golden Harvest',
    desc: 'Rich bronze and warm sunlight gold highlights',
    primaryBg: 'bg-amber-950',
    accent: '#fbbf24',
    badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30'
  }
];

export const SettingsPage: React.FC<SettingsPageProps> = ({ settings, onSettingsSaved }) => {
  const [form, setForm] = useState<ShopSettings>(
    settings || {
      shopName: 'SRI MANJUNATHA ONION TRADERS',
      proprietorName: 'M. Ramesh & Sons',
      phone: '+91 98450 12345',
      phoneContactName: '',
      whatsapp: '+91 98450 12345',
      whatsappContactName: '',
      apmcAddress: 'Shop No. 42, APMC Yard, Yeshwanthpur, Bengaluru - 560022',
      licenseNo: 'APMC/BLR/2018/8492',
      footerTagline: 'Commission Agents & Wholesale Onion Merchants • Daily Fresh Supply',
      themeId: 'emerald-classic'
    }
  );

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      const updated = await api.updateSettings(form);
      onSettingsSaved(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-28 md:pb-12 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
            <Store className="w-3.5 h-3.5" />
            <span>Shop Profile &amp; Poster Branding</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white">Shop Settings</h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5">
            Configure your shop name, contact information, and poster visual theme.
          </p>
        </div>

        {savedSuccess && (
          <div className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Settings saved!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Live Poster Header Preview */}
        <div className="glass-card rounded-3xl p-6 border-emerald-500/30 space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Live Poster Banner Preview
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-700">
              1080×1920 Header Preview
            </span>
          </div>

          <div className="rounded-2xl p-6 text-center bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 space-y-2">
            <div className="inline-block px-3 py-0.5 rounded-full text-[10px] font-black tracking-widest bg-amber-400 text-slate-950 uppercase mb-1">
              DAILY APMC MANDI REPORT
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-wide uppercase">
              {form.shopName || 'SHOP NAME HERE'}
            </h2>
            <p className="text-xs font-semibold text-emerald-400">
              {form.proprietorName || 'Proprietor Name'} • Lic: {form.licenseNo || 'APMC/0000'}
            </p>
            <div className="pt-2 text-[11px] text-slate-400 flex flex-wrap items-center justify-center gap-4">
              <span>📞 {form.phone}</span>
              <span>💬 {form.whatsapp}</span>
              <span>📍 {form.apmcAddress}</span>
            </div>
          </div>
        </div>

        {/* Business Details Card */}
        <div className="glass-card rounded-3xl p-5 md:p-6 space-y-4 border-slate-800">
          <h2 className="text-sm md:text-base font-bold text-white flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <Award className="w-4 h-4 text-emerald-400" />
            Shop Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-300 block mb-1">Shop / Business Name</label>
              <input
                type="text"
                required
                value={form.shopName}
                onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                placeholder="SRI MANJUNATHA ONION TRADERS"
                className="w-full bg-slate-900/90 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white border border-slate-700 focus:outline-none focus:border-emerald-500 uppercase"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Proprietor / Partners</label>
              <input
                type="text"
                value={form.proprietorName}
                onChange={(e) => setForm({ ...form, proprietorName: e.target.value })}
                placeholder="M. Ramesh & Sons"
                className="w-full bg-slate-900/90 rounded-xl px-3.5 py-2.5 text-sm text-white border border-slate-700 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">APMC License / GST No.</label>
              <input
                type="text"
                value={form.licenseNo}
                onChange={(e) => setForm({ ...form, licenseNo: e.target.value })}
                placeholder="APMC/BLR/2018/8492"
                className="w-full bg-slate-900/90 rounded-xl px-3.5 py-2.5 text-sm text-white border border-slate-700 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Contact & Location Card */}
        <div className="glass-card rounded-3xl p-5 md:p-6 space-y-4 border-slate-800">
          <h2 className="text-sm md:text-base font-bold text-white flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <Phone className="w-4 h-4 text-emerald-400" />
            Contact &amp; Yard Location
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                Phone Number (Calls)
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 98450 12345"
                className="w-full bg-slate-900/90 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white border border-slate-700 focus:outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                value={form.phoneContactName || ''}
                onChange={(e) => setForm({ ...form, phoneContactName: e.target.value })}
                placeholder="Contact person name shown above this number (optional)"
                className="w-full mt-2 bg-slate-900/90 rounded-xl px-3.5 py-2 text-xs text-white border border-slate-700 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                WhatsApp Number
              </label>
              <input
                type="text"
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                placeholder="+91 98450 12345"
                className="w-full bg-slate-900/90 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white border border-slate-700 focus:outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                value={form.whatsappContactName || ''}
                onChange={(e) => setForm({ ...form, whatsappContactName: e.target.value })}
                placeholder="Contact person name shown above this number (optional)"
                className="w-full mt-2 bg-slate-900/90 rounded-xl px-3.5 py-2 text-xs text-white border border-slate-700 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-300 block mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                APMC Shop / Yard Address
              </label>
              <input
                type="text"
                value={form.apmcAddress}
                onChange={(e) => setForm({ ...form, apmcAddress: e.target.value })}
                placeholder="Shop No. 42, APMC Yard, Yeshwanthpur, Bengaluru - 560022"
                className="w-full bg-slate-900/90 rounded-xl px-3.5 py-2.5 text-sm text-white border border-slate-700 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-300 block mb-1">Footer Tagline / Guarantee</label>
              <input
                type="text"
                value={form.footerTagline}
                onChange={(e) => setForm({ ...form, footerTagline: e.target.value })}
                placeholder="Commission Agents & Wholesale Onion Merchants • Daily Fresh Supply"
                className="w-full bg-slate-900/90 rounded-xl px-3.5 py-2.5 text-sm text-white border border-slate-700 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Visual Poster Themes */}
        <div className="glass-card rounded-3xl p-5 md:p-6 space-y-4 border-slate-800">
          <h2 className="text-sm md:text-base font-bold text-white flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <Palette className="w-4 h-4 text-emerald-400" />
            Poster Color Theme
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {THEME_OPTIONS.map(theme => {
              const isSelected = form.themeId === theme.id;
              return (
                <div
                  key={theme.id}
                  onClick={() => setForm({ ...form, themeId: theme.id })}
                  className={`p-4 rounded-2xl cursor-pointer border transition-all flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'bg-slate-900/90 border-emerald-500 shadow-lg shadow-emerald-500/15 ring-1 ring-emerald-500'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-white">{theme.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{theme.desc}</p>
                  </div>

                  <div className="w-5 h-5 rounded-full border border-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Save CTA */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl font-black text-sm md:text-base bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-xl shadow-emerald-500/25 active:scale-95 transition-all flex items-center justify-center gap-2.5"
          >
            <Save className="w-4 h-4 text-slate-950" />
            <span>{saving ? 'Saving Settings...' : 'Save Shop Branding'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
