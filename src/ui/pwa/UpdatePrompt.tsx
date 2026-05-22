/// <reference types="vite-plugin-pwa/client" />
/**
 * UpdatePrompt.tsx — the PWA service-worker update prompt (OFF-01 / D-08).
 *
 * Registers the service worker via `vite-plugin-pwa`'s `virtual:pwa-register`
 * module and surfaces the §Copywriting "New version available." toast with a
 * [Reload] action when a new build is waiting. Choosing Reload calls
 * `updateSW(true)`, which posts the `SKIP_WAITING` message the hand-written SW
 * (`src/sw.ts`) listens for — so the update is user-driven, never a blind
 * `skipWaiting` (Pitfall 8). An optional "ready to work offline" toast confirms
 * the first-load precache completed.
 *
 * SCOPE: a thin shell component — registration + a toast. Lives in `/ui` (React
 * permitted). `@theme` tokens only. StrictMode-safe: the registration runs once
 * in a `useEffect` with a guard ref. Named exports only.
 */
import { useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

/**
 * The PWA update prompt. Renders nothing until the service worker reports a
 * waiting update (or, briefly, that the app is offline-ready).
 */
export function UpdatePrompt(): React.ReactElement | null {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const updateRef = useRef<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    // `registerSW` is idempotent per page; the ref guard keeps StrictMode's
    // double-invoke from registering twice.
    if (updateRef.current) return;
    updateRef.current = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onOfflineReady() {
        setOfflineReady(true);
      },
    });
  }, []);

  if (!needRefresh && !offlineReady) return null;

  const handleReload = (): void => {
    setNeedRefresh(false);
    // `updateSW(true)` posts SKIP_WAITING to the waiting SW and reloads once it
    // takes control (controllerchange) — see src/sw.ts.
    void updateRef.current?.(true);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      // `pointer-events-none` on the wrapper so the toast never intercepts
      // clicks on the UI beneath it; the toast's own buttons re-enable pointer
      // events. (A passive status toast must not block interaction.)
      //
      // Anchored to the bottom-LEFT corner — not bottom-center. The toast's
      // own [Reload]/[Dismiss] buttons carry `pointer-events-auto`, so a
      // centered toast would still let those buttons physically overlap (and
      // intercept clicks on) primary actions: the mobile bottom toolbar
      // (bottom-center) and the desktop panel's "Export sheet" button
      // (bottom-right). The bottom-left corner is clear of both.
      className="pointer-events-none fixed bottom-[88px] left-md z-[60] flex items-center gap-md rounded-xl border border-chrome bg-card px-lg py-md text-label text-fg shadow-pop sm:bottom-md [&_button]:pointer-events-auto"
    >
      {needRefresh ? (
        <>
          <span className="font-medium">New version available.</span>
          <button
            type="button"
            className="inline-flex min-h-[40px] items-center rounded-lg bg-accent px-md text-label font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={handleReload}
          >
            Reload
          </button>
        </>
      ) : (
        <>
          <span className="font-medium">Ready to work offline.</span>
          <button
            type="button"
            className="inline-flex min-h-[40px] items-center rounded-lg border border-chrome bg-card px-md text-label font-medium text-fg transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={() => setOfflineReady(false)}
          >
            Dismiss
          </button>
        </>
      )}
    </div>
  );
}
