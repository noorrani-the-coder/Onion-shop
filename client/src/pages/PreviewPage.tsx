import React, { useState } from 'react';
import {
  Download,
  Share2,
  Edit3,
  RefreshCw,
  Check,
  Maximize2,
  CheckCircle2,
  Store
} from 'lucide-react';
import { ReportRecord, ShopSettings } from '@shared/types';
import { sharePosterImage, posterCaption } from '../services/share';

interface PreviewPageProps {
  report: ReportRecord;
  settings: ShopSettings | null;
  onEditData: () => void;
  onNewReport: () => void;
}

export const PreviewPage: React.FC<PreviewPageProps> = ({
  report,
  settings,
  onEditData,
  onNewReport
}) => {
  const [copied, setCopied] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);

  const imageUrl = report.imagePath || '';
  const dateDisplay = report.editedData.reportDateDisplay || report.reportDate;
  const bigRate = report.editedData.maharashtra.big?.display || '4000-4200';

  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    if (!imageUrl) return;
    const captionText = posterCaption({
      shopName: settings?.shopName,
      dateDisplay,
      market: report.editedData.market,
      bigRate,
      arrivals: report.editedData.totalArrivals?.display || '65,000 bags'
    });

    setSharing(true);
    try {
      const outcome = await sharePosterImage({
        imageUrl,
        fileName: `onion-market-report-${dateDisplay.replace(/\./g, '-')}.png`,
        title: `${settings?.shopName || 'APMC Onion'} Daily Market Report - ${dateDisplay}`,
        text: captionText
      });
      // Only the download fallback needs the "caption copied" hint.
      if (outcome === 'downloaded') {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    } catch (err) {
      console.error('Share failed', err);
      alert('Could not share the poster. Please check your connection and try again.');
    } finally {
      setSharing(false);
    }
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `onion-market-report-${dateDisplay.replace(/\./g, '-')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-28 md:pb-12 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Poster Generated Successfully</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white">Market Poster Ready</h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5">
            Optimized at 1080 × 1920 (9:16) for WhatsApp Status, Stories, and Customer Broadcasts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onEditData}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5 text-amber-400" />
            Edit Numbers
          </button>

          <button
            onClick={onNewReport}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            New Report
          </button>
        </div>
      </div>

      {/* Main Preview & Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Center: High-Resolution Poster Card */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="glass-card rounded-3xl p-3 md:p-4 border-slate-800 relative group w-full max-w-sm sm:max-w-md shadow-2xl shadow-emerald-950/40">
            <div className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-slate-950 border border-slate-700/80">
              <img
                src={imageUrl}
                alt="Generated Onion Market Poster"
                className="w-full h-full object-contain cursor-pointer"
                onClick={() => setZoomOpen(true)}
              />

              <button
                onClick={() => setZoomOpen(true)}
                className="absolute top-3 right-3 p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 text-white backdrop-blur-md border border-white/20 shadow-lg transition-transform hover:scale-105"
                title="Enlarge Poster"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 text-center">
              <span className="text-[11px] text-slate-400">Tap poster to inspect full resolution</span>
            </div>
          </div>
        </div>

        {/* Right: Actions & Market Summary */}
        <div className="lg:col-span-5 space-y-4">
          {/* Primary Action Buttons */}
          <div className="glass-card rounded-3xl p-5 md:p-6 space-y-3 border-emerald-500/30">
            <h2 className="text-base font-bold text-white mb-2">Share or Download</h2>

            <button
              onClick={handleDownload}
              className="w-full py-4 px-6 rounded-2xl font-black text-base bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-xl shadow-emerald-500/25 active:scale-95 transition-all flex items-center justify-center gap-2.5"
            >
              <Download className="w-5 h-5 text-slate-950" />
              <span>Download High-Res PNG</span>
            </button>

            <button
              onClick={handleShare}
              disabled={sharing}
              className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait"
            >
              {sharing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Preparing Image…</span>
                </>
              ) : copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Image Downloaded — Attach in WhatsApp!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span>Share via WhatsApp / Mobile</span>
                </>
              )}
            </button>
          </div>

          {/* Report Summary Card */}
          <div className="glass-card rounded-3xl p-5 space-y-3 border-slate-800">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Report Details</h3>

            <div className="space-y-2 text-xs divide-y divide-slate-800/80">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-400">Date:</span>
                <span className="font-bold text-white font-mono">{dateDisplay}</span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-400">Market:</span>
                <span className="font-bold text-white">{report.editedData.market || 'APMC BENGALURU'}</span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-400">Arrivals &amp; Trucks:</span>
                <span className="font-bold text-white">
                  {report.editedData.totalArrivals?.display || '65,000 bags'} ({report.editedData.truckCount || '325+ Trucks'})
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-400">Big Onion Rate:</span>
                <span className="font-bold text-emerald-400 font-mono text-sm">₹ {bigRate}</span>
              </div>

              {report.editedData.vijayapura.rate?.display && (
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-400">Vijayapura Rate:</span>
                  <span className="font-bold text-white font-mono">₹ {report.editedData.vijayapura.rate.display}</span>
                </div>
              )}

              {report.editedData.newOnions.rate?.display && (
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-400">New Onions Rate:</span>
                  <span className="font-bold text-amber-400 font-mono">₹ {report.editedData.newOnions.rate.display}</span>
                </div>
              )}
            </div>
          </div>

          {/* Shop Branding Applied */}
          <div className="glass-card rounded-3xl p-4 border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-emerald-400 shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Branded For</span>
              <h4 className="text-xs font-bold text-white truncate">{settings?.shopName || 'Sri Manjunatha Onion Traders'}</h4>
              <p className="text-[11px] text-slate-400 truncate">{settings?.phone}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Full-Screen Zoom Modal */}
      {zoomOpen && (
        <div
          onClick={() => setZoomOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-fadeIn"
        >
          <div className="relative max-h-[95vh] max-w-2xl">
            <img
              src={imageUrl}
              alt="Full Resolution Poster"
              className="max-h-[92vh] w-auto rounded-2xl shadow-2xl border border-slate-700"
            />
            <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-slate-950/80 text-xs font-bold text-white border border-white/20">
              Tap anywhere to close
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
