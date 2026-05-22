/**
 * renderSpec.ts — the mm->px render plan for a print sheet (EXP-02 / D-02).
 *
 * Turns the mm-first layout model (a `PaperSpec` plus the packer's
 * `PlacedCell[]`) into a pixel-space `RenderSpec`: the sheet's raster size and
 * one `PhotoRect` per placed cell. Every pixel value is produced by
 * `units.mmToPx` — the sole conversion source — at exactly 300 DPI (D-02; DPR
 * is never multiplied in). The render worker and exporters consume this spec.
 *
 * SCOPE: pure types + pure math. It MUST NOT import React/Konva/ui (the
 * `no-restricted-imports` engine rule covers `src/print-engine/**`). Named
 * exports only.
 */

import type { PaperSpec, PlacedCell } from '../layout-engine/types';
import { mmToPx } from './units';
import { DEFAULT_DPI } from './dpi';

/**
 * One photo's pixel-space rectangle on the rendered sheet — the px-space
 * counterpart of a layout `PlacedCell`.
 */
export interface PhotoRect {
  /**
   * The `PlacedCell.groupId` this rect renders. The owning `PhotoEntry` is
   * resolved by groupId via `resolvePhotos` — NEVER by array index (a group
   * repeats one photo `count` times, so there is no rect-to-photos[] alignment).
   */
  groupId: string;
  /** Left edge in device px at the render DPI — `mmToPx(PlacedCell.xMm)`. */
  xPx: number;
  /** Top edge in device px — `mmToPx(PlacedCell.yMm)`. */
  yPx: number;
  /** Width in device px — `mmToPx(PlacedCell.widthMm)`. */
  widthPx: number;
  /** Height in device px — `mmToPx(PlacedCell.heightMm)`. */
  heightPx: number;
}

/** The full pixel-space plan for rasterizing one print sheet. */
export interface RenderSpec {
  /** Sheet raster width in px — `mmToPx(paper.widthMm)`. */
  sheetWidthPx: number;
  /** Sheet raster height in px — `mmToPx(paper.heightMm)`. */
  sheetHeightPx: number;
  /** One rect per placed cell, in the input `placedCells` array order. */
  photoRects: PhotoRect[];
}

/**
 * Build the pixel-space `RenderSpec` for a sheet. Every px value is derived via
 * `mmToPx` (no inline `mm/25.4*dpi`); `placedCells` order and `groupId` are
 * preserved 1:1 onto `photoRects`.
 *
 * @param paper       sheet dimensions, mm
 * @param placedCells the packer's placed cells, mm rects
 * @param dpi         render DPI; defaults to {@link DEFAULT_DPI} (300)
 */
export function buildRenderSpec(
  paper: PaperSpec,
  placedCells: PlacedCell[],
  dpi: number = DEFAULT_DPI,
): RenderSpec {
  return {
    sheetWidthPx: mmToPx(paper.widthMm, dpi),
    sheetHeightPx: mmToPx(paper.heightMm, dpi),
    photoRects: placedCells.map((cell) => ({
      groupId: cell.groupId,
      xPx: mmToPx(cell.xMm, dpi),
      yPx: mmToPx(cell.yMm, dpi),
      widthPx: mmToPx(cell.widthMm, dpi),
      heightPx: mmToPx(cell.heightMm, dpi),
    })),
  };
}
