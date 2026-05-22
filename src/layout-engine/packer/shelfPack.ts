/**
 * shelfPack.ts — NFDH shelf packer grouped by photo size
 *   (LAY-01 single repeated / LAY-02 multi-photo / LAY-03 mixed counts /
 *    D-09 / D-10).
 *
 * Next-Fit Decreasing Height, grouped by distinct photo size: all copies of
 * each distinct size are kept contiguous, the distinct sizes are sorted
 * tallest-first (D-09), then cells are laid left-to-right in horizontal
 * shelves — a new shelf opens whenever the current row fills. This handles
 * heterogeneous sizes and mixed copy counts deterministically.
 *
 * All coordinates are cumulative floating-point mm sums — never rounded
 * (D-10 / RESEARCH Pitfall 2). Shelf packing does not rotate cells; orientation
 * choice belongs to `autoFit`. px conversion is a Phase 5 boundary concern.
 *
 * SCOPE: pure mm packing math — no DOM, no React, no pixels. Honors the
 * `no-restricted-imports` engine rule. Named exports only.
 */
import type {
  PaperSpec,
  CellGroup,
  SpacingOpts,
  PlacedCell,
  LayoutResult,
} from '../types';

/**
 * Pack heterogeneous photo groups onto one paper sheet via NFDH grouped by
 * size (D-09).
 *
 * Bad input (non-finite/non-positive paper or cell dimensions, negative
 * margin/gap, negative or non-integer group count) is rejected with
 * `{ ok: false, errors }` (threat T-03-14 / T-03-16).
 *
 * Algorithm: expand each group into `count` cells (kept contiguous), sort the
 * distinct sizes tallest-first (height desc, width desc tie-break), then lay
 * cells in horizontal shelves. A cell that would overflow the current shelf
 * width closes the shelf and opens a new one. A cell that does not fit the
 * remaining vertical space is counted in `unplacedCount` and SKIPPED — packing
 * continues for the remaining (shorter, since sorted tallest-first) cells, so
 * the sheet is filled as fully as NFDH allows rather than abandoned on the
 * first overflow (WR-03). Every placed cell has `rotated: false` — shelf
 * packing never rotates (D-11 owns rotation).
 *
 * A single-size input degenerates naturally: one distinct size produces a
 * shelf layout identical to a plain grid, so no `packGrid` delegation is
 * needed — the shelf algorithm is the single packing path.
 */
export function shelfPack(
  paper: PaperSpec,
  groups: CellGroup[],
  opts: SpacingOpts,
): LayoutResult {
  const errors: string[] = [];

  for (const [name, v] of [
    ['paper width', paper.widthMm],
    ['paper height', paper.heightMm],
  ] as const) {
    if (!Number.isFinite(v)) errors.push(`${name} must be a number`);
    else if (v <= 0) errors.push(`${name} must be greater than 0`);
  }
  if (!Number.isFinite(opts.marginMm)) errors.push('margin must be a number');
  else if (opts.marginMm < 0) errors.push('margin must be >= 0');
  if (!Number.isFinite(opts.gapMm)) errors.push('gap must be a number');
  else if (opts.gapMm < 0) errors.push('gap must be >= 0');

  groups.forEach((g, i) => {
    if (!Number.isFinite(g.size.widthMm) || g.size.widthMm <= 0) {
      errors.push(`group ${i} (${g.id}) width must be a positive number`);
    }
    if (!Number.isFinite(g.size.heightMm) || g.size.heightMm <= 0) {
      errors.push(`group ${i} (${g.id}) height must be a positive number`);
    }
    if (!Number.isFinite(g.count)) {
      errors.push(`group ${i} (${g.id}) count must be a number`);
    } else if (g.count < 0) {
      errors.push(`group ${i} (${g.id}) count must be >= 0`);
    } else if (!Number.isInteger(g.count)) {
      errors.push(`group ${i} (${g.id}) count must be an integer`);
    }
  });

  if (errors.length) return { ok: false, errors };

  // Expand to a flat cell list, then sort tallest-first (height desc,
  // width desc tie-break). A stable sort keeps same-size cells contiguous.
  const cells: { groupId: string; widthMm: number; heightMm: number }[] = [];
  for (const g of groups) {
    for (let i = 0; i < g.count; i++) {
      cells.push({ groupId: g.id, widthMm: g.size.widthMm, heightMm: g.size.heightMm });
    }
  }
  cells.sort((a, b) =>
    b.heightMm !== a.heightMm ? b.heightMm - a.heightMm : b.widthMm - a.widthMm,
  );

  const usableRight = paper.widthMm - opts.marginMm;
  const usableBottom = paper.heightMm - opts.marginMm;

  const placedCells: PlacedCell[] = [];
  let x = opts.marginMm;
  let shelfY = opts.marginMm;
  let tallestInShelf = 0;
  let unplacedCount = 0;

  for (const cell of cells) {
    // Close the shelf if this cell would overflow the usable width.
    if (x + cell.widthMm > usableRight && x > opts.marginMm) {
      shelfY += tallestInShelf + opts.gapMm;
      x = opts.marginMm;
      tallestInShelf = 0;
    }

    // A cell wider than the whole usable width can never be placed, or it
    // overflows the remaining usable height. Count it unplaced and SKIP it —
    // do NOT abandon the rest: because cells are sorted tallest-first, a
    // later cell may be short enough to still fit (WR-03).
    if (
      x + cell.widthMm > usableRight ||
      shelfY + cell.heightMm > usableBottom
    ) {
      unplacedCount++;
      continue;
    }

    placedCells.push({
      groupId: cell.groupId,
      xMm: x,
      yMm: shelfY,
      widthMm: cell.widthMm,
      heightMm: cell.heightMm,
      rotated: false,
    });
    x += cell.widthMm + opts.gapMm;
    tallestInShelf = Math.max(tallestInShelf, cell.heightMm);
  }

  return { ok: true, placedCells, unplacedCount };
}
