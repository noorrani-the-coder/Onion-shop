import React, { useState } from 'react';
import {
  Search,
  Download,
  Share2,
  Eye,
  Trash2,
  Clock,
  Package,
  Sparkles
} from 'lucide-react';
import { ReportRecord } from '@shared/types';
import { api } from '../services/api';
import { sharePosterImage, posterCaption } from '../services/share';

interface HistoryPageProps {
  reports: ReportRecord[];
  onSelectReport: (report: ReportRecord) => void;
  onRefresh: () => void;
  onNewReport: () => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({
  reports,
  onSelectReport,
  onRefresh,
  onNewReport
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredReports = reports.filter(r => {
    const term = searchTerm.toLowerCase();
    const date = (r.reportDate || '').toLowerCase();
    const market = (r.editedData.market || '').toLowerCase();
    const raw = (r.rawMessage || '').toLowerCase();
    return date.includes(term) || market.includes(term) || raw.includes(term);
  });

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this report from history?')) return;

    setDeletingId(id);
    try {
      await api.deleteReport(id);
      onRefresh();
    } catch (err) {
      alert('Failed to delete report');
    } finally {
      setDeletingId(null);
    }
  };

  const handleShare = async (report: ReportRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!report.imagePath) return;

    const dateDisplay = report.editedData?.reportDateDisplay || report.reportDate;
    try {
      await sharePosterImage({
        imageUrl: report.imagePath,
        fileName: `onion-market-report-${dateDisplay.replace(/\./g, '-')}.png`,
        title: `Onion APMC Report - ${dateDisplay}`,
        text: posterCaption({
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
    <div className="max-w-5xl mx-auto space-y-6 pb-28 md:pb-12 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Audit &amp; Archive</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white">Report History</h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5">
            Access past daily onion reports, raw WhatsApp messages, and generated posters.
          </p>
        </div>

        <button
          onClick={onNewReport}
          className="self-start sm:self-center px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          <span>New Daily Report</span>
        </button>
      </div>

      {/* Search Filter Bar */}
      <div className="glass-card rounded-2xl p-3 md:p-4 border-slate-800 flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by date (22.08.2026), market (Bengaluru), or grade..."
          className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="text-xs font-semibold text-slate-400 hover:text-white px-2"
          >
            Clear
          </button>
        )}
      </div>

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center border-dashed border-slate-800">
          <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center mx-auto text-slate-500 mb-3">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-200">No reports found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            {searchTerm ? 'Try a different search date or keyword.' : 'Generate your first market poster to view history.'}
          </p>
          <button
            onClick={onNewReport}
            className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold text-xs border border-emerald-500/30 inline-flex items-center gap-2"
          >
            Create New Poster
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReports.map(report => {
            const dateDisplay = report.editedData.reportDateDisplay || report.reportDate;
            // An image the user branded carries no rates. Records written before
            // sourceKind existed have none either, so undefined means "rates".
            const isBranded = report.editedData.sourceKind === 'branded-upload';
            // No invented fallbacks: a figure shown here should be one the
            // report actually stated, or nothing at all.
            const bigRate = report.editedData.maharashtra?.big?.display;
            const extraBig = report.editedData.maharashtra?.extraBig?.display;
            const arrivals = report.editedData.totalArrivals?.display;
            const trucks = report.editedData.truckCount;

            return (
              <div
                key={report.id}
                onClick={() => onSelectReport(report)}
                className="glass-card glass-card-hover rounded-2xl p-4 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div className="flex items-start sm:items-center gap-4">
                  {/* Thumbnail */}
                  <div className="w-16 h-20 sm:w-20 sm:h-24 rounded-xl bg-slate-900 overflow-hidden shrink-0 border border-slate-800 group-hover:border-emerald-500/40 relative">
                    {report.imagePath ? (
                      <img
                        src={report.imagePath}
                        alt="Poster preview"
                        className="w-full h-full object-cover object-top"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg">🧅</div>
                    )}
                  </div>

                  {/* Information */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm md:text-base font-extrabold text-white">
                        {dateDisplay}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isBranded
                            ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                            : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {isBranded ? 'BRANDED IMAGE' : report.editedData.market || 'APMC BENGALURU'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
                      {isBranded ? (
                        <span className="text-slate-400">Your details added to an uploaded image</span>
                      ) : (
                        <>
                          {bigRate && <span className="font-semibold text-amber-400">Big: ₹{bigRate}</span>}
                          {extraBig && <span className="text-slate-400">Extra Big: ₹{extraBig}</span>}
                          {arrivals && (
                            <span className="text-slate-400">
                              Arrivals: {arrivals}
                              {trucks ? ` (${trucks})` : ''}
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-1 max-w-md font-mono">
                      {report.rawMessage ? report.rawMessage.replace(/\n+/g, ' • ') : 'Manual entry'}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={(e) => handleShare(report, e)}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-emerald-950 text-slate-300 hover:text-emerald-400 border border-slate-800 transition-colors"
                    title="Share Link"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>

                  {report.imagePath && (
                    <a
                      href={report.imagePath}
                      download={`onion-poster-${dateDisplay.replace(/\./g, '-')}.png`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
                      title="Download PNG"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}

                  <button
                    onClick={(e) => handleDelete(report.id, e)}
                    disabled={deletingId === report.id}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-red-950 text-slate-400 hover:text-red-400 border border-slate-800 transition-colors"
                    title="Delete Record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onSelectReport(report)}
                    className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30 flex items-center gap-1 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
