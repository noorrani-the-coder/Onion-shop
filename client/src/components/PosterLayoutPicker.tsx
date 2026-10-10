import { useState } from 'react';
import { PosterLayout, PosterSize } from '@shared/types';

const KEY = 'posterLayoutPrefs';

export interface PosterPrefs {
  layoutId: PosterLayout;
  posterSize: PosterSize;
}

export function loadPosterPrefs(): PosterPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      layoutId: raw.layoutId === 'large-print' ? 'large-print' : 'classic',
      posterSize: ['9:16', '1:1', '16:9'].includes(raw.posterSize) ? raw.posterSize : '9:16',
    };
  } catch {
    return { layoutId: 'classic', posterSize: '9:16' };
  }
}

function savePosterPrefs(p: PosterPrefs) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode: the choice just won't persist */ }
}

const SIZES: { id: PosterSize; label: string; hint: string }[] = [
  { id: '9:16', label: '9:16', hint: 'Status / Stories' },
  { id: '1:1', label: '1:1', hint: 'Square post' },
  { id: '16:9', label: '16:9', hint: 'Wide / TV' },
];

/** Choose the poster layout and, for large print, its shape. Remembered on this device. */
export function PosterLayoutPicker() {
  const [prefs, setPrefs] = useState<PosterPrefs>(loadPosterPrefs);
  const update = (next: PosterPrefs) => { setPrefs(next); savePosterPrefs(next); };
  const btn = (on: boolean) =>
    `px-4 py-2.5 rounded-xl text-xs font-extrabold border transition-all ${
      on ? 'bg-slate-900/90 border-emerald-500 text-white ring-1 ring-emerald-500' : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
    }`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn(prefs.layoutId === 'classic')} onClick={() => update({ ...prefs, layoutId: 'classic' })}>
          Classic poster
        </button>
        <button type="button" className={btn(prefs.layoutId === 'large-print')} onClick={() => update({ ...prefs, layoutId: 'large-print' })}>
          Large print (extra big, bold)
        </button>
      </div>
      {prefs.layoutId === 'large-print' && (
        <div className="flex flex-wrap gap-2">
          {SIZES.map(s => (
            <button key={s.id} type="button" className={btn(prefs.posterSize === s.id)} onClick={() => update({ ...prefs, posterSize: s.id })}>
              {s.label} <span className="font-semibold text-slate-400">· {s.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
