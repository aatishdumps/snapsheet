/**
 * bitmapCache.ts — the runtime decoded-ImageBitmap cache (RESEARCH Open Question 1 / Pitfall 4).
 *
 * Live decoded `ImageBitmap`s are RUNTIME-ONLY. They are never held in a
 * Zustand store, never written to IndexedDB, and never captured in an undo
 * snapshot — keeping the document model plain-data and structuredClone-safe
 * (threats T-04-03, T-04-04). On project restore each bitmap is re-derived
 * from its original `Blob` (the `assets` table, D-08); the cache is keyed by
 * `assetId` so a `PhotoEntry` resolves its pixels via `getBitmap(assetId)`.
 *
 * `ImageBitmap` holds GPU/native memory that is NOT garbage-collected — it
 * must be released explicitly. `deleteBitmap` and `clearBitmaps` call
 * `bitmap.close()` before dropping the reference (Pitfall 4).
 *
 * SCOPE: a module-level `Map` plus four named functions — no store, no React,
 * no DOM beyond the `ImageBitmap` type. Named exports only.
 */

/** Module-level runtime cache — assetId → live decoded ImageBitmap. */
const cache = new Map<string, ImageBitmap>();

/** Store a decoded bitmap under its asset id (overwrites any prior entry). */
export function putBitmap(assetId: string, bitmap: ImageBitmap): void {
  cache.set(assetId, bitmap);
}

/** Retrieve the decoded bitmap for an asset id, or undefined if not cached. */
export function getBitmap(assetId: string): ImageBitmap | undefined {
  return cache.get(assetId);
}

/**
 * Remove an asset's bitmap from the cache, closing it first to free GPU
 * memory (Pitfall 4). Unknown ids are a silent no-op.
 */
export function deleteBitmap(assetId: string): void {
  const bitmap = cache.get(assetId);
  if (bitmap) {
    bitmap.close();
    cache.delete(assetId);
  }
}
