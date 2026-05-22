import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // PWA / offline shell (OFF-01, OFF-02 / D-07, D-08). The `injectManifest`
    // strategy builds a Workbox precache manifest into the hand-written service
    // worker at `src/sw.ts` (kept at the `src/` root — outside the ENGINE_GLOBS
    // so its `workbox-*` imports are lint-legal — RESEARCH A1). The web app
    // manifest makes SnapSheet installable on mobile, tablet and desktop.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: 'auto',
      manifest: {
        name: 'SnapSheet — Passport Photo Editor',
        short_name: 'SnapSheet',
        display: 'standalone',
        theme_color: '#f6f6f7',
        background_color: '#f6f6f7',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        // The full app shell AND the lazy HEIC-decode chunk are precached, so
        // the app works fully offline — including a first-ever HEIC import
        // (iPhone photos) made before the chunk was ever fetched online. User
        // image data is never a network request, so it is never precached
        // (D-08 privacy).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,wasm}'],
        // The HEIC-decode chunk is ~2.7 MB — above Workbox's default 2 MiB
        // per-file precache cap. Raise the cap so it precaches; the larger
        // install is the deliberate cost of a fully-offline HEIC import.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      // Register the service worker in dev too, so the PWA / offline shell can
      // be exercised against `npm run dev`. `type: 'module'` is required for an
      // injectManifest TS source worker under the dev server.
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  // ES-module worker output: required because image.worker.ts code-splits a
  // lazy `import('heic-to/next')` chunk (D-02). Vite's default `iife` worker
  // format cannot code-split — it errors on a code-splitting worker build.
  worker: { format: 'es' },
  // Pre-bundle the image worker's dependencies. Vite's dep scanner does not
  // follow `new Worker()` imports, so without this a cold dev start can
  // re-optimize `pica`/`exifr` AFTER the worker already requested them —
  // returning `504 (Outdated Optimize Dep)`, which crashes the worker and
  // surfaces as a spurious `decode-error` on the first import.
  optimizeDeps: {
    include: ['pica', 'exifr'],
  },
});
