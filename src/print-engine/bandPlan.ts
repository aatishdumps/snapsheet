/**
 * bandPlan.ts — horizontal band planning for the iOS single-canvas cap (D-02).
 *
 * `planBands` is a GUARD-ONLY safety net. A4 at 300 DPI = 2480×3508 = 8.7M px;
 * Letter = 2550×3300 = 8.4M px — both well under the 16M cap. Standard paper
 * NEVER trips the cap, so standard exports always plan a single band. This
 * module exists purely so an oversized CUSTOM paper at 300 DPI splits into
 * sub-cap horizontal bands instead of allocating one over-cap canvas.
 *
 * SCOPE: pure arithmetic — NO canvas, no DOM, no React/Konva/ui (the
 * `no-restricted-imports` engine rule covers `src/print-engine/**`). Named
 * exports only.
 */

/** iOS Safari single-canvas area cap, with headroom (D-02). */
export const MAX_CANVAS_PX = 16_000_000;

/**
 * True iff a `widthPx × heightPx` canvas would exceed {@link MAX_CANVAS_PX}.
 *
 * Fails SAFE: a non-finite dimension (`NaN`/`Infinity`) — which a corrupt
 * persisted project could produce — is treated as exceeding the cap rather
 * than passing it, because `NaN > MAX` is `false` and would otherwise let a
 * degenerate sheet through to canvas allocation (WR-04).
 */
export function exceedsCap(widthPx: number, heightPx: number): boolean {
  if (!Number.isFinite(widthPx) || !Number.isFinite(heightPx)) return true;
  return widthPx * heightPx > MAX_CANVAS_PX;
}

/** One horizontal band of the sheet — a sub-cap render strip. */
export interface Band {
  /** Top edge of the band, device px from the sheet origin. */
  yPx: number;
  /** Band height, device px. */
  heightPx: number;
}

/**
 * Plan horizontal bands tiling a `sheetWidthPx × sheetHeightPx` sheet so every
 * band's area is ≤ {@link MAX_CANVAS_PX} (D-02 guard).
 *
 * If the whole sheet is within the cap (the standard case) a single full-height
 * band is returned. Otherwise the band height is `floor(MAX_CANVAS_PX /
 * sheetWidthPx)`, and contiguous bands tile `0..sheetHeightPx` — the final
 * band's height is the remainder so the total covered height equals
 * `sheetHeightPx` exactly.
 */
export function planBands(
  sheetWidthPx: number,
  sheetHeightPx: number,
): Band[] {
  if (!exceedsCap(sheetWidthPx, sheetHeightPx)) {
    return [{ yPx: 0, heightPx: sheetHeightPx }];
  }

  const bandHeight = Math.floor(MAX_CANVAS_PX / sheetWidthPx);
  // If the sheet is so wide that even a single-px-tall row exceeds the cap,
  // `bandHeight` is 0 and the tiling loop below would never advance — an
  // infinite loop emitting zero-height bands forever (WR-03). Return one
  // over-cap band so the worker's `exceedsCap` guard rejects it cleanly and
  // steers the caller to the PDF path.
  if (bandHeight < 1) {
    return [{ yPx: 0, heightPx: sheetHeightPx }];
  }

  const bands: Band[] = [];
  let yPx = 0;
  while (yPx < sheetHeightPx) {
    const heightPx = Math.min(bandHeight, sheetHeightPx - yPx);
    bands.push({ yPx, heightPx });
    yPx += heightPx;
  }
  return bands;
}
