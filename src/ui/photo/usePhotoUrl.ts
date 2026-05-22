/**
 * usePhotoUrl.ts — resolve a photo's working bitmap to an object URL.
 *
 * Photos live as decoded `ImageBitmap`s in `bitmapCache` (keyed by assetId) and
 * as original `Blob`s in IndexedDB. The DOM UI renders `<img>` tags, which need
 * a URL. This hook produces a stable object URL for a photo, decoding from the
 * asset Blob when the bitmap is not yet cached (e.g. after a reload), and
 * revokes the URL on cleanup.
 *
 * SCOPE: a UI hook — lives in `/ui` (React/DOM permitted). Named exports only.
 */
import { useEffect, useState } from 'react';
import { resolveSourceBitmap } from './bakePhoto';

/**
 * Resolve `assetId` to a displayable object URL. Returns `null` until the
 * bitmap is ready. `version` lets the caller force a re-resolve after a bake.
 */
export function usePhotoUrl(
  assetId: string | null,
  version = 0,
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    // Nothing to load when there is no photo — the hook return below yields
    // `null` for a null assetId, and the prior run's cleanup revokes its URL,
    // so no setState is needed here (avoids a cascading-render lint warning).
    if (assetId === null) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    void (async () => {
      const bmp = await resolveSourceBitmap(assetId);
      if (cancelled || !bmp) return;
      // Draw the bitmap into a canvas and export a blob URL — ImageBitmap
      // itself is not directly assignable to <img src>.
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(bmp, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      );
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId, version]);

  return assetId === null ? null : url;
}
