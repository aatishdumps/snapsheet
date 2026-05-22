/// <reference lib="webworker" />
/**
 * sw.ts — the hand-written Workbox service worker (OFF-01, OFF-02 / D-07, D-08).
 *
 * Built by `vite-plugin-pwa`'s `injectManifest` strategy: Workbox replaces the
 * `self.__WB_MANIFEST` placeholder with the content-hashed app-shell precache
 * manifest at build time, producing `dist/sw.js`.
 *
 * This file lives at the `src/` root ON PURPOSE — it is OUTSIDE the
 * `ENGINE_GLOBS` in `eslint.config.js` (`src/editor/**`, `src/workers/**`, …),
 * so its `workbox-*` imports are lint-legal (RESEARCH A1). It must NOT move
 * under `src/workers/` — that directory IS an engine glob and forbids these
 * imports.
 *
 * Caching policy (D-08 — privacy):
 *  - PRECACHE: the full app shell AND the lazy HEIC-decode chunk (the hashed
 *    `js,css,html,svg,png,woff2,wasm` glob from `vite.config.ts`), so the app
 *    works fully offline — including a first-ever HEIC import.
 *  - RUNTIME CACHE: a CacheFirst safety net for any separately-emitted HEIC
 *    `.wasm` binary; inert while the decoder ships as one precached chunk.
 *  - There is NO route that caches image data — all user image work is
 *    in-memory / IndexedDB and never a network request, so no user photo can
 *    ever land in a cache.
 */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope;

// Precache the hashed app shell — Workbox injects the manifest here at build.
precacheAndRoute(self.__WB_MANIFEST);

// Drop precaches from superseded builds (Pitfall 5 — stale SW defense).
cleanupOutdatedCaches();

// HEIC-decode WASM safety net: the decoder currently ships as a single
// precached JS chunk (see `vite.config.ts`), but if a future build emits a
// separate `.wasm` binary this CacheFirst route keeps it available offline
// after first fetch. Content-addressed by Vite's hashed name, so CacheFirst
// can never serve a stale entry.
registerRoute(
  ({ url }) => url.pathname.includes('heic') || url.pathname.endsWith('.wasm'),
  new CacheFirst({ cacheName: 'heic-wasm-v1' }),
);

// Update lifecycle: never blindly `skipWaiting` (Pitfall 8). The new SW stays
// in `waiting` until the app's `workbox-window` update prompt posts an explicit
// `SKIP_WAITING` message in response to the user choosing "Reload".
self.addEventListener('message', (e: ExtendableMessageEvent) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
