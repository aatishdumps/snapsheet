/**
 * exportImage.ts — the PNG/JPG export emitter (EXP-02 / EXP-03 /
 * D-03, D-04, D-05, D-06).
 *
 * Orchestrates the raster export path: it resolves the cells to render (the
 * whole packed sheet, or a one-cell layout for a single photo at its active
 * preset's mm size), delegates the actual 300 DPI compositing to
 * `composeSheet` (which owns the OffscreenCanvas / banding work), then patches
 * print-DPI metadata into the finished bytes — a `pHYs` chunk for PNG, a JFIF
 * APP0 density patch for JPG. The JPG path additionally re-encodes via canvas
 * and runs a defensive `stripExif` so a passport file never leaks GPS (D-06).
 *
 * Canvas output is sRGB by default — exports are implicitly sRGB-tagged (D-06).
 *
 * NOTE: `import { passportPresets } from '../templates/passportSpecs'` —
 * `/templates` is plain preset DATA (not UI, not an engine glob), so this
 * import is allowed from `/export-engine`.
 *
 * SCOPE: orchestration only — holds NO pixel math, no React/Konva/ui (the
 * `no-restricted-imports` engine rule covers `src/export-engine/**`). Named
 * exports only.
 */
import type { PaperSpec, CellGroup, PlacedCell } from '../layout-engine/types';
import type { PhotoEntry } from '../state/types';
import { composeSheet } from '../print-engine/composeSheet';
import { shelfPack } from '../layout-engine';
import { passportPresets } from '../templates/passportSpecs';
import { patchPngDpi, patchJpegDpi } from './dpi-metadata';
import { stripExif } from './stripExif';
import { reencodeToJpeg } from './reencodeJpeg';
import type { ExportRequest, ExportResult } from './types';

/** The print render DPI for all raster exports (D-02 — fixed 300, never ×DPR). */
const EXPORT_DPI = 300;

/** The resolved compositing inputs — what `composeSheet` is handed. */
interface ResolvedCompose {
  paper: PaperSpec;
  placedCells: PlacedCell[];
  cellGroups: CellGroup[];
  photos: PhotoEntry[];
}

/**
 * Resolve the cells/photos/paper to composite for a request. Returns either a
 * ready compose input, or a typed `ExportResult` failure to short-circuit on.
 */
function resolveCompose(
  req: ExportRequest,
): ResolvedCompose | { fail: ExportResult } {
  const { document, layout } = req.project;

  if (req.scope === 'single') {
    // Single-photo export — render exactly one photo at its preset mm size.
    const photo = document.photos.find((p) => p.id === req.singlePhotoId);
    if (photo === undefined) {
      return { fail: { ok: false, reason: 'photo-not-found' } };
    }
    // The document model is single-preset by design: `PhotoEntry` carries NO
    // per-photo preset id, and `DocumentData.activePresetId` is the one
    // authoritative preset for every photo (WR-08). Sizing a single-photo
    // export from `activePresetId` is therefore correct. If a per-photo
    // preset is ever introduced, this MUST switch to the photo's own id.
    const preset = passportPresets.find(
      (p) => p.id === document.activePresetId,
    );
    if (preset === undefined) {
      return { fail: { ok: false, reason: 'render-failed' } };
    }
    const { widthMm, heightMm } = preset.outer;
    const cellGroup: CellGroup = {
      id: 'single',
      photoId: photo.id,
      size: { widthMm, heightMm },
      count: 1,
    };
    const placedCell: PlacedCell = {
      groupId: 'single',
      xMm: 0,
      yMm: 0,
      widthMm,
      heightMm,
      rotated: false,
    };
    // The page for a single-photo export is the photo's own mm size.
    return {
      paper: { widthMm, heightMm },
      placedCells: [placedCell],
      cellGroups: [cellGroup],
      photos: [photo],
    };
  }

  // Sheet export — pack the layout's cell groups onto the paper.
  const packed = shelfPack(layout.paper, layout.cellGroups, layout.spacing);
  if (!packed.ok || packed.placedCells.length === 0) {
    return { fail: { ok: false, reason: 'empty-layout' } };
  }
  return {
    paper: layout.paper,
    placedCells: packed.placedCells,
    cellGroups: layout.cellGroups,
    photos: document.photos,
  };
}

/**
 * Render and export the document model to a PNG or JPG blob carrying correct
 * 300 DPI metadata.
 *
 * The composed raster comes from `composeSheet` as `image/png`. PNG export
 * patches a `pHYs` chunk straight onto those bytes. JPG export re-encodes the
 * PNG to JPEG via an `OffscreenCanvas` (composeSheet standardizes on a single
 * lossless `image/png` worker output — one code path, no mime threading
 * through the worker protocol), then runs `stripExif` and `patchJpegDpi`. The
 * one-time PNG->JPEG double-encode of a finished 300-DPI print raster at
 * q≥0.92 is a deliberate, accepted tradeoff — visually lossless for print.
 *
 * @param req the export request — format, scope, single-photo id, cut marks
 */
export async function exportImage(
  req: ExportRequest,
): Promise<ExportResult> {
  const resolved = resolveCompose(req);
  if ('fail' in resolved) {
    return resolved.fail;
  }

  // composeSheet runs resolvePhotos internally — exportImage forwards
  // cellGroups + photos and does NOT index-align them.
  const res = await composeSheet({
    paper: resolved.paper,
    placedCells: resolved.placedCells,
    cellGroups: resolved.cellGroups,
    photos: resolved.photos,
    cutMarks: req.cutMarks ?? false,
  });

  if (!res.ok) {
    // Forward the distinct typed reasons so the UI can react precisely:
    // empty-layout and asset-missing pass through unchanged (asset-missing
    // lets the UI prompt a re-import — WR-06); everything else is a generic
    // render-failed. (composeSheet no longer surfaces canvas-cap-exceeded
    // directly — the worker maps an irreducible oversized sheet to
    // render-failed.)
    if (res.reason === 'empty-layout') {
      return { ok: false, reason: 'empty-layout' };
    }
    if (res.reason === 'asset-missing') {
      return { ok: false, reason: 'asset-missing' };
    }
    return { ok: false, reason: 'render-failed' };
  }

  // composeSheet emits image/png.
  const pngBytes = await res.blob.arrayBuffer();

  if (req.format === 'png') {
    const patched = patchPngDpi(pngBytes, EXPORT_DPI);
    return {
      ok: true,
      blob: new Blob([patched], { type: 'image/png' }),
      format: 'png',
    };
  }

  // JPEG path — re-encode the composed PNG to JPEG via canvas, then strip EXIF
  // and patch the JFIF APP0 density. patchJpegDpi handles the APP0-insert case
  // because a canvas-emitted JPEG may carry no APP0 (RESEARCH A1).
  const jpegBytes = await reencodeToJpeg(res.blob, req.jpgQuality ?? 0.92);
  const stripped = stripExif(jpegBytes);
  const patched = patchJpegDpi(stripped, EXPORT_DPI);
  return {
    ok: true,
    blob: new Blob([patched], { type: 'image/jpeg' }),
    format: 'jpeg',
  };
}
