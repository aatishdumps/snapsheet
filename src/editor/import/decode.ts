/**
 * decode.ts — decode dispatch: native bitmap decode vs lazy HEIC WASM
 * (IMP-05, IMP-06 / D-04).
 *
 * Turns a sniffed file into a decoded `ImageBitmap`. JPG/PNG/WebP go through
 * the browser-native `createImageBitmap`; HEIC/HEIF detours through the
 * `heic-to` libheif-WASM decoder, which is lazy-loaded on first use (D-02) so
 * the ~2.6 MB WASM chunk is never fetched until a HEIC file is imported.
 *
 * SCOPE: pure decode dispatch — no DOM, no React (honors `no-restricted-imports`).
 * This module's logic physically runs inside the image worker (plan 02-03); it
 * lives in `import/` so it stays a small, importable, headless function.
 * Browser/WASM APIs here are unavailable in jsdom — exercised via Playwright +
 * the worker integration, NOT a Vitest unit test.
 *
 * Orientation: this module always passes `imageOrientation: 'none'` — orientation
 * is resolved exclusively by `orientation.ts` (D-15); see Pitfall 2.
 */
import type { DetectedFormat } from './types';

/** Lazy module-scope cache of the `heic-to/next` decoder (D-02). */
let heicTo: typeof import('heic-to/next').heicTo | null = null;

/**
 * Decode a file to an `ImageBitmap`, dispatching on its sniffed format.
 *
 * @param file the imported file/blob to decode
 * @param fmt  the format resolved by {@link import('./sniff').sniffFormat}
 * @returns the decoded bitmap (orientation not yet baked — see `orientation.ts`)
 */
export async function decode(
  file: Blob,
  fmt: DetectedFormat,
): Promise<ImageBitmap> {
  if (fmt === 'heic') return decodeHeic(file);
  // we control orientation — Pattern 2; never let the browser auto-rotate.
  return createImageBitmap(file, { imageOrientation: 'none' });
}

/**
 * Decode a HEIC/HEIF blob via the lazy-loaded `heic-to` libheif-WASM decoder.
 *
 * The `import('heic-to/next')` is a dynamic import — Vite code-splits it into
 * its own chunk fetched only on the first HEIC import (D-02). The decoder is
 * cached at module scope so subsequent HEIC files reuse it.
 *
 * @param blob the HEIC/HEIF file to decode
 * @returns the decoded `ImageBitmap`
 */
export async function decodeHeic(blob: Blob): Promise<ImageBitmap> {
  if (!heicTo) ({ heicTo } = await import('heic-to/next')); // lazy: first HEIC only
  return heicTo({ blob, type: 'bitmap' }) as Promise<ImageBitmap>;
}
