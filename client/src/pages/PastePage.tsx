import React, { useRef, useState } from 'react';
import { Sparkles, Clipboard, Trash2, ArrowRight, AlertCircle, Info, Zap, ScanLine } from 'lucide-react';
import { ArrivalsBoardData, MarketReportNormalized } from '@shared/types';
import { ArrivalsVerify } from '../components/ArrivalsVerify';
import { api } from '../services/api';
import { saveImage } from '../services/share';

interface PastePageProps {
  onExtractionSuccess: (rawMessage: string, extracted: MarketReportNormalized) => void;
}

const PRESETS = [
  {
    id: 'format-a',
    title: 'Format A (Original APMC)',
    desc: 'Standard multi-line APMC report with ☁️ and bags',
    text: `APMC BENGALURU
ONION MARKET REPORT
Date. 22.08.2026

apmc wise Arrivals
65,326 bags 325+ Trucks

Maharashtra onions
Extra Big only. 4300-4500
BIG. 4000-4200
Mukkal. 3500-3800
Medium. 3000-3500
Golta. 2500-3000
Golty. 2000-2400
Chopda 2000-3000
Average quality. 3000-3500

Karnataka Vijayapura onions
Rates. 3000-3700

New onions
Karnataka 7000+ bags
Rates. 1600-3400
1-2 lot. 3500-3800
Sales slow.
Weather ☁️
Rates for 100 kg`
  },
  {
    id: 'format-b',
    title: 'Format B (Colon & "to")',
    desc: 'Uses "to", slashes & "MH Onion" labels',
    text: `Bangalore APMC Onion Rates
22/08/26

Arrival - 65,326 bags
Trucks - 325+

MH Onion:
Big: 4000 to 4200
Extra Big: 4300-4500
Medium: 3000/3500
Golta: 2500-3000

Vijayapura:
3000-3700

New Karnataka:
7000+ bags
1600-3400

Sales: Slow
Weather: Cloudy`
  },
  {
    id: 'format-c',
    title: 'Format C (All Caps & Short)',
    desc: 'Short codes: BIG, MED, GOLTA, GOLTY',
    text: `BENGALURU ONION MARKET
TODAY RATE

MH:
BIG 4000-4200
MED 3000-3500
GOLTA 2500-3000
GOLTY 2000-2400

VIJAYAPURA 3000-3700

NEW ONION 1600-3400

ARRIVAL 65326
TRUCK 325+`
  },
  {
    id: 'format-d',
    title: 'Format D (Slash Rates)',
    desc: 'Slash rates e.g. 4300/4500 with date prefix',
    text: `22-08-2026 Bangalore APMC

Maharashtra onion:
Extra big 4300/4500
Big quality 4000/4200
Medium 3000/3500
Golta 2500/3000

Karnataka Vijayapura 3000-3700

New onion 1600-3400
7,000+ bags

Sales slow
Cloudy
Rate per 100kg`
  },
  {
    id: 'format-veg',
    title: 'Format E (Vegetables & Mandi)',
    desc: 'Potato, Tomato, Garlic, Ginger & Mandi commodities',
    text: `APMC BENGALURU
DAILY VEGETABLE & MANDI REPORT
Date: 23.08.2026

Arrivals: 45,000 bags (210 Trucks)

Maharashtra Onions:
BIG: 3800-4200
MEDIUM: 2800-3300
GOLTA: 2200-2600

Vegetable Rates:
POTATO (Agra): 1800-2200 / 100kg
TOMATO (Hybrid): 600-850 / 25kg box
GARLIC (M.P Special): 14000-18000 / 100kg
GINGER: 6500-8000 / 100kg
GREEN CHILLI: 2800-3600 / 50kg
CARROT: 1600-2100 / 100kg

Market: Steady Demand
Weather: Clear ☀️`
  }
];

