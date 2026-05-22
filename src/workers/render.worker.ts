/**
 * render.worker.ts — OffscreenCanvas 300 DPI per-photo + banded compositor
 * (D-01, D-02 / EXP-02).
 *
 * Rasterizes a print sheet entirely off the main thread. D-01: compositing runs
 * on an `OffscreenCanvas` in this worker; the full-resolution original is
 * re-read per photo and `applyPipeline` re-run at full res, one bitmap alive at
 * a time. D-02: rendered at EXACTLY 300 DPI — the `RenderSpec` px values already
 * come from `mmToPx(mm, 300)`; the screen-only DPR multiplier is never applied.
 * Oversized custom sheets are composited band-by-band via `planBands`; standard
 * A4/Letter take the single-band fast path.
 *
 * SCOPE: transport + stage sequencing only — raster compositing here, no
 * React/Konva/ui (the `no-restricted-imports` engine rule covers
 * `src/workers/**`). Named exports only (this worker has none — it is an entry
 * point driven by the message handler).
 */
import { resolvePhotos } from '../print-engine/resolvePhotos';
import { planBands, exceedsCap } from '../print-engine/bandPlan';
import { mmToPx } from '../print-engine/units';
import { getBlob } from '../storage/repositories/assetRepo';
import { applyPipeline } from '../editor/pipeline/applyPipeline';
import type { RenderRequest, RenderResponse } from './renderProtocol';
import type { PhotoRect } from '../print-engine/renderSpec';
import type { PhotoEntry } from '../state/types';

/**
 * The dedicated-worker global scope, narrowed to just what this worker uses.
 * The project's tsconfig `lib` has no `WebWorker` lib (so
 * `DedicatedWorkerGlobalScope` is not declared globally); this local type lets
 * the thin transport layer stay typed without pulling the whole `WebWorker`
 * lib in and clashing with `DOM`'s `self`/`postMessage` declarations.
 */
interface WorkerScope {
  postMessage(message: RenderResponse): void;
  onmessage:
    | ((e: MessageEvent<RenderRequest>) => void | Promise<void>)
    | null;
}

/** This module runs as a dedicated worker — `self` IS the worker scope. */
const ctx = self as unknown as WorkerScope;

/** Post a typed response back to the main thread. */
function reply(msg: RenderResponse): void {
  ctx.postMessage(msg);
}

/** Crop-mark tick length, mm (matches the cutMarks geometry default). */
const TICK_LEN_MM = 3;
/** Crop-mark hairline stroke width, mm. */
const HAIRLINE_MM = 0.2;

/**
 * Decode one original Blob, run `applyPipeline` at full res, and draw it into
 * the target rect. The intermediate `ImageBitmap` is closed before returning so
 * never more than one full-res bitmap is alive (Pitfall 5 / D-01).
 */
async function drawPhoto(
  c2d: OffscreenCanvasRenderingContext2D,
  rect: PhotoRect,
  photo: PhotoEntry,
  yOffsetPx: number,
): Promise<boolean> {
  const asset = await getBlob(photo.assetId);
  if (asset === undefined) return false;

  const bitmap = await createImageBitmap(asset.blob);
  try {
    // Decode to ImageData via a scratch canvas so applyPipeline can run.
    const scratch = new OffscreenCanvas(bitmap.width, bitmap.height);
    const sctx = scratch.getContext('2d');
    if (sctx === null) return false;
    sctx.drawImage(bitmap, 0, 0);
    const srcData = sctx.getImageData(0, 0, bitmap.width, bitmap.height);

    // Re-run the full non-destructive pipeline at full resolution (D-01).
    const outData = applyPipeline(srcData, photo.pipeline);

    // Stage the pipeline output on a canvas, then draw scaled into the rect.
    const staged = new OffscreenCanvas(outData.width, outData.height);
    const tctx = staged.getContext('2d');
    if (tctx === null) return false;
    tctx.putImageData(outData, 0, 0);
    c2d.drawImage(
      staged,
      rect.xPx,
      rect.yPx - yOffsetPx,
      rect.widthPx,
      rect.heightPx,
    );
  } finally {
    // Release the full-res bitmap before the next photo (Pitfall 5 / D-01).
    bitmap.close();
  }
  return true;
}

