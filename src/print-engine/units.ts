/**
 * units.ts — the single source of dimensional-conversion truth.
 *
 * The document model is millimetre-first. Inches and points convert through mm;
 * pixels are derived only at the export boundary via DPI.
 *
 * Pitfall 2: this is the ONLY module where `px = round(mm/25.4*dpi)` lives.
 * No other module may write inline conversion math — import these functions.
 */

import { MM_PER_INCH, POINTS_PER_INCH, DEFAULT_DPI } from './dpi';

/**
 * mm -> device pixels at a given DPI. Rounds to a whole pixel (D-06).
 * @param mm  millimetre value
 * @param dpi target DPI; defaults to {@link DEFAULT_DPI} (300)
 */
export function mmToPx(mm: number, dpi: number = DEFAULT_DPI): number {
  return Math.round((mm / MM_PER_INCH) * dpi);
}

/** inches -> mm. */
export function inchToMm(inch: number): number {
  return inch * MM_PER_INCH;
}

/** mm -> PDF/PostScript points (1pt = 1/72in). */
export function mmToPt(mm: number): number {
  return (mm / MM_PER_INCH) * POINTS_PER_INCH;
}
