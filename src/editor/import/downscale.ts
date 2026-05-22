/**
 * downscale.ts — Pica downscale to the editor working copy (D-08 / D-09).
 *
 * Produces the ~2000px-longest-edge working copy the editor renders, leaving
 * the full-resolution original untouched for export. Using Pica's Lanczos
 * resample (D-09) avoids the visible aliasing/moire that native `drawImage`
 * downscaling produces — this matters for a photo tool.
 *
 * SCOPE: pure resample — no DOM, no React (honors `no-restricted-imports`).
 * This module's logic physically runs inside the image worker (plan 02-03) on
 * an `OffscreenCanvas`. Browser APIs here are unavailable in jsdom — exercised
 * via Playwright + the worker integration, NOT a Vitest unit test.
 */
import createPica from 'pica';

// pica 10's default export is a factory function (callable), not a class — it
// returns a Pica instance and also carries a `.Pica` class property. Call it.
/** Module-scope Pica instance — reused across every downscale. */
const pica = createPica();

/**
 * Downscale a bitmap to a working copy bounded to `maxEdge` on its longest side
 * (D-08). If the source already fits, it is returned unchanged.
 *
 * @param src     the decoded, upright full-resolution bitmap
 * @param maxEdge longest-edge target in pixels; defaults to 2000 (D-08)
 * @returns the ~`maxEdge`px working-copy `ImageBitmap`
 */
export async function toWorkingCopy(
  src: ImageBitmap,
  maxEdge = 2000,
): Promise<ImageBitmap> {
  const scale = Math.min(1, maxEdge / Math.max(src.width, src.height));
  if (scale === 1) return src; // already small enough — no resample needed

  const dw = Math.round(src.width * scale);
  const dh = Math.round(src.height * scale);
  const from = new OffscreenCanvas(src.width, src.height);
  const fromCtx = from.getContext('2d');
  if (!fromCtx) {
    throw new Error(
      `downscale: 2D context unavailable for a ${String(src.width)}x${String(src.height)} canvas — image may exceed this device's canvas limit`,
    );
  }
  fromCtx.drawImage(src, 0, 0);
  const to = new OffscreenCanvas(dw, dh);
  await pica.resize(from, to); // Lanczos (D-09)
  // D-11: the source/target canvases drop out of scope here; only the
  // transferred working-copy bitmap is retained.
  return to.transferToImageBitmap();
}
