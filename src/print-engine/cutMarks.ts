/**
 * cutMarks.ts — derive corner-tick cut-mark geometry from placed cells
 * (EXP-04 / D-07 / D-08).
 *
 * Phase 3's layout engine emits NO cut-mark geometry — `LayoutResult` carries
 * only `placedCells`. This module derives, per cell, eight short tick segments
 * (two at each of the four corners) drawn OUTWARD into the margin/gutter so
 * marks never overlap photo content (D-07). The renderer turns these into
 * vector hairlines in PDF and rasterized lines in PNG/JPG (D-08).
 *
 * SCOPE: pure mm geometry — NO px/pt conversion happens here; that occurs at
 * the rendering boundary in composeSheet/exportPdf via `print-engine/units`.
 * No canvas, no DOM, no React/Konva/ui (the `no-restricted-imports` engine
 * rule covers `src/print-engine/**`). Named exports only.
 */

import type { PlacedCell } from '../layout-engine/types';

/** A single straight cut-mark tick segment, endpoints in mm. */
export interface CutTick {
  /** First endpoint X, mm from paper origin. */
  x1Mm: number;
  /** First endpoint Y, mm from paper origin. */
  y1Mm: number;
  /** Second endpoint X, mm from paper origin. */
  x2Mm: number;
  /** Second endpoint Y, mm from paper origin. */
  y2Mm: number;
}

/**
 * Derive corner-tick cut marks for every placed cell (D-07/D-08).
 *
 * For each cell emits eight ticks — at each of the four corners one tick along
 * X and one along Y, both pointing OUTWARD from the cell so they sit in the
 * margin/gutter. `tickLenMm` is the length of each tick (≈3mm). Returns `[]`
 * for an empty cell list.
 */
export function deriveCutMarks(
  cells: PlacedCell[],
  tickLenMm: number,
): CutTick[] {
  const ticks: CutTick[] = [];
  for (const c of cells) {
    const left = c.xMm;
    const right = c.xMm + c.widthMm;
    const top = c.yMm;
    const bottom = c.yMm + c.heightMm;
    const t = tickLenMm;

    // Top-left corner — ticks point up and left.
    ticks.push({ x1Mm: left, y1Mm: top - t, x2Mm: left, y2Mm: top });
    ticks.push({ x1Mm: left - t, y1Mm: top, x2Mm: left, y2Mm: top });

    // Top-right corner — ticks point up and right.
    ticks.push({ x1Mm: right, y1Mm: top - t, x2Mm: right, y2Mm: top });
    ticks.push({ x1Mm: right, y1Mm: top, x2Mm: right + t, y2Mm: top });

    // Bottom-left corner — ticks point down and left.
    ticks.push({ x1Mm: left, y1Mm: bottom, x2Mm: left, y2Mm: bottom + t });
    ticks.push({ x1Mm: left - t, y1Mm: bottom, x2Mm: left, y2Mm: bottom });

    // Bottom-right corner — ticks point down and right.
    ticks.push({ x1Mm: right, y1Mm: bottom, x2Mm: right, y2Mm: bottom + t });
    ticks.push({ x1Mm: right, y1Mm: bottom, x2Mm: right + t, y2Mm: bottom });
  }
  return ticks;
}
