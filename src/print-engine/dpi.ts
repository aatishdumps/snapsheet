/**
 * DPI and dimensional-conversion constants.
 *
 * This file is the ONLY place the magic conversion constants live.
 * `units.ts` imports them; nothing else re-derives `25.4` or `72`.
 */

/** Internal render DPI (EXP-01). Exports and exact-dimension math default to this. */
export const DEFAULT_DPI = 300;

/** Millimetres per inch — exact, by definition. */
export const MM_PER_INCH = 25.4;

/** PostScript / PDF points per inch — exact, by definition (1pt = 1/72in). */
export const POINTS_PER_INCH = 72;
