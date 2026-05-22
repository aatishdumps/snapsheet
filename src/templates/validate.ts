/**
 * validate.ts — custom PHOTO-dimension validator (PRE-02 / D-05).
 *
 * Each photo side must be within 20-100mm inclusive — covers all real
 * passport/visa/ID sizes and prevents print-breaking / canvas-overflowing
 * sizes downstream (threat T-01-03).
 */

/** Minimum allowed photo side, mm (D-05). */
export const MIN_SIDE_MM = 20;
/** Maximum allowed photo side, mm (D-05). */
export const MAX_SIDE_MM = 100;

/** Result of a custom-dimension validation — a discriminated union. */
export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

/**
 * Validate custom photo dimensions. Input is in millimetres.
 * Each side must be a finite number within [20, 100] mm inclusive.
 */
export function validateCustomDimensions(
  widthMm: number,
  heightMm: number,
): ValidationResult {
  const errors: string[] = [];
  for (const [name, v] of [
    ['width', widthMm],
    ['height', heightMm],
  ] as const) {
    if (!Number.isFinite(v)) {
      errors.push(`${name} must be a number`);
    } else if (v < MIN_SIDE_MM) {
      errors.push(`${name} must be at least ${MIN_SIDE_MM}mm`);
    } else if (v > MAX_SIDE_MM) {
      errors.push(`${name} must be at most ${MAX_SIDE_MM}mm`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
