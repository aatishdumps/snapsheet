/**
 * contrast.ts — tone-contrast adjustment op (EDIT-05 / D-02, D-03, D-04).
 *
 * One adjustment op per file (D-02). A scale-free per-pixel transform (D-03)
 * pivoting around mid-grey 128. Non-destructive (D-04) — operates on a fresh
 * clone of the caller's ImageData, never mutating the input, so `applyPipeline`
 * (plan 07) can reduce ops without corrupting its working copy.
 *
 * SCOPE: pure per-pixel op — no DOM, no React. Honors the `no-restricted-imports`
 * engine rule. Named exports only.
 */
import { clamp8, assertFinite } from './_clamp';

/** Documented inclusive bounds of the `amount` parameter (0 is identity). */
const AMOUNT_MIN = -100;
const AMOUNT_MAX = 100;
/** Standard contrast-factor constants — see formula in the doc comment. */
const CONTRAST_K = 259;
const CHANNEL_MAX = 255;

/**
 * Tone contrast around the mid-grey pivot 128. `amount` is -100..100 (0 is
 * identity); the standard contrast factor `f = 259*(amount+255)/(255*(259-amount))`
 * expands tones away from 128 for amount > 0 and compresses them for amount < 0.
 * `amount` is clamped to its documented -100..100 domain before computing `f`:
 * the type system permits any `number`, and at `amount >= 259` the denominator
 * goes to zero or negative, which would yield an Infinite/inverted factor and a
 * silently corrupt image (deserialized/tampered pipelines are a real input path).
 * Output channels are clamped to 0..255; alpha is copied unchanged.
 * Throws (via `assertFinite`) if `amount` is NaN/Infinity (threat T-03-05).
 */
export function contrast(
  img: ImageData,
  p: { amount: number },
): ImageData {
  assertFinite('amount', p.amount);
  const amount = Math.min(AMOUNT_MAX, Math.max(AMOUNT_MIN, p.amount));
  const f =
    (CONTRAST_K * (amount + CHANNEL_MAX)) /
    (CHANNEL_MAX * (CONTRAST_K - amount));
  const d = img.data;
  const clone = new ImageData(
    new Uint8ClampedArray(d),
    img.width,
    img.height,
  );
  const out = clone.data;
  for (let i = 0; i < d.length; i += 4) {
    out[i] = clamp8(f * ((d[i] ?? 0) - 128) + 128);
    out[i + 1] = clamp8(f * ((d[i + 1] ?? 0) - 128) + 128);
    out[i + 2] = clamp8(f * ((d[i + 2] ?? 0) - 128) + 128);
    out[i + 3] = d[i + 3] ?? 0;
  }
  return clone;
}
