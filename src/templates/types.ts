/**
 * Template data types — passport/visa/ID presets and paper sizes.
 *
 * All geometry is millimetre-first (D-03/D-06). Records are flat and
 * self-describing so the preset list is a single searchable array (D-02).
 */

/** A min/max constraint band, in millimetres. */
export interface MmBand {
  min: number;
  max: number;
}

/**
 * A passport/visa/ID photo preset with full sourced geometry (D-03).
 *
 * `headHeightMm`, `eyeLineFromBottomMm`, and `topClearanceMm` are optional:
 * generic presets carry no compliance geometry, and some national specs
 * (e.g. China) publish a top-clearance rule instead of an eye-line band.
 */
export interface PassportPreset {
  /** Stable key, e.g. `"us-passport"`. */
  id: string;
  /** Searchable label, e.g. `"USA Passport (2x2 in)"`. */
  displayName: string;
  /** ISO 3166-1 alpha-2 country code, e.g. `"US"`. `"XX"` for generics. */
  countryCode: string;
  /** Outer photo dimensions in mm. */
  outer: { widthMm: number; heightMm: number };
  /** Head height (chin to crown) constraint band, mm. Omitted for generics. */
  headHeightMm?: MmBand;
  /** Eye level distance from the BOTTOM edge, mm. Omitted where the source publishes none. */
  eyeLineFromBottomMm?: MmBand;
  /** Minimum clearance above the head, mm. Used by specs that constrain this instead of eye-line. */
  topClearanceMm?: number;
  /** D-04 citation — primary government / standards source URL. */
  sourceUrl: string;
  /** D-04 ISO date (yyyy-mm-dd) the source was checked. */
  sourceDate: string;
}

/**
 * A print paper size. `dimensionsMm` is undefined for the `custom` entry,
 * whose dimensions are supplied and validated at the UI edge.
 */
export interface PaperSize {
  /** Stable key, e.g. `"a4"`. */
  id: string;
  /** Display label, e.g. `"A4"`. */
  displayName: string;
  /** Fixed dimensions in mm; undefined for the `custom` entry. Long edge stored as height. */
  dimensionsMm?: { widthMm: number; heightMm: number };
  /** True only for the `custom` entry. */
  isCustom: boolean;
}