/**
 * Rasterize corner-tick crop marks directly from the px `PhotoRect`s onto the
 * target context (D-07/D-08). Eight outward ticks per rect; `yOffsetPx`
 * translates rects into band-relative space for the banded path.
 */
function drawCutMarks(
  c2d: OffscreenCanvasRenderingContext2D,
  rects: PhotoRect[],
  yOffsetPx: number,
): void {
  const tick = mmToPx(TICK_LEN_MM);
  c2d.save();
  c2d.strokeStyle = '#000000';
  c2d.lineWidth = Math.max(1, Math.round(mmToPx(HAIRLINE_MM)));
  for (const r of rects) {
    const left = r.xPx;
    const right = r.xPx + r.widthPx;
    const top = r.yPx - yOffsetPx;
    const bottom = r.yPx + r.heightPx - yOffsetPx;
    const segs: [number, number, number, number][] = [
      // Top-left — up and left.
      [left, top - tick, left, top],
      [left - tick, top, left, top],
      // Top-right — up and right.
      [right, top - tick, right, top],
      [right, top, right + tick, top],
      // Bottom-left — down and left.
      [left, bottom, left, bottom + tick],
      [left - tick, bottom, left, bottom],
      // Bottom-right — down and right.
      [right, bottom, right, bottom + tick],
      [right, bottom, right + tick, bottom],
    ];
    for (const [x1, y1, x2, y2] of segs) {
      c2d.beginPath();
      c2d.moveTo(x1, y1);
      c2d.lineTo(x2, y2);
      c2d.stroke();
    }
  }
  c2d.restore();
}

