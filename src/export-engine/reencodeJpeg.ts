/**
 * reencodeJpeg.ts — PNG-blob -> JPEG-bytes canvas re-encode (EXP-02 / D-03).
 *
 * `composeSheet` standardizes on a single lossless `image/png` worker output
 * (one code path, no mime threading through the worker protocol). The JPG
 * export path therefore re-encodes that finished PNG to JPEG once, via an
 * `OffscreenCanvas`. A one-time JPEG re-encode of a 300-DPI print raster at
 * q≥0.92 is a deliberate, accepted tradeoff — visually lossless for print.
 *
 * This is split into its own module because the `createImageBitmap` /
 * `OffscreenCanvas.convertToBlob` calls have NO real implementation under
 * jsdom — isolating them here keeps `exportImage` Vitest-testable (the
 * orchestration seam is mocked at this module boundary). The real pixel
 * behaviour of this re-encode is verified in `tests/e2e/export-formats.spec.ts`.
 *
 * SCOPE: a single canvas re-encode utility — no React/Konva/ui (the
 * `no-restricted-imports` engine rule covers `src/export-engine/**`). Named
 * exports only.
 */

/**
 * Re-encode a composed PNG blob to JPEG bytes via an `OffscreenCanvas`.
 *
 * @param pngBlob the composed `image/png` blob from `composeSheet`
 * @param quality JPEG quality 0–1 (the caller defaults this to 0.92)
 */
export async function reencodeToJpeg(
  pngBlob: Blob,
  quality: number,
): Promise<ArrayBuffer> {
  const bitmap = await createImageBitmap(pngBlob);
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      throw new Error('2d context unavailable');
    }
    ctx.drawImage(bitmap, 0, 0);
    const jpegBlob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality,
    });
    return jpegBlob.arrayBuffer();
  } finally {
    bitmap.close();
  }
}
