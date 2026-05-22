/**
 * orientation.ts — paper orientation helpers for the Layout view.
 *
 * A paper sheet is just a `{ widthMm, heightMm }` pair; orientation is derived
 * from which side is longer rather than stored separately. These pure helpers
 * read/flip that orientation and probe how many photo cells a sheet can hold,
 * so the Layout view can suggest the orientation that fits the most photos.
 *
 * SCOPE: pure mm math — no DOM, no React. Named exports only.
 */
import { shelfPack } from '../../layout-engine';
import type { CellGroup, PaperSpec, SpacingOpts } from '../../layout-engine/types';

/** Portrait (taller than wide) or landscape (wider than tall). */
export type Orientation = 'portrait' | 'landscape';

/** The orientation a sheet is currently in. Square paper reads as portrait. */
export function getOrientation(paper: PaperSpec): Orientation {
  return paper.widthMm > paper.heightMm ? 'landscape' : 'portrait';
}

/** The opposite orientation. */
export function flipOrientation(orientation: Orientation): Orientation {
  return orientation === 'portrait' ? 'landscape' : 'portrait';
}

/**
 * Return `paper` in the requested orientation — swapping its sides only when
 * it is not already there, so the dimensions are otherwise untouched.
 */
export function withOrientation(
  paper: PaperSpec,
  orientation: Orientation,
): PaperSpec {
  if (getOrientation(paper) === orientation) return paper;
  return { widthMm: paper.heightMm, heightMm: paper.widthMm };
}

/**
 * How many photo cells fit on `paper` if every group were packed to capacity.
 *
 * Each group's count is inflated to an area-derived upper bound and the real
 * `shelfPack` engine packs the result — the placed total is the sheet's true
 * capacity for the current photo sizes and spacing, independent of how many
 * copies the user actually requested.
 */
export function sheetCapacity(
  paper: PaperSpec,
  cellGroups: CellGroup[],
  spacing: SpacingOpts,
): number {
  if (cellGroups.length === 0) return 0;
  const minW = Math.min(...cellGroups.map((g) => g.size.widthMm));
  const minH = Math.min(...cellGroups.map((g) => g.size.heightMm));
  if (!(minW > 0) || !(minH > 0)) return 0;
  // Area-based upper bound on how many cells could ever fit — packing always
  // places fewer, so this never under-probes capacity.
  const probe = Math.ceil((paper.widthMm * paper.heightMm) / (minW * minH)) + 1;
  const inflated = cellGroups.map((g) => ({ ...g, count: probe }));
  const result = shelfPack(paper, inflated, spacing);
  return result.ok ? result.placedCells.length : 0;
}

/** A recommendation to rotate the sheet for a higher photo capacity. */
export interface OrientationSuggestion {
  /** The orientation that fits more photos. */
  orientation: Orientation;
  /** Capacity in the current orientation. */
  currentCapacity: number;
  /** Capacity in the suggested orientation (strictly greater). */
  suggestedCapacity: number;
}

/**
 * Suggest the other orientation when rotating the sheet fits strictly more
 * photos. Returns `null` when the current orientation is already best (or
 * there is nothing to lay out).
 */
export function suggestOrientation(
  paper: PaperSpec,
  cellGroups: CellGroup[],
  spacing: SpacingOpts,
): OrientationSuggestion | null {
  const other = flipOrientation(getOrientation(paper));
  const currentCapacity = sheetCapacity(paper, cellGroups, spacing);
  const suggestedCapacity = sheetCapacity(
    withOrientation(paper, other),
    cellGroups,
    spacing,
  );
  if (suggestedCapacity > currentCapacity) {
    return { orientation: other, currentCapacity, suggestedCapacity };
  }
  return null;
}
