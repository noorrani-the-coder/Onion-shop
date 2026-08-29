import React, { useState } from 'react';
import { Check, RefreshCw, AlertTriangle } from 'lucide-react';
import { ArrivalsBoardData } from '@shared/types';

interface ArrivalsVerifyProps {
  initial: ArrivalsBoardData;
  busy?: boolean;
  onGenerate: (data: ArrivalsBoardData) => void;
}

/**
 * Check the figures read off a picture before the board is built.
 *
 * Nothing here is cosmetic. The numbers came from a photograph, and a smudged
 * 3 read as an 8 is a rate a trader acts on — so every count is editable, and
 * the operator is expected to compare them against the image in front of them
 * rather than trust the transcription.
 */
export const ArrivalsVerify: React.FC<ArrivalsVerifyProps> = ({ initial, busy, onGenerate }) => {
  const [data, setData] = useState<ArrivalsBoardData>(initial);

  /**
   * Edits go through a copy rather than mutating state in place: React compares
   * by reference, and editing the existing object would leave the screen
   * showing the old value while the data underneath had changed.
   */
  const editProduct = (marketIndex: number, productIndex: number, field: 'name' | 'arrival' | 'unit' | 'vehicles', value: string) => {
    setData(current => {
      const markets = current.markets.map((market, mi) => {
        if (mi !== marketIndex) return market;
        const products = market.products.map((product, pi) => {
          if (pi !== productIndex) return product;
          const next = { ...product, [field]: value };
          // Keep the numeric mirror in step, so the board's own totals stay
          // consistent with what is on screen.
          if (field === 'arrival') next.arrivalValue = Number(value.replace(/,/g, '')) || null;
          if (field === 'vehicles') next.vehicleValue = Number(value.replace(/,/g, '')) || null;
          return next;
        });
        return { ...market, products };
      });
      return { ...current, markets };
    });
  };

  const editMarketName = (marketIndex: number, value: string) => {
    setData(current => ({
      ...current,
      markets: current.markets.map((m, i) => (i === marketIndex ? { ...m, name: value } : m))
    }));
  };

  const statedTotal = data.totalVehicles?.total;
  const summedTotal = data.markets.reduce(
    (sum, m) => sum + m.products.reduce((s, p) => s + (p.vehicleValue ?? 0), 0),
    0
  );
  const totalsDisagree = typeof statedTotal === 'number' && statedTotal !== summedTotal;

  const cell =
    'bg-slate-950/70 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/50 w-full';

  return (
    <div className="mt-4 rounded-2xl border border-sky-500/30 bg-sky-950/20 p-4 space-y-4">
      <div>
        <h2 className="font-bold text-white text-sm">Check the figures</h2>
        <p className="text-xs text-slate-400 mt-1">
          These were read from your image. Compare them against the picture and correct anything
          wrong before building the board.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-slate-400">
          Date
          <input
            className={cell + ' mt-1'}
            value={data.reportDateDisplay || ''}
            onChange={e => setData({ ...data, reportDateDisplay: e.target.value })}
          />
        </label>
        <label className="text-xs text-slate-400">
          Day
          <input
            className={cell + ' mt-1'}
            value={data.weekday || ''}
            onChange={e => setData({ ...data, weekday: e.target.value })}
          />
        </label>
      </div>

      {data.markets.map((market, mi) => (
        <div key={mi} className="space-y-2">
          <input
            className={cell + ' font-bold'}
            value={market.name}
            onChange={e => editMarketName(mi, e.target.value)}
          />
          <div className="space-y-1.5">
            {market.products.map((product, pi) => (
              <div key={pi} className="grid grid-cols-12 gap-1.5">
                <input
                  className={cell + ' col-span-4'}
                  value={product.name}
                  onChange={e => editProduct(mi, pi, 'name', e.target.value)}
                />
                <input
                  className={cell + ' col-span-3 text-right font-mono'}
                  value={product.arrival}
                  onChange={e => editProduct(mi, pi, 'arrival', e.target.value)}
                />
                <input
                  className={cell + ' col-span-3'}
                  value={product.unit}
                  onChange={e => editProduct(mi, pi, 'unit', e.target.value)}
                />
                <input
                  className={cell + ' col-span-2 text-right font-mono'}
                  value={product.vehicles}
                  onChange={e => editProduct(mi, pi, 'vehicles', e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {totalsDisagree && (
        <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-950/30 border border-amber-700/40 rounded-lg p-2.5">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            The board states {statedTotal} vehicles but the rows add up to {summedTotal}. The stated
            total is what will be printed — check whether a row was misread.
          </span>
        </div>
      )}

      <button
        onClick={() => onGenerate(data)}
        disabled={busy}
        className="w-full py-3.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        {busy ? 'Building board…' : 'Figures are correct — build board'}
      </button>
    </div>
  );
};
