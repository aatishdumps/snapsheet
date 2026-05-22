/**
 * exportPdf.ts — the per-photo PDF export emitter (EXP-02 / EXP-03 / EXP-04 /
 * D-02, D-03, D-04, D-07, D-08).
 *
 * Builds a point-geometry PDF: the page MediaBox is sized in PostScript points
 * via `mmToPt`, and EACH photo is embedded per-photo at its exact computed
 * point rectangle — there is NEVER a whole-sheet raster (D-02), so the iOS
 * canvas cap is structurally unreachable on the PDF path. Photos are resolved
 * by `PlacedCell.groupId` through `resolvePhotos` — never by array index.
 * Optional cut marks are drawn as vector hairline strokes. Each photo is
 * rendered full-res with one bitmap alive at a time (D-01 / Pitfall 5).
 *
 * No DPI metadata patching for PDF — the point MediaBox carries true physical
 * size, so the file prints exactly at "Actual size / 100%" (D-05).
 *
 * NOTE: the per-photo canvas render (createImageBitmap + applyPipeline +
 * convertToBlob) is isolated in `renderPhotoJpeg.ts` — it is a Playwright
 * deferral for pixel verification. The pdf-lib structure (MediaBox, save/load
 * round-trip) IS Vitest-testable since pdf-lib is pure JS.
 *
 * SCOPE: PDF export orchestration — no React/Konva/ui (the
 * `no-restricted-imports` engine rule covers `src/export-engine/**`).
 * `@cantoo/pdf-lib` and `/templates` preset data are permitted imports. Named
 * exports only.
 */
import { PDFDocument, rgb } from '@cantoo/pdf-lib';
import type { PaperSpec, CellGroup, PlacedCell } from '../layout-engine/types';
import type { PhotoEntry } from '../state/types';
import { mmToPt } from '../print-engine/units';
import { resolvePhotos } from '../print-engine/resolvePhotos';
import { deriveCutMarks } from '../print-engine/cutMarks';
import { shelfPack } from '../layout-engine';
import { passportPresets } from '../templates/passportSpecs';
import { getBlob } from '../storage/repositories/assetRepo';
import { renderPhotoJpeg } from './renderPhotoJpeg';
import type { ExportRequest, ExportResult } from './types';

/** Cut-mark corner-tick length, mm (D-07/D-08). */
const TICK_LEN_MM = 3;
/** Cut-mark hairline stroke thickness, points (D-08 — vector hairline). */
const CUT_MARK_THICKNESS_PT = 0.25;

/** The resolved layout to emit — placed cells, groups, photos, paper. */
interface ResolvedLayout {
  paper: PaperSpec;
  placedCells: PlacedCell[];
  cellGroups: CellGroup[];
  photos: PhotoEntry[];
}

/**
 * Resolve the cells/photos/paper to emit for a request — sheet packs the
 * layout, single builds a one-cell layout at the active preset's mm size.
 * Returns a ready layout, or a typed `ExportResult` failure.
 */
function resolveLayout(
  req: ExportRequest,
): ResolvedLayout | { fail: ExportResult } {
  const { document, layout } = req.project;

  if (req.scope === 'single') {
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
    return {
      paper: { widthMm, heightMm },
      placedCells: [
        { groupId: 'single', xMm: 0, yMm: 0, widthMm, heightMm, rotated: false },
      ],
      cellGroups: [
        { id: 'single', photoId: photo.id, size: { widthMm, heightMm }, count: 1 },
      ],
      photos: [photo],
    };
  }

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
 * Render and export the document model to a point-geometry PDF, embedding each
 * photo per-photo at its exact physical rectangle (D-02).
 *
 * The PDF Y-axis origin is BOTTOM-left, so a cell at `yMm` from the paper TOP
 * is embedded at `y = pageHpt - mmToPt(yMm) - mmToPt(heightMm)` (Pitfall 2).
 *
 * @param req the export request — scope, single-photo id, cut marks, quality
 */
export async function exportPdf(
  req: ExportRequest,
): Promise<ExportResult> {
  const resolved = resolveLayout(req);
  if ('fail' in resolved) {
    return resolved.fail;
  }
  const { paper, placedCells, cellGroups, photos } = resolved;

  // Resolve photos by groupId — a broken placement->photo link is unrenderable.
  const r = resolvePhotos(placedCells, cellGroups, photos);
  if (!r.ok) {
    return { ok: false, reason: 'render-failed' };
  }

  const pdf = await PDFDocument.create();
  const pageWpt = mmToPt(paper.widthMm);
  const pageHpt = mmToPt(paper.heightMm);
  const page = pdf.addPage([pageWpt, pageHpt]);

  const quality = req.jpgQuality ?? 0.92;

  // Embed each placed cell's photo, one full-res bitmap alive at a time.
  for (const cell of placedCells) {
    const photo = r.byGroupId.get(cell.groupId);
    if (photo === undefined) {
      // Guarded by resolvePhotos above — defensive.
      return { ok: false, reason: 'render-failed' };
    }
    const record = await getBlob(photo.assetId);
    if (record === undefined) {
      // The photo's stored image data is gone from IndexedDB — surface the
      // distinct typed reason so the UI can prompt a re-import (WR-06).
      return { ok: false, reason: 'asset-missing' };
    }
    // renderPhotoJpeg decodes one full-res original, runs applyPipeline, and
    // calls bitmap.close() before it returns — one full-res bitmap alive at a
    // time across this loop (D-01 / Pitfall 5).
    const jpegBytes = await renderPhotoJpeg(
      record.blob,
      photo.pipeline,
      quality,
    );
    const img = await pdf.embedJpg(jpegBytes);
    // Y-flip: PDF origin is bottom-left (Pitfall 2).
    page.drawImage(img, {
      x: mmToPt(cell.xMm),
      y: pageHpt - mmToPt(cell.yMm) - mmToPt(cell.heightMm),
      width: mmToPt(cell.widthMm),
      height: mmToPt(cell.heightMm),
    });
  }

  // Optional vector cut marks — Y-flipped hairline strokes (D-07/D-08).
  if (req.cutMarks === true) {
    for (const tick of deriveCutMarks(placedCells, TICK_LEN_MM)) {
      page.drawLine({
        start: { x: mmToPt(tick.x1Mm), y: pageHpt - mmToPt(tick.y1Mm) },
        end: { x: mmToPt(tick.x2Mm), y: pageHpt - mmToPt(tick.y2Mm) },
        thickness: CUT_MARK_THICKNESS_PT,
        color: rgb(0, 0, 0),
      });
    }
  }

  // `pdf.save()` returns a standard ArrayBuffer-backed Uint8Array; the cast
  // narrows the TS 6 generic (`ArrayBufferLike`) to satisfy `BlobPart`.
  const out = (await pdf.save()) as Uint8Array<ArrayBuffer>;
  return {
    ok: true,
    blob: new Blob([out], { type: 'application/pdf' }),
    format: 'pdf',
  };
}
