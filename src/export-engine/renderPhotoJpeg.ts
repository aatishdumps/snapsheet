/**
 * renderPhotoJpeg.ts — full-res single-photo render to JPEG bytes
 *   (EXP-02 / EXP-04 / D-01).
 *
 * The PDF export embeds each photo per-photo (D-02 — never a whole-sheet
 * raster). This module renders ONE original photo at full resolution: it
 * decodes the stored original Blob, re-runs the Phase 3 `applyPipeline` at full
 * res, draws to an `OffscreenCanvas`, and encodes a JPEG `Uint8Array` ready for
 * `pdf-lib`'s `embedJpg`. The decoded `ImageBitmap` is closed before return so
 * only one full-res bitmap is alive at a time (Pitfall 5 / D-01).
 *
 * Split into its own module because `createImageBitmap` /
 * `OffscreenCanvas.convertToBlob` have NO real implementation under jsdom —
 * isolating them here keeps `exportPdf` Vitest-testable (this module boundary
 * is mocked). The real pixel behaviour is verified in
 * `tests/e2e/export-formats.spec.ts`.
 *
 * SCOPE: a single canvas render utility — no React/Konva/ui (the
 * `no-restricted-imports` engine rule covers `src/export-engine/**`). Named
 * exports only.
 */
import type { Pipeline } from '../editor/pipeline/types';
import { applyPipeline } from '../editor/pipeline/applyPipeline';

/**
 * Render one original photo Blob at full resolution through its edit pipeline,
 * returning JPEG bytes for `pdf-lib`'s `embedJpg`.
 *
 * @param original the stored original photo Blob (from `assetRepo.getBlob`)
 * @param pipeline the photo's non-destructive edit op list
 * @param quality  JPEG quality 0–1 (the caller defaults this to 0.92)
 */
export async function renderPhotoJpeg(
  original: Blob,
  pipeline: Pipeline,
  quality: number,
): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(original);
  try {
    // Draw the decoded original into a canvas to read its ImageData.
    const src = new OffscreenCanvas(bitmap.width, bitmap.height);
    const srcCtx = src.getContext('2d');
    if (srcCtx === null) {
      throw new Error('2d context unavailable');
    }
    srcCtx.drawImage(bitmap, 0, 0);
    const srcData = srcCtx.getImageData(0, 0, bitmap.width, bitmap.height);

    // Re-run the Phase 3 pipeline at full resolution (D-03 — same op list).
    const out = applyPipeline(srcData, pipeline);

    // Encode the pipeline output to JPEG.
    const dst = new OffscreenCanvas(out.width, out.height);
    const dstCtx = dst.getContext('2d');
    if (dstCtx === null) {
      throw new Error('2d context unavailable');
    }
    dstCtx.putImageData(out, 0, 0);
    const jpegBlob = await dst.convertToBlob({
      type: 'image/jpeg',
      quality,
    });
    return new Uint8Array(await jpegBlob.arrayBuffer());
  } finally {
    // Release the full-res bitmap before the caller's next iteration.
    bitmap.close();
  }
}