export const PastePage: React.FC<PastePageProps> = ({ onExtractionSuccess }) => {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const imageInput = useRef<HTMLInputElement>(null);
  // An arrivals board is rendered here rather than sent to the rate verify
  // screen, which has no fields for bags or vehicles.
  const [board, setBoard] = useState<{ imageUrl: string; width: number; height: number } | null>(null);
  // Figures read off a picture wait here for the operator to confirm them.
  const [arrivalsDraft, setArrivalsDraft] = useState<ArrivalsBoardData | null>(null);
  const [readingImage, setReadingImage] = useState(false);

  /**
   * True while the screen belongs to a picture rather than pasted text.
   *
   * The paste button says "Extract & Verify" and re-runs the text extractor —
   * meaningless mid-upload, and actively wrong next to figures already read
   * from an image and waiting to be confirmed. The screen shows one path at a
   * time.
   */
  const imageFlow = readingImage || Boolean(arrivalsDraft) || Boolean(board);

  /** Editing the text by hand returns the screen to the paste flow. */
  const editMessage = (value: string) => {
    setMessage(value);
    setArrivalsDraft(null);
    setBoard(null);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setMessage(text);
        setError(null);
      }
    } catch (err) {
      console.log('Clipboard access denied or unavailable', err);
    }
  };

  /**
   * Read the report off a picture instead of pasted text.
   *
   * The image is transcribed on the server and the text runs through the same
   * extractor as a paste, so this rejoins the normal verify step rather than
   * skipping ahead — a photographed rate can be misread, and nobody should
   * publish one without looking at it.
   */
  const handleImage = async (file: File | null) => {
    if (!file) return;
    setReadingImage(true);
    setLoading(true);
    setError(null);
    setBoard(null);
    setArrivalsDraft(null);
    try {
      const response = await api.extractReportFromImage(file);
      setMessage(response.rawMessage || '');

      /**
       * Two different reports arrive as pictures. An arrivals board lists bag
       * and vehicle counts and has no rates at all, so it goes to its own
       * renderer — pushed through the rate flow it comes back with "26,776
       * BAGS" turned into a price and a whole market missing.
       */
      if (response.kind === 'arrivals' && response.arrivals) {
        // Not generated yet: a photographed figure gets checked first.
        setArrivalsDraft(response.arrivals);
        return;
      }

      if (response.isUnrelated) {
        setError('That image does not look like an APMC market report.');
        return;
      }
      onExtractionSuccess(response.rawMessage || '', response.data);
    } catch (err: any) {
      setError(err.message || 'Could not read a report from that image.');
    } finally {
      setLoading(false);
      setReadingImage(false);
      if (imageInput.current) imageInput.current.value = '';
    }
  };

  const buildBoard = async (confirmed: ArrivalsBoardData) => {
    setLoading(true);
    setError(null);
    try {
      setBoard(await api.generateArrivalsBoard(confirmed));
      setArrivalsDraft(null);
    } catch (err: any) {
      setError(err.message || 'Could not build the arrivals board.');
    } finally {
      setLoading(false);
    }
  };

  const handleExtract = async () => {
    if (!message.trim()) {
      setError('Please paste today’s WhatsApp market report message first.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.extractReport(message);
      if (response.isUnrelated) {
        setError("This message doesn't appear to be an APMC market rate report. Please verify or paste the mandi/vegetable report text.");
        setLoading(false);
        return;
      }
      onExtractionSuccess(message, response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to extract report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 md:pb-12 animate-fadeIn">
      {/* Header & Presets */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Step 1 of 3: Input Report</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white">Paste WhatsApp Market Report</h1>
            <p className="text-xs md:text-sm text-slate-400 mt-0.5">
              Copy the daily update from your WhatsApp mandi group and paste it below.
            </p>
          </div>

          {/* Quick Preset Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
            <span className="text-xs font-bold text-slate-400 mr-1 shrink-0">Sample:</span>
            {PRESETS.map((preset, idx) => (
              <button
                key={preset.id}
                onClick={() => {
                  editMessage(preset.text);
                  setError(null);
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-900 hover:bg-emerald-950 text-slate-300 hover:text-emerald-400 border border-slate-700 hover:border-emerald-500/50 transition-colors shrink-0 active:scale-95"
                title={preset.desc}
              >
                Format {String.fromCharCode(65 + idx)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs md:text-sm flex items-start gap-3 animate-shake">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Notice:</span> {error}
          </div>
        </div>
      )}

      {/* Text Area Card */}
      <div className="glass-card rounded-3xl p-5 md:p-6 space-y-4 border border-slate-800 focus-within:border-emerald-500/50 transition-colors shadow-2xl">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Clipboard className="w-4 h-4 text-emerald-400" />
            <span>WhatsApp Message Text</span>
          </label>

          <div className="flex items-center gap-2">
            {message && (
              <button
                onClick={() => editMessage('')}
                className="text-xs text-slate-400 hover:text-red-400 flex items-center gap-1 transition-colors px-2 py-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            )}

            <button
              onClick={handlePasteFromClipboard}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/30 flex items-center gap-1 transition-colors"
            >
              <Clipboard className="w-3.5 h-3.5" />
              Paste from Clipboard
            </button>

            <input
              ref={imageInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => handleImage(e.target.files?.[0] ?? null)}
            />
            <button
              onClick={() => imageInput.current?.click()}
              disabled={loading}
              className="text-xs font-semibold text-sky-300 hover:text-sky-200 bg-sky-500/10 hover:bg-sky-500/20 px-2.5 py-1 rounded-lg border border-sky-500/30 flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              <ScanLine className="w-3.5 h-3.5" />
              Read from Image
            </button>
          </div>
        </div>

        <textarea
          rows={12}
          value={message}
          onChange={(e) => editMessage(e.target.value)}
          placeholder={`Paste your WhatsApp Onion Market Report here...\n\nExample:\nAPMC BENGALURU\nDate: 22.08.2026\nArrivals: 65,326 bags (325+ trucks)\n\nMaharashtra Onions:\nExtra Big: 4300-4500\nBig: 4000-4200\nMedium: 3000-3500\nGolta: 2500-3000\n\nVijayapura: 3000-3700\nNew Onion: 1600-3400 (7000+ bags)`}
          className="w-full bg-slate-950/80 rounded-2xl p-4 text-sm md:text-base font-mono text-slate-100 placeholder-slate-600 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-y leading-relaxed"
        />

        {/*
          An arrivals board read from a picture. Shown next to the transcript
          above so the figures can be checked against what was actually read
          before anyone forwards it on.
        */}
        {arrivalsDraft && (
          <ArrivalsVerify initial={arrivalsDraft} busy={loading} onGenerate={buildBoard} />
        )}

        {board && (
          <div className="mt-4 rounded-2xl border border-sky-500/30 bg-sky-950/20 p-4">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-bold text-white text-sm">Arrivals board ready</h2>
              <span className="text-[11px] font-mono text-slate-400">
                {board.width}×{board.height}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              This report lists bags and vehicles, not rates, so it was built as an arrivals board.
              Check the figures against the text above before sharing.
            </p>
            <img
              src={board.imageUrl}
              alt="Arrivals board"
              className="w-full rounded-xl border border-slate-700"
            />
            <button
              onClick={async () => {
                setError(null);
                try {
                  await saveImage(board.imageUrl, 'apmc-arrivals-board.png');
                } catch (err) {
                  setError((err as Error).message || 'Could not save the board.');
                }
              }}
              className="mt-3 w-full text-center py-3 rounded-xl font-bold text-white bg-sky-600 hover:bg-sky-500"
            >
              Download board
            </button>
          </div>
        )}

        {/* Bottom Bar: hidden while the screen belongs to an uploaded image. */}
        {!imageFlow && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="text-xs text-slate-400 flex items-center gap-4">
            <span>{message.length} characters</span>
            <span>{message.split(/\r?\n/).filter(Boolean).length} lines</span>
          </div>

          <button
            onClick={handleExtract}
            disabled={loading || !message.trim()}
            className={`px-6 py-3.5 rounded-2xl font-black text-sm md:text-base flex items-center justify-center gap-2.5 transition-all shadow-xl active:scale-95 ${
              loading || !message.trim()
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-emerald-500/25 glow-emerald'
            }`}
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Understanding Market Report...</span>
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 text-slate-950" />
                <span>Extract &amp; Verify Report</span>
                <ArrowRight className="w-4 h-4 text-slate-950" />
              </>
            )}
          </button>
        </div>
        )}
      </div>

      {/* Intelligent Features Featurette */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="glass-card rounded-2xl p-3.5 border-slate-800/80 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-200">Any WhatsApp Format</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">Handles colons, slashes, "to", asterisks, Hindi/English mix &amp; emojis.</p>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-3.5 border-slate-800/80 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-200">100% Price Precision</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">Never guesses or invents rates. Exact price ranges &amp; plus signs preserved.</p>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-3.5 border-slate-800/80 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-200">Always Editable</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">You always get to verify and adjust every number before making the PNG.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
