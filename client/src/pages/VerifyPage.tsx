import React, { useState } from 'react';
import {
  Sparkles,
  ArrowLeft,
  Image,
  AlertTriangle,
  Plus,
  X,
  Package,
  Calendar,
  Trash2,
  Tag
} from 'lucide-react';
import type { MarketReportNormalized, PriceRange } from '@shared/types';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { api } from '../services/api';

interface VerifyPageProps {
  rawMessage: string;
  initialData: MarketReportNormalized;
  onBack: () => void;
  onPosterGenerated: (result: {
    reportId: string;
    imageUrl: string;
    imagePath: string;
    reportDate: string;
    createdAt: string;
  }) => void;
}

export const VerifyPage: React.FC<VerifyPageProps> = ({
  rawMessage,
  initialData,
  onBack,
  onPosterGenerated
}) => {
  const [data, setData] = useState<MarketReportNormalized>({ ...initialData });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [showRawReference, setShowRawReference] = useState(true);

  // Helper to update price range
  const handlePriceChange = (
    section: 'maharashtra' | 'vijayapura' | 'newOnions',
    key: string,
    displayVal: string
  ) => {
    setData(prev => {
      const updated = { ...prev };
      let newRange: PriceRange | null = null;
      const clean = displayVal.trim();
      if (clean) {
        // Parse numbers if range
        const m = clean.match(/(\d+)\s*[-/to\s]+\s*(\d+)/i);
        if (m) {
          newRange = { min: parseInt(m[1], 10), max: parseInt(m[2], 10), display: clean };
        } else {
          const single = parseInt(clean.replace(/[^\d]/g, ''), 10);
          newRange = { min: isNaN(single) ? 0 : single, max: isNaN(single) ? 0 : single, display: clean };
        }
      }

      if (section === 'maharashtra') {
        (updated.maharashtra as any)[key] = newRange;
      } else if (section === 'vijayapura') {
        (updated.vijayapura as any)[key] = newRange;
      } else if (section === 'newOnions') {
        (updated.newOnions as any)[key] = newRange;
      }

      return updated;
    });
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    setData(prev => ({
      ...prev,
      additionalInformation: [...prev.additionalInformation, newNote.trim()]
    }));
    setNewNote('');
  };

  const handleRemoveNote = (index: number) => {
    setData(prev => ({
      ...prev,
      additionalInformation: prev.additionalInformation.filter((_, i) => i !== index)
    }));
  };

  const handleCommodityChange = (
    index: number,
    field: 'name' | 'variety' | 'unit' | 'rateDisplay',
    value: string
  ) => {
    setData(prev => {
      const updatedList = [...(prev.commodities || [])];
      if (!updatedList[index]) return prev;

      if (field === 'name') {
        updatedList[index] = { ...updatedList[index], name: value.toUpperCase() };
      } else if (field === 'variety') {
        updatedList[index] = { ...updatedList[index], variety: value || null };
      } else if (field === 'unit') {
        updatedList[index] = { ...updatedList[index], unit: value || null };
      } else if (field === 'rateDisplay') {
        const clean = value.trim();
        let newRange: PriceRange | null = null;
        if (clean) {
          const m = clean.match(/(\d+)\s*[-/to\s]+\s*(\d+)/i);
          if (m) {
            newRange = { min: parseInt(m[1], 10), max: parseInt(m[2], 10), display: clean };
          } else {
            const single = parseInt(clean.replace(/[^\d]/g, ''), 10);
            newRange = { min: isNaN(single) ? 0 : single, max: isNaN(single) ? 0 : single, display: clean };
          }
        }
        updatedList[index] = { ...updatedList[index], rate: newRange };
      }

      return { ...prev, commodities: updatedList };
    });
  };

  const handleAddCommodity = (presetName: string = 'NEW VEGETABLE', defaultUnit: string = 'Per 100 kg') => {
    setData(prev => ({
      ...prev,
      commodities: [
        ...(prev.commodities || []),
        {
          name: presetName.toUpperCase(),
          variety: null,
          rate: { min: 2000, max: 2500, display: '2000-2500' },
          unit: defaultUnit,
          isHighlight: true
        }
      ]
    }));
  };

  const handleRemoveCommodity = (index: number) => {
    setData(prev => ({
      ...prev,
      commodities: (prev.commodities || []).filter((_, i) => i !== index)
    }));
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.generatePoster({
        rawMessage,
        extractedData: initialData,
        data
      });
      onPosterGenerated(res);
    } catch (err: any) {
      setError(err.message || 'Poster generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-32 md:pb-16 animate-fadeIn">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Step 2 of 3: Verify &amp; Edit Market Data</span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white">Check Today's Market Report</h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5">
            Review the extracted values. Tap any box to edit before generating the final 1080×1920 poster.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRawReference(!showRawReference)}
            className="hidden lg:flex px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 transition-colors items-center gap-1.5"
          >
            <span>{showRawReference ? 'Hide Original Text' : 'Show Original Text'}</span>
          </button>

          <button
            onClick={onBack}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Raw Text
          </button>
        </div>
      </div>

      {/* Warnings & Missing Fields Banner */}
      {data.warnings.length > 0 && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs md:text-sm space-y-1">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Extraction Notice</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-xs text-amber-200/90 pl-1">
            {data.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs md:text-sm">
          <span className="font-bold">Error:</span> {error}
        </div>
      )}

      {/* Main Grid: Form on Left/Center, Sticky Raw Reference on PC Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className={`space-y-5 ${showRawReference && rawMessage ? 'lg:col-span-8' : 'lg:col-span-12'}`}>
          {/* SECTION 1: GENERAL INFO (Date, Market, Rate Unit) */}
          <div className="glass-card rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 space-y-4 border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h2 className="text-xs sm:text-sm md:text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                General Report Information
              </h2>
              <ConfidenceBadge level={data.confidence.date} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block mb-1">Report Date</label>
                <input
                  type="text"
                  value={data.reportDateDisplay || data.reportDate || ''}
                  onChange={(e) => setData({ ...data, reportDateDisplay: e.target.value, reportDate: e.target.value })}
                  placeholder="22.08.2026"
                  className="w-full bg-slate-900/90 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm font-semibold text-white border border-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block mb-1">APMC Market Name</label>
                <input
                  type="text"
                  value={data.market || ''}
                  onChange={(e) => setData({ ...data, market: e.target.value })}
                  placeholder="APMC BENGALURU"
                  className="w-full bg-slate-900/90 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm font-semibold text-white border border-slate-700 focus:outline-none focus:border-emerald-500 uppercase"
                />
              </div>

              <div>
                <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block mb-1">Rate Basis Unit</label>
                <input
                  type="text"
                  value={data.rateUnit || 'Per 100 kg'}
                  onChange={(e) => setData({ ...data, rateUnit: e.target.value })}
                  placeholder="Per 100 kg"
                  className="w-full bg-slate-900/90 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm font-semibold text-white border border-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: ARRIVALS & MARKET CONDITIONS */}
          <div className="glass-card rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 space-y-4 border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h2 className="text-xs sm:text-sm md:text-base font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-400" />
                Arrival Inflow &amp; Market Conditions
              </h2>
              <ConfidenceBadge level={data.confidence.arrivals} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <div>
                <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block mb-1">Arrivals (Bags)</label>
                <input
                  type="text"
                  value={data.totalArrivals?.display || ''}
                  onChange={(e) => setData({
                    ...data,
                    totalArrivals: {
                      value: parseInt(e.target.value.replace(/[^\d]/g, ''), 10) || 0,
                      display: e.target.value
                    }
                  })}
                  placeholder="65,326 bags"
                  className="w-full bg-slate-900/90 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm font-semibold text-white border border-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block mb-1">Truck Count</label>
                <input
                  type="text"
                  value={data.truckCount || ''}
                  onChange={(e) => setData({ ...data, truckCount: e.target.value })}
                  placeholder="325+ Trucks"
                  className="w-full bg-slate-900/90 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm font-semibold text-white border border-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block mb-1">Weather</label>
                <input
                  type="text"
                  value={data.weather || ''}
                  onChange={(e) => setData({ ...data, weather: e.target.value })}
                  placeholder="Cloudy / Sunny"
                  className="w-full bg-slate-900/90 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm font-semibold text-white border border-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block mb-1">Sales Sentiment</label>
                <input
                  type="text"
                  value={data.salesStatus || ''}
                  onChange={(e) => setData({ ...data, salesStatus: e.target.value })}
                  placeholder="Slow / Normal / Fast"
                  className="w-full bg-slate-900/90 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm font-semibold text-white border border-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: MAHARASHTRA ONION RATES */}
          <div className="glass-card rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 space-y-4 border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h2 className="text-xs sm:text-sm md:text-base font-bold text-white flex items-center gap-2">
                  <span className="text-base">🧅</span>
                  Maharashtra Onion Rates (₹ / 100 kg)
                </h2>
                <span className="text-[11px] text-slate-400">All grades extracted from report</span>
              </div>
              <ConfidenceBadge level={data.confidence.maharashtra} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <div>
                <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block mb-1">Extra Big (EB)</label>
                <input
                  type="text"
                  inputMode="text"
                  value={data.maharashtra.extraBig?.display || ''}
                  onChange={(e) => handlePriceChange('maharashtra', 'extraBig', e.target.value)}
                  placeholder="4300-4500"
                  className="w-full bg-slate-900/90 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm font-mono font-bold text-amber-400 border border-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block mb-1">Big Quality</label>
                <input
                  type="text"
                  inputMode="text"
                  value={data.maharashtra.big?.display || ''}
                  onChange={(e) => handlePriceChange('maharashtra', 'big', e.target.value)}
                  placeholder="4000-4200"
                  className="w-full bg-slate-900/90 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm font-mono font-bold text-amber-400 border border-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block mb-1">Mukkal (3/4)</label>
                <input
                  type="text"
                  inputMode="text"
                  value={data.maharashtra.mukkal?.display || ''}
                  onChange={(e) => handlePriceChange('maharashtra', 'mukkal', e.target.value)}
                  placeholder="3500-3800"
                  className="w-full bg-slate-900/90 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm font-mono font-bold text-white border border-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block mb-1">Medium (MED)</label>
                <input
                  type="text"
                  inputMode="text"
                  value={data.maharashtra.medium?.display || ''}
                  onChange={(e) => handlePriceChange('maharashtra', 'medium', e.target.value)}
                  placeholder="3000-3500"
                  className="w-full bg-slate-900/90 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm font-mono font-bold text-white border border-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block mb-1">Golta</label>
                <input
                  type="text"
                  inputMode="text"
                  value={data.maharashtra.golta?.display || ''}
                  onChange={(e) => handlePriceChange('maharashtra', 'golta', e.target.value)}
                  placeholder="2500-3000"
                  className="w-full bg-slate-900/90 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm font-mono font-bold text-white border border-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block mb-1">Golty / Choti</label>
                <input
                  type="text"
                  inputMode="text"
                  value={data.maharashtra.golty?.display || ''}
                  onChange={(e) => handlePriceChange('maharashtra', 'golty', e.target.value)}
                  placeholder="2000-2400"
                  className="w-full bg-slate-900/90 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm font-mono font-bold text-white border border-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block mb-1">Chopda</label>
                <input
                  type="text"
                  inputMode="text"
                  value={data.maharashtra.chopda?.display || ''}
                  onChange={(e) => handlePriceChange('maharashtra', 'chopda', e.target.value)}
                  placeholder="2000-3000"
                  className="w-full bg-slate-900/90 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm font-mono font-bold text-white border border-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block mb-1">Average Quality</label>
                <input
                  type="text"
                  inputMode="text"
                  value={data.maharashtra.averageQuality?.display || ''}
                  onChange={(e) => handlePriceChange('maharashtra', 'averageQuality', e.target.value)}
                  placeholder="3000-3500"
                  className="w-full bg-slate-900/90 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm font-mono font-bold text-white border border-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: KARNATAKA & NEW ONIONS */}
          <div className="glass-card rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 space-y-4 border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h2 className="text-xs sm:text-sm md:text-base font-bold text-white flex items-center gap-2">
                <span className="text-base">🌾</span>
                Karnataka &amp; New Onions
              </h2>
              <ConfidenceBadge level={data.confidence.newOnions} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <div>
                <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block mb-1">Vijayapura Rate</label>
                <input
                  type="text"
                  inputMode="text"
                  value={data.vijayapura.rate?.display || ''}
                  onChange={(e) => handlePriceChange('vijayapura', 'rate', e.target.value)}
                  placeholder="3000-3700"
                  className="w-full bg-slate-900/90 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm font-mono font-bold text-emerald-400 border border-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block mb-1">New Onion Bags</label>
                <input
                  type="text"
                  value={data.newOnions.bagCount || ''}
                  onChange={(e) => setData({
                    ...data,
                    newOnions: { ...data.newOnions, bagCount: e.target.value }
                  })}
                  placeholder="7000+ bags"
                  className="w-full bg-slate-900/90 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm font-semibold text-white border border-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block mb-1">New Onion Rate</label>
                <input
                  type="text"
                  inputMode="text"
                  value={data.newOnions.rate?.display || ''}
                  onChange={(e) => handlePriceChange('newOnions', 'rate', e.target.value)}
                  placeholder="1600-3400"
                  className="w-full bg-slate-900/90 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm font-mono font-bold text-amber-400 border border-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block mb-1">1-2 Lot Rate</label>
                <input
                  type="text"
                  inputMode="text"
                  value={data.newOnions.lotRate?.display || ''}
                  onChange={(e) => handlePriceChange('newOnions', 'lotRate', e.target.value)}
                  placeholder="3500-3800"
                  className="w-full bg-slate-900/90 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm font-mono font-bold text-white border border-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* SECTION 5: VEGETABLES & OTHER COMMODITIES */}
          <div className="glass-card rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 space-y-4 border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div>
                <h2 className="text-xs sm:text-sm md:text-base font-bold text-white flex items-center gap-2">
                  <span className="text-base">🥬</span>
                  Vegetables &amp; Other Commodities
                </h2>
                <span className="text-[11px] text-slate-400">Add or edit Potato, Tomato, Garlic, Ginger, Chilli, or any mandi commodity</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAddCommodity('NEW VEGETABLE', 'Per 100 kg')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Item</span>
                </button>
              </div>
            </div>

            {/* Quick-add vegetable preset chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
                <Tag className="w-3 h-3 text-amber-400" />
                Quick Add:
              </span>
              {[
                { name: 'POTATO', unit: 'Per 100 kg', emoji: '🥔' },
                { name: 'TOMATO', unit: 'Per 25 kg box', emoji: '🍅' },
                { name: 'GARLIC', unit: 'Per 100 kg', emoji: '🧄' },
                { name: 'GINGER', unit: 'Per 100 kg', emoji: '🫚' },
                { name: 'GREEN CHILLI', unit: 'Per 50 kg', emoji: '🌶️' },
                { name: 'CARROT', unit: 'Per 100 kg', emoji: '🥕' },
                { name: 'CABBAGE', unit: 'Per 100 kg', emoji: '🥬' },
                { name: 'LEMON', unit: 'Per 100 kg', emoji: '🍋' }
              ].map(preset => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleAddCommodity(preset.name, preset.unit)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1"
                >
                  <span>{preset.emoji}</span>
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>

            {/* Commodities List */}
            {(!data.commodities || data.commodities.length === 0) ? (
              <div className="p-4 rounded-xl bg-slate-900/50 border border-dashed border-slate-800 text-center text-xs text-slate-400">
                No extra vegetables added yet. Click any quick-add chip above or "Add Item" to add new vegetables/commodities to today's poster.
              </div>
            ) : (
              <div className="space-y-2.5">
                {data.commodities.map((item, index) => (
                  <div
                    key={index}
                    className="p-3 sm:p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/80 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 items-center"
                  >
                    <div className="sm:col-span-4">
                      <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">Vegetable / Item Name</label>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleCommodityChange(index, 'name', e.target.value)}
                        placeholder="e.g. POTATO, TOMATO"
                        className="w-full bg-slate-950 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white border border-slate-700 focus:outline-none focus:border-emerald-500 uppercase"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">Variety / Grade</label>
                      <input
                        type="text"
                        value={item.variety || ''}
                        onChange={(e) => handleCommodityChange(index, 'variety', e.target.value)}
                        placeholder="e.g. Agra / Hybrid / Desi"
                        className="w-full bg-slate-950 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 border border-slate-700 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">Rate Unit</label>
                      <input
                        type="text"
                        value={item.unit || ''}
                        onChange={(e) => handleCommodityChange(index, 'unit', e.target.value)}
                        placeholder="Per 100 kg"
                        className="w-full bg-slate-950 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 border border-slate-700 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">Price Range (₹)</label>
                      <input
                        type="text"
                        value={item.rate?.display || ''}
                        onChange={(e) => handleCommodityChange(index, 'rateDisplay', e.target.value)}
                        placeholder="1800-2200"
                        className="w-full bg-slate-950 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-amber-400 border border-slate-700 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveCommodity(index)}
                        className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                        title="Remove Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 6: ADDITIONAL INFORMATION / MARKET NOTES */}
          <div className="glass-card rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 space-y-4 border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h2 className="text-xs sm:text-sm md:text-base font-bold text-white flex items-center gap-2">
                  <span className="text-base">📌</span>
                  Additional Market Notes
                </h2>
                <span className="text-[11px] text-slate-400">Extra varieties or notes included in WhatsApp message</span>
              </div>
            </div>

            <div className="space-y-3">
              {data.additionalInformation.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {data.additionalInformation.map((note, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 text-slate-200 text-xs border border-slate-700"
                    >
                      <span>{note}</span>
                      <button
                        onClick={() => handleRemoveNote(index)}
                        className="text-slate-400 hover:text-red-400 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote(); }}
                  placeholder="Add custom note (e.g. White Onion: 3200-3600 or Heavy Demand)"
                  className="flex-1 bg-slate-900/90 rounded-xl px-3.5 py-2 text-xs md:text-sm text-white border border-slate-700 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleAddNote}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Raw WhatsApp Reference Panel (Desktop/PC View) */}
        {showRawReference && rawMessage && (
          <div className="hidden lg:block lg:col-span-4 sticky top-20">
            <div className="glass-card rounded-3xl p-5 border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📱 Original WhatsApp Text</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Reference
                </span>
              </div>
              <div className="bg-slate-950/90 rounded-2xl p-4 border border-slate-800 max-h-[calc(100vh-220px)] overflow-y-auto font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed select-text">
                {rawMessage}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Bottom Action Bar */}
      <div className="sticky bottom-16 md:bottom-6 z-30 glass-card rounded-2xl p-3 sm:p-4 border-emerald-500/30 flex items-center justify-between gap-3 sm:gap-4 shadow-2xl bg-slate-950/90 backdrop-blur-md">
        <button
          onClick={onBack}
          className="px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm text-slate-300 hover:text-white bg-slate-900 border border-slate-700 transition-colors flex items-center gap-1.5 sm:gap-2 shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Edit Message</span>
          <span className="sm:hidden">Back</span>
        </button>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex-1 max-w-sm px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl font-black text-xs sm:text-sm md:text-base bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-xl shadow-emerald-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 glow-emerald"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              <span className="truncate">Generating Poster...</span>
            </>
          ) : (
            <>
              <Image className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950 shrink-0" />
              <span>Generate Branded Poster</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

