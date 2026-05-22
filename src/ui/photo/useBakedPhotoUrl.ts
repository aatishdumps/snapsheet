/**
 * useBakedPhotoUrl.ts — resolve a photo's *baked* result to an object URL.
 *
 * Unlike `usePhotoUrl` (which yields the pristine source bitmap), this hook
 * runs the photo's `PhotoAdjustments` through `bakeBitmap` — applying crop,
 * rotate, flip and the CSS-filter colour stack — and exposes the flattened
 * result as an object URL. Because it uses the exact same `bakeBitmap` the
 * export path uses, the preview is pixel-identical to what gets exported
 * (WYSIWYG), including non-destructive crop.
 *
 * The bake is debounced (~120ms) so dragging the colour sliders stays
 * responsive; the working bitmap is ~2000px so a re-bake is cheap.
 *
 * SCOPE: a UI hook — lives in `/ui` (React/DOM permitted). Named exports only.
 */
import { useEffect, useState } from 'react';
import { bakePhoto } from './bakePhoto';
import type { PhotoAdjustments } from '../state/photoAdjustments';

/** Debounce, in ms, before re-baking after an adjustment change. */
const BAKE_DEBOUNCE_MS = 120;

/**
 * Resolve `assetId` + `adj` to an object URL of the baked photo. Returns
 * `null` until the first bake completes. Re-bakes (debounced) whenever the
 * adjustments change, so crop / rotate / flip / colour are all reflected.
 */
export function useBakedPhotoUrl(
  assetId: string | null,
  adj: PhotoAdjustments,
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (assetId === null) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    const timer = setTimeout(() => {
      void (async () => {
        const baked = await bakePhoto(assetId, adj);
        if (cancelled || !baked) return;
        objectUrl = URL.createObjectURL(baked.blob);
        setUrl(objectUrl);
      })();
    }, BAKE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId, adj]);

  return assetId === null ? null : url;
}
