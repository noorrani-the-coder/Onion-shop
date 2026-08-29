import React from 'react';
import { PlusCircle, LayoutDashboard, History, Settings, ImagePlus } from 'lucide-react';

interface NavbarProps {
  currentTab: 'dashboard' | 'paste' | 'verify' | 'preview' | 'history' | 'settings' | 'brand';
  setCurrentTab: (tab: 'dashboard' | 'paste' | 'verify' | 'preview' | 'history' | 'settings' | 'brand') => void;
  hasActiveReport: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab }) => {
  return (
    <>
      {/* Top Desktop & Mobile Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            onClick={() => setCurrentTab('dashboard')} 
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center overflow-hidden shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-500/30 group-hover:scale-105 transition-transform">
              {/* Monogram crop of the shop crest — the full logo is illegible at 40px */}
              <img
                src="/logo-mark.png"
                alt="B. Ramalingappa & Son's"
                className="w-full h-full object-contain"
                width={40}
                height={40}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  MANDI POSTER
                </span>
                <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                  APMC V1
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">WhatsApp Report → 1080×1920 Branded Poster</p>
            </div>
          </div>

          {/* Desktop Nav Actions */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                currentTab === 'dashboard'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>

            <button
              onClick={() => setCurrentTab('paste')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                currentTab === 'paste' || currentTab === 'verify' || currentTab === 'preview'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              New Report
            </button>

            <button
              onClick={() => setCurrentTab('brand')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                currentTab === 'brand'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <ImagePlus className="w-4 h-4" />
              Brand Image
            </button>

            <button
              onClick={() => setCurrentTab('history')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                currentTab === 'history'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <History className="w-4 h-4" />
              History
            </button>

            <button
              onClick={() => setCurrentTab('settings')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                currentTab === 'settings'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Settings className="w-4 h-4" />
              Shop Settings
            </button>
          </nav>

          {/* Quick CTA on Desktop */}
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => setCurrentTab('paste')}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4 text-slate-950" />
              Paste Report
            </button>
          </div>
        </div>
      </header>

      {/* Bottom Navigation Bar for Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-slate-800/80 backdrop-blur-md px-2 py-2">
        <div className="flex items-center justify-around">
          <button
            onClick={() => setCurrentTab('dashboard')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
              currentTab === 'dashboard'
                ? 'text-emerald-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[11px]">Home</span>
          </button>

          <button
            onClick={() => setCurrentTab('paste')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
              currentTab === 'paste' || currentTab === 'verify' || currentTab === 'preview'
                ? 'text-emerald-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center -mt-2 shadow-md">
              <PlusCircle className="w-5 h-5" />
            </div>
            <span className="text-[11px]">New Report</span>
          </button>

          <button
            onClick={() => setCurrentTab('brand')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
              currentTab === 'brand'
                ? 'text-emerald-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImagePlus className="w-5 h-5" />
            <span className="text-[11px]">Brand</span>
          </button>

          <button
            onClick={() => setCurrentTab('history')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
              currentTab === 'history'
                ? 'text-emerald-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-5 h-5" />
            <span className="text-[11px]">History</span>
          </button>

          <button
            onClick={() => setCurrentTab('settings')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
              currentTab === 'settings'
                ? 'text-emerald-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[11px]">Settings</span>
          </button>
        </div>
      </div>
    </>
  );
};
