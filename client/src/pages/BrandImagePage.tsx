import React, { useEffect, useRef, useState } from 'react';
import { Upload, Image as ImageIcon, Share2, Download, RefreshCw, AlertTriangle } from 'lucide-react';
import { ShopSettings } from '@shared/types';
import { api } from '../services/api';
import { sharePosterImage } from '../services/share';

interface BrandImagePageProps {
  settings: ShopSettings | null;
}

interface Branded {
  imageUrl: string;
  width: number;
  height: number;
}

/**
 * Add the shop's details to a picture the trader already has.
 *
 * The everyday case: an arrivals board arrives in a WhatsApp group and the
 * trader wants to forward it on with their own name and number attached. The
 * board itself is left exactly as received — nothing here reads or rewrites it.
 */
export const BrandImagePage: React.FC<BrandImagePageProps> = ({ settings }) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [result, setResult] = useState<Branded | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Object URLs are a real allocation; release the previous one whenever the
  // picked file changes, and the last one when the screen goes away.
  useEffect(() => {
    if (!file) {
      setLocalPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (chosen: File | null) => {
    setResult(null);
    setError(null);
    setFile(chosen);
  };

  const generate = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const branded = await api.brandImage(file);
      setResult(branded);
    } catch (err: any) {
      setError(err.message || 'Something went wrong adding your details.');
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!result) return;
    try {
      await sharePosterImage({
        imageUrl: result.imageUrl,
        fileName: `${(settings?.shopName || 'shop').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-market-update.png`,
        title: settings?.shopName || 'Market update',
        text: [settings?.shopName, settings?.phone].filter(Boolean).join(' • ')
      });
    } catch (err: any) {
      setError(err.message || 'Could not open the share sheet.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-white">Add your details to an image</h1>
        <p className="text-slate-300 mt-1 text-sm">
          Pick any market board or photo. Your name and logo go on top, your number and address
          below — the picture itself is left untouched.
        </p>
      </header>

      <div className="glass-card rounded-2xl p-5">
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={e => pick(e.target.files?.[0] ?? null)}
        />

        <button
          onClick={() => fileInput.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-3 py-10 rounded-xl
                     border-2 border-dashed border-sky-500/40 hover:border-sky-400/70
                     bg-slate-950/40 transition-colors"
        >
          <Upload className="w-8 h-8 text-sky-400" />
          <span className="text-slate-200 font-semibold">
            {file ? 'Choose a different image' : 'Choose an image'}
          </span>
          <span className="text-xs text-slate-400">JPEG, PNG or WebP · up to 10 MB</span>
        </button>

        {localPreview && (
          <div className="mt-5">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Selected</p>
            <img src={localPreview} alt="Selected" className="w-full rounded-xl border border-slate-700" />
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 text-sm text-rose-300 bg-rose-950/40
                          border border-rose-800/50 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={generate}
          disabled={!file || busy}
          className="mt-5 w-full py-4 rounded-xl font-bold text-white bg-emerald-600
                     hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2"
        >
          {busy ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
          {busy ? 'Adding your details…' : 'Add my shop details'}
        </button>
      </div>

      {result && (
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-bold text-white">Ready to share</h2>
            <span className="text-xs text-slate-400 font-mono">
              {result.width}×{result.height}
            </span>
          </div>

          <img src={result.imageUrl} alt="Branded" className="w-full rounded-xl border border-slate-700" />

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              onClick={share}
              className="py-3 rounded-xl font-bold text-white bg-sky-600 hover:bg-sky-500
                         flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" /> Share
            </button>
            <a
              href={result.imageUrl}
              download
              className="py-3 rounded-xl font-bold text-slate-100 bg-slate-700 hover:bg-slate-600
                         flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> Download
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
