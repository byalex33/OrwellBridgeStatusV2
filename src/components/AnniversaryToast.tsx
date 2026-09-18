"use client";

import { useEffect, useState } from "react";
import { Heart, X } from "lucide-react";
import { analytics } from "@/components/TracwellAnalytics";

const storageKey = "orwell-anniversary-2-dismissed";

export default function AnniversaryToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey)) return;
    } catch { /* The thank-you still works when storage is blocked. */ }
    const timer = window.setTimeout(() => setVisible(true), 1800);
    return () => window.clearTimeout(timer);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(storageKey, "1");
    } catch { /* Dismiss for this visit when storage is blocked. */ }
    analytics?.track("anniversary_toast_dismissed", { anniversary: 2 });
  }

  return (
    <aside aria-label="A thank-you from Alex" className="pointer-events-none fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 sm:left-auto sm:right-6 sm:bottom-6 sm:w-[390px]">
      <div role="status" aria-live="polite" aria-atomic="true">
        {visible && (
          <div className="anniversary-toast pointer-events-auto relative overflow-hidden rounded-2xl border border-border bg-popover/95 p-5 text-popover-foreground shadow-[0_12px_48px_-12px_#00000040] backdrop-blur-xl">
            <div aria-hidden="true" className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-rose-400/70 to-transparent" />
            <div className="mb-4 flex items-center gap-2.5 pr-8">
              <span className="flex size-8 items-center justify-center rounded-full border border-rose-500/15 bg-rose-500/10 text-rose-700 dark:text-rose-300">
                <Heart aria-hidden="true" className="anniversary-heart size-3.5 fill-current" strokeWidth={1.5} />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Two years of Orwell Bridge Status</span>
            </div>
            <h2 className="text-lg font-semibold leading-snug tracking-tight">Two years.<br />A lot of bridge checks.</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Thanks for making this little site part of your journey. Properly chuffed you&apos;re here.</p>
            <p className="mt-4 text-xs font-medium">With love, Alex <span aria-hidden="true" className="ml-1 text-rose-700 dark:text-rose-300">:)</span></p>
            <button type="button" onClick={dismiss} aria-label="Dismiss thank-you" className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-ring">
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
