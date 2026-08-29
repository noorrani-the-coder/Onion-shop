import React, { useEffect, useState } from 'react';
import { CheckCircle2, Share2 } from 'lucide-react';
import { SAVE_EVENT, SaveEventDetail } from '../services/share';

/**
 * Confirms that a download actually happened.
 *
 * A file written straight to Documents gives no sign of itself — no browser
 * download bar, no share sheet closing — so without this the button looks
 * broken and people press it again. It listens for the save rather than taking
 * props, because five different screens can start one and none of them should
 * have to carry the plumbing.
 */
export const SaveToast: React.FC = () => {
  const [message, setMessage] = useState<string | null>(null);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    const onSaved = (event: Event) => {
      const detail = (event as CustomEvent<SaveEventDetail>).detail;
      setShared(detail.outcome === 'shared');
      setMessage(
        detail.outcome === 'shared'
          ? 'Sent to the share sheet'
          : detail.location
            ? `Downloaded to ${detail.location}`
            : 'Downloaded to your device'
      );
    };

    window.addEventListener(SAVE_EVENT, onSaved);
    return () => window.removeEventListener(SAVE_EVENT, onSaved);
  }, []);

  // Each new save restarts the clock, so a second download does not inherit
  // the remainder of the first one's timer.
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      // Sits above the mobile navigation bar so it never covers it.
      className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-sm pointer-events-none"
    >
      <div className="flex items-center gap-2.5 rounded-xl bg-emerald-600 text-white shadow-2xl shadow-emerald-900/40 px-4 py-3">
        {shared ? <Share2 className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
        <span className="text-sm font-semibold leading-snug">{message}</span>
      </div>
    </div>
  );
};
