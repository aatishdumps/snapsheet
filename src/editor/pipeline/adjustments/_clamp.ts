/**
 * _clamp.ts — shared pixel-op numeric helpers (EDIT-05, EDIT-06, EDIT-07, EDIT-08).
 *
 * The internal helper module consumed by EVERY adjustment op under
 * `adjustments/` — brightness/contrast/saturation/exposure/whiteBalance
 * (plan 02) and blur/sharpness/backgroundWhitening (plan 03). It is created
 * here in Wave 1 (not in plan 02) so that plans 02 and 03 — both Wave 2,
 * running in parallel — import it as a settled dependency with zero race or
 * divergent-copy risk. The leading underscore marks it as a non-op internal
 * helper (D-02: one file per op; this is shared, not an op).
 *
 * `clamp8` keeps a channel value in the valid 0–255 range after arithmetic;
 * `assertFinite` guards an adjustment parameter against NaN/Infinity before any
 * pixel loop (threat T-03-21 — tampered/non-finite params corrupt output).
 *
 * SCOPE: pure numeric helpers for adjustment ops — no DOM, no React, no
 * ImageData allocation. Honors the `no-restricted-imports` engine rule. Named
 * exports only.
 */

/** Clamp a channel value into the valid 0–255 range. */
export const clamp8 = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * Guard an adjustment parameter before any pixel loop. Throws when `v` is
 * NaN, Infinity, or -Infinity; returns void otherwise (threat T-03-21).
 */
export function assertFinite(name: string, v: number): void {
  if (!Number.isFinite(v)) {
    throw new Error(`${name} must be finite`);
  }
}