ctx.onmessage = async (
  e: MessageEvent<RenderRequest>,
): Promise<void> => {
  // The ENTIRE handler body is wrapped in one try/catch: this is an async
  // message handler, so any rejection escaping here becomes an unhandled
  // promise rejection that never fires the worker's `error` event and never
  // resolves the bridge promise — hanging the caller (CR-01).
  const { id, spec, cellGroups, photos, cutMarks } = e.data;

  try {
    // 1. RESOLVE PHOTOS — resolvePhotos only needs distinct groupIds; shape a
    //    minimal PlacedCell-like array from spec.photoRects. Photos are always
    //    resolved by groupId, never by array index.
    const placedLike = spec.photoRects.map((r) => ({
      groupId: r.groupId,
      xMm: 0,
      yMm: 0,
      widthMm: 0,
      heightMm: 0,
      rotated: false,
    }));
    const resolved = resolvePhotos(placedLike, cellGroups, photos);
    if (!resolved.ok) {
      reply({ id, ok: false, reason: resolved.reason });
      return;
    }
    const byGroupId = resolved.byGroupId;

    // 2. DEGENERATE-SHEET GUARD — `exceedsCap` covers the upper bound (area)
    //    but not a degenerate LOWER bound. A sub-0.5mm custom paper rounds to
    //    `sheetWidthPx === 0` via `mmToPx`, and a 0-size OffscreenCanvas plus
    //    `fillRect` silently yields an empty blob instead of a typed failure
    //    (WR-02). Reject any non-positive / non-integer-finite dimension.
    if (
      !Number.isFinite(spec.sheetWidthPx) ||
      !Number.isFinite(spec.sheetHeightPx) ||
      spec.sheetWidthPx < 1 ||
      spec.sheetHeightPx < 1
    ) {
      reply({ id, ok: false, reason: 'render-error' });
      return;
    }

    // 3. BAND PLANNING — planBands tiles oversized sheets into sub-cap bands.
    const bands = planBands(spec.sheetWidthPx, spec.sheetHeightPx);
    // An irreducible sheet — even one band still exceeds the cap (a sheet so
    // wide a single px-tall row is over-cap) — steers to PDF.
    for (const band of bands) {
      if (exceedsCap(spec.sheetWidthPx, band.heightPx)) {
        reply({ id, ok: false, reason: 'canvas-cap-exceeded' });
        return;
      }
    }
    // The assembled sheet canvas must itself be ≤ cap.
    if (exceedsCap(spec.sheetWidthPx, spec.sheetHeightPx)) {
      reply({ id, ok: false, reason: 'canvas-cap-exceeded' });
      return;
    }

    const singleBand =
      bands.length === 1 &&
      bands[0] !== undefined &&
      bands[0].yPx === 0 &&
      bands[0].heightPx === spec.sheetHeightPx;

    if (singleBand) {
      // FAST PATH — one OffscreenCanvas for the whole sheet (A4/Letter case).
      const canvas = new OffscreenCanvas(
        spec.sheetWidthPx,
        spec.sheetHeightPx,
      );
      const c2d = canvas.getContext('2d');
      if (c2d === null) {
        reply({ id, ok: false, reason: 'render-error' });
        return;
      }
      c2d.fillStyle = '#ffffff';
      c2d.fillRect(0, 0, spec.sheetWidthPx, spec.sheetHeightPx);
      for (const rect of spec.photoRects) {
        const photo = byGroupId.get(rect.groupId);
        if (photo === undefined) {
          reply({ id, ok: false, reason: 'group-missing' });
          return;
        }
        const ok = await drawPhoto(c2d, rect, photo, 0);
        if (!ok) {
          reply({ id, ok: false, reason: 'asset-missing' });
          return;
        }
      }
      if (cutMarks) drawCutMarks(c2d, spec.photoRects, 0);
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      reply({ id, ok: true, blob });
      return;
    }

    // MULTI-BAND PATH — composite each band, assemble into the full sheet.
    const sheet = new OffscreenCanvas(
      spec.sheetWidthPx,
      spec.sheetHeightPx,
    );
    const sheetCtx = sheet.getContext('2d');
    if (sheetCtx === null) {
      reply({ id, ok: false, reason: 'render-error' });
      return;
    }
    for (const band of bands) {
      const bandTop = band.yPx;
      const bandBottom = band.yPx + band.heightPx;
      const bandCanvas = new OffscreenCanvas(
        spec.sheetWidthPx,
        band.heightPx,
      );
      const bandCtx = bandCanvas.getContext('2d');
      if (bandCtx === null) {
        reply({ id, ok: false, reason: 'render-error' });
        return;
      }
      bandCtx.fillStyle = '#ffffff';
      bandCtx.fillRect(0, 0, spec.sheetWidthPx, band.heightPx);
      // Draw only the rects intersecting this band's [yPx, yPx+heightPx) range.
      const inBand = spec.photoRects.filter(
        (r) => r.yPx < bandBottom && r.yPx + r.heightPx > bandTop,
      );
      for (const rect of inBand) {
        const photo = byGroupId.get(rect.groupId);
        if (photo === undefined) {
          reply({ id, ok: false, reason: 'group-missing' });
          return;
        }
        const ok = await drawPhoto(bandCtx, rect, photo, bandTop);
        if (!ok) {
          reply({ id, ok: false, reason: 'asset-missing' });
          return;
        }
      }
      if (cutMarks) drawCutMarks(bandCtx, inBand, bandTop);
      sheetCtx.drawImage(bandCanvas, 0, band.yPx);
    }
    const blob = await sheet.convertToBlob({ type: 'image/png' });
    reply({ id, ok: true, blob });
  } catch {
    // Any throw mid-composite — decode failure, allocation failure, etc.
    reply({ id, ok: false, reason: 'render-error' });
  }
};
