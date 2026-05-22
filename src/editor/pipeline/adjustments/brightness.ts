/**
 * brightness.ts — additive brightness adjustment op (EDIT-05 / D-02, D-03, D-04).
 *
 * One adjustment op per file (D-02). A scale-free per-pixel transform (D-03):
 * the identical op applies unchanged to the ~2000px editor working copy and to
 * the full-resolution export original. Non-destructive (D-04) — the caller's
 * ImageData is never mutated; the op writes into a fresh clone, because
 * `applyPipeline` (plan 07) reduces ops over a working copy that must stay
 * intact.
 *
 * SCOPE: pure per-pixel op — no DOM, no React. Honors the `no-restricted-imports`
 * engine rule. Named exports only.
 */
import { clamp8, assertFinite } from './_clamp';

/** Documented inclusive bounds of the `amount` parameter (0 is identity). */
const AMOUNT_MIN = -100;
const AMOUNT_MAX = 100;
/** Channel offset per unit of `amount` — 255/100, so ±100 spans 0–255. */
const CHANNEL_PER_AMOUNT = 2.55;

/**
 * Additive brightness. `amount` is -100..100 (0 is identity); it maps to an
 * additive channel offset of `amount * 2.55` so ±100 spans the full 0–255
 * range. `amount` is clamped to its documented domain before use — the
 * Adjustment union types it as a bare `number`, so a deserialized/tampered
 * pipeline (Phase 4) could otherwise supply a silently-wrong out-of-range value.
 * Output channels are clamped to 0..255; alpha is copied unchanged.
 * Throws (via `assertFinite`) if `amount` is NaN/Infinity (threat T-03-05).
 */
export function brightness(
  img: ImageData,
  p: { amount: number },
): ImageData {
  assertFinite('amount', p.amount);
  const amount = Math.min(AMOUNT_MAX, Math.max(AMOUNT_MIN, p.amount));
  const add = amount * CHANNEL_PER_AMOUNT;
  const d = img.data;
  const clone = new ImageData(
    new Uint8ClampedArray(d),
    img.width,
    img.height,
  );
  const out = clone.data;
  for (let i = 0; i < d.length; i += 4) {
    out[i] = clamp8((d[i] ?? 0) + add);
    out[i + 1] = clamp8((d[i + 1] ?? 0) + add);
    out[i + 2] = clamp8((d[i + 2] ?? 0) + add);
    out[i + 3] = d[i + 3] ?? 0;
  }
  return clone;
}
