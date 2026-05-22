/**
 * composeSheet.ts — the print-sheet compositing orchestrator (D-01, D-02 / EXP-02).
 *
 * Turns the mm-first layout model into a rendered sheet blob: it builds the
 * px-space `RenderSpec` (via `buildRenderSpec` — the sole conversion path),
 * pre-resolves every photo by groupId via `resolvePhotos` (fail-fast on a
 * broken placement -> photo link), and delegates the actual raster compositing
 * to `render.worker.ts` through `renderBridge`. The worker owns the 300 DPI
 * OffscreenCanvas work and the `planBands` cap handling (D-02).
 *
 * SCOPE: orchestration only — holds NO pixel math, no canvas, no React/Konva/ui
 * (the `no-restricted-imports` engine rule covers `src/print-engine/**`). Named
 * exports only.
 */
import type { PaperSpec, CellGroup, PlacedCell } from '../layout-engine/types';
import type { PhotoEntry } from '../state/types';
import { buildRenderSpec } from './renderSpec';
import { resolvePhotos } from './resolvePhotos';
import { renderSheet } from '../workers/renderBridge';
import { DEFAULT_DPI } from './dpi';

/** Inputs for one sheet-compositing request. */
export interface ComposeInput {
  /** Sheet dimensions, mm. */
  paper: PaperSpec;
  /** The packer's placed cells — one per `CellGroup.count` copy. */
  placedCells: PlacedCell[];
  /** The layout's cell groups — the `groupId -> photoId` link source. */
  cellGroups: CellGroup[];
  /** The document's photos — resolved BY groupId, NEVER by array index. */
  photos: PhotoEntry[];
  /** Whether to render corner-tick crop marks on the sheet (D-07). */
  cutMarks: boolean;
}

/**
 * Result of compositing a sheet — a discriminated union narrowed on `ok`.
 * Success carries the rendered sheet blob; failure is a typed reason.
 */
export type ComposeResult =
  | { ok: true; blob: Blob }
  | { ok: false; reason: 'empty-layout' | 'render-failed' | 'asset-missing' };

/**
 * Compose a print sheet: build the `RenderSpec`, resolve photos by groupId, and
 * delegate the raster work to the render worker.
 *
 * Fail-fast: an empty layout returns `empty-layout`; a broken placement->photo
 * link is unrenderable and returns `render-failed` WITHOUT touching the worker.
 * The worker owns the cap check + banding, so `composeSheet` does not pre-check
 * the canvas cap.
 *
 * @param input the sheet to compose — paper, placement, photos, cut-marks flag
 */
export async function composeSheet(
  input: ComposeInput,
): Promise<ComposeResult> {
  const { paper, placedCells, cellGroups, photos, cutMarks } = input;

  // 1. An empty layout has nothing to composite.
  if (placedCells.length === 0) {
    return { ok: false, reason: 'empty-layout' };
  }

  // 1b. Validate paper dimensions are finite and positive. A corrupt persisted
  //     project (negative / NaN mm) would otherwise flow straight through
  //     `buildRenderSpec` -> `mmToPx` into a degenerate or NaN-sized worker
  //     canvas (WR-04). Reject at this boundary as render-failed.
  if (
    !Number.isFinite(paper.widthMm) ||
    !Number.isFinite(paper.heightMm) ||
    paper.widthMm <= 0 ||
    paper.heightMm <= 0
  ) {
    return { ok: false, reason: 'render-failed' };
  }

  // 2. Pre-resolve photos by groupId — a broken group/photo link is
  //    unrenderable; surface it as render-failed and never call the worker.
  const resolved = resolvePhotos(placedCells, cellGroups, photos);
  if (!resolved.ok) {
    return { ok: false, reason: 'render-failed' };
  }

  // 3. Build the px-space spec — the sole mm->px conversion path (300 DPI).
  const spec = buildRenderSpec(paper, placedCells, DEFAULT_DPI);

  // 4. Delegate raster compositing to the worker (it owns planBands + cap).
  const res = await renderSheet(spec, cellGroups, photos, cutMarks);

  // 5. Map the worker RenderResponse to a typed ComposeResult.
  if (res.ok) {
    return { ok: true, blob: res.blob };
  }
  if (res.reason === 'asset-missing') {
    return { ok: false, reason: 'asset-missing' };
  }
  // render-error / canvas-cap-exceeded / group-missing / photo-missing all map
  // to render-failed (the group/photo cases are already guarded in step 2).
  return { ok: false, reason: 'render-failed' };
}
