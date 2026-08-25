import React from 'react';
import { PlusCircle, FileText, Download, Share2, Eye, Calendar, Sparkles, ArrowRight, Store } from 'lucide-react';
import { ReportRecord, ShopSettings } from '@shared/types';
import { sharePosterImage, posterCaption } from '../services/share';

interface DashboardPageProps {
  reports: ReportRecord[];
  settings: ShopSettings | null;
  onNavigate: (tab: 'paste' | 'history' | 'settings' | 'preview') => void;
  onSelectReportForPreview: (report: ReportRecord) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  reports,
  settings,
  onNavigate,
  onSelectReportForPreview
}) => {
  const recentReports = reports.slice(0, 4);
  const todayStr = new Date().toISOString().split('T')[0];
  const todayReport = reports.find(r => r.reportDate === todayStr || r.createdAt.startsWith(todayStr));

  const handleShare = async (report: ReportRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!report.imagePath) return;

    const dateDisplay = report.editedData?.reportDateDisplay || report.reportDate;
    try {
      await sharePosterImage({
        imageUrl: report.imagePath,
        fileName: `onion-market-report-${dateDisplay.replace(/\./g, '-')}.png`,
        title: `${settings?.shopName || 'APMC Onion'} Market Report`,
        text: posterCaption({
          shopName: settings?.shopName,
          dateDisplay,
          market: report.editedData?.market,
          bigRate: report.editedData?.maharashtra?.big?.display,
          arrivals: report.editedData?.totalArrivals?.display
        })
      });
    } catch (err) {
      console.error('Share failed', err);
      alert('Could not share the poster. Please check your connection and try again.');
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-12 animate-fadeIn">
      {/* Shop Identity Header */}
      <div className="glass-card rounded-2xl p-5 md:p-6 relative overflow-hidden border border-emerald-500/20">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
              <Store className="w-3.5 h-3.5" />
              <span>{settings?.apmcAddress || 'APMC Bengaluru Mandi'}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              {settings?.shopName || 'SRI MANJUNATHA ONION TRADERS'}
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              {settings?.proprietorName || 'Commission Agents & Wholesale Merchants'} • Lic: {settings?.licenseNo || 'APMC/2026'}
            </p>
          </div>

          <button
            onClick={() => onNavigate('settings')}
            className="self-start sm:self-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-slate-300 hover:text-white border border-slate-700/80 transition-colors"
          >
            Edit Shop Info
          </button>
        </div>
      </div>

      {/* Primary Workflow Card */}
      <div className="relative rounded-3xl p-6 md:p-8 bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 border border-emerald-500/30 shadow-2xl shadow-emerald-950/50">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Fast 30-Second Poster Workflow</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white leading-tight">
            Received today's Onion Market report on WhatsApp?
          </h2>
          <p className="text-sm md:text-base text-slate-300 mt-2">
            Simply copy and paste the message. The system automatically understands all formats, formats rates, and creates your branded 1080×1920 poster ready for WhatsApp Status.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => onNavigate('paste')}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-base shadow-xl shadow-emerald-500/25 active:scale-95 transition-all flex items-center gap-2.5"
            >
              <PlusCircle className="w-5 h-5 text-slate-950" />
              <span>Paste WhatsApp Report</span>
              <ArrowRight className="w-4 h-4 text-slate-950" />
            </button>

            {todayReport && (
              <button
                onClick={() => onSelectReportForPreview(todayReport)}
                className="px-5 py-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-bold text-sm border border-slate-700 transition-all flex items-center gap-2"
              >
                <Eye className="w-4 h-4 text-emerald-400" />
                <span>View Today's Poster</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="glass-card rounded-2xl p-4 border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Reports</span>
          <p className="text-2xl font-extrabold text-white mt-1">{reports.length}</p>
          <span className="text-[11px] text-emerald-400">Generated &amp; Stored</span>
        </div>

        <div className="glass-card rounded-2xl p-4 border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today's Status</span>
          <p className="text-2xl font-extrabold text-white mt-1">
            {todayReport ? 'Generated ✓' : 'Pending'}
          </p>
          <span className={`text-[11px] ${todayReport ? 'text-emerald-400' : 'text-amber-400'}`}>
            {todayReport ? 'Ready to share' : 'Awaiting daily report'}
          </span>
        </div>

        <div className="glass-card rounded-2xl p-4 border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Poster Format</span>
          <p className="text-2xl font-extrabold text-white mt-1">1080 × 1920</p>
          <span className="text-[11px] text-slate-400">9:16 WhatsApp Status</span>
        </div>

        <div className="glass-card rounded-2xl p-4 border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Theme</span>
          <p className="text-2xl font-extrabold text-emerald-400 mt-1 capitalize">
            {settings?.themeId?.replace('-', ' ') || 'Emerald'}
          </p>
          <span className="text-[11px] text-slate-400">Wholesale Branding</span>
        </div>
      </div>

      {/* Recent Generated Posters */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-400" />
              Recent Market Reports
            </h3>
            <p className="text-xs text-slate-400">Previously generated posters available for instant download &amp; sharing</p>
          </div>
          {reports.length > 0 && (
            <button
              onClick={() => onNavigate('history')}
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              View All ({reports.length})
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {recentReports.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center border-dashed border-slate-800">
            <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center mx-auto text-slate-500 mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-200">No posters generated yet</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              Paste your first WhatsApp market report above to create your shop-branded poster.
            </p>
            <button
              onClick={() => onNavigate('paste')}
              className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold text-xs border border-emerald-500/30 inline-flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              Create First Poster
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentReports.map(report => {
              const dateDisplay = report.editedData.reportDateDisplay || report.reportDate;
              const bigRate = report.editedData.maharashtra.big?.display || '4000-4200';
              const arrivals = report.editedData.totalArrivals?.display || '65,000 bags';

              return (
                <div
                  key={report.id}
                  onClick={() => onSelectReportForPreview(report)}
                  className="glass-card glass-card-hover rounded-2xl p-4 cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    {/* Thumbnail Preview or Poster Placeholder */}
                    <div className="w-full aspect-[9/12] bg-slate-900 rounded-xl overflow-hidden mb-3 relative border border-slate-800 group-hover:border-emerald-500/40 transition-colors">
                      {report.imagePath ? (
                        <img
                          src={report.imagePath}
                          alt={`Poster ${dateDisplay}`}
                          className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-slate-950">
                          <span className="text-2xl mb-1">🧅</span>
                          <span className="text-xs font-bold text-slate-300">{report.editedData.market || 'APMC Report'}</span>
                          <span className="text-[11px] text-emerald-400 font-mono mt-1">₹ {bigRate}</span>
                        </div>
                      )}

                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md text-[10px] font-mono font-bold text-white border border-white/10">
                        {dateDisplay}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white truncate">{report.editedData.market || 'APMC BENGALURU'}</span>
                        <span className="text-emerald-400 font-extrabold font-mono">₹{bigRate}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 flex items-center justify-between">
                        <span>Arrivals: {arrivals}</span>
                        <span>{report.editedData.truckCount || '300+ Trucks'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectReportForPreview(report);
                      }}
                      className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                      title="View Poster"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    <button
                      onClick={(e) => handleShare(report, e)}
                      className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                      title="Share Poster"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>

                    {report.imagePath && (
                      <a
                        href={report.imagePath}
                        download={`onion-poster-${dateDisplay.replace(/\./g, '-')}.png`}
                        onClick={(e) => e.stopPropagation()}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        title="Download PNG"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>PNG</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
