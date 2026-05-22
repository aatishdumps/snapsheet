/**
 * saturation.ts — chroma-saturation adjustment op (EDIT-05 / D-02, D-03, D-04, D-08).
 *
 * One adjustment op per file (D-02). A scale-free per-pixel transform (D-03)
 * that scales each channel away from (or toward) its sRGB luminance — all
 * color work is sRGB end-to-end (D-08), so luminance uses the sRGB weights
 * 0.2126/0.7152/0.0722. Non-destructive (D-04) — operates on a fresh clone of
 * the caller's ImageData, never mutating the input.
 *
 * SCOPE: pure per-pixel op — no DOM, no React. Honors the `no-restricted-imports`
 * engine rule. Named exports only.
 */
import { clamp8, assertFinite } from './_clamp';

/** sRGB luminance weights (D-08). */
const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;

/** Documented inclusive bounds of the `amount` parameter (0 is identity). */
const AMOUNT_MIN = -100;
const AMOUNT_MAX = 100;

/**
 * Chroma saturation. `amount` is -100..100 (0 is identity); the scale factor
 * `s = 1 + amount/100` ranges 0 (fully desaturated — R=G=B=luminance) at -100
 * to 2 at +100. Each channel is `Y + (channel - Y) * s` around the per-pixel
 * sRGB luminance Y. `amount` is clamped to its documented domain before use —
 * the Adjustment union types it as a bare `number`, so a deserialized/tampered
 * pipeline (Phase 4) could otherwise drive an extreme `s` for silently-wrong
 * output. Output channels are clamped to 0..255; alpha is copied.
 * Throws (via `assertFinite`) if `amount` is NaN/Infinity (threat T-03-05).
 */
export function saturation(
  img: ImageData,
  p: { amount: number },
): ImageData {
  assertFinite('amount', p.amount);
  const amount = Math.min(AMOUNT_MAX, Math.max(AMOUNT_MIN, p.amount));
  const s = 1 + amount / 100;
  const d = img.data;
  const clone = new ImageData(
    new Uint8ClampedArray(d),
    img.width,
    img.height,
  );
  const out = clone.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] ?? 0;
    const g = d[i + 1] ?? 0;
    const b = d[i + 2] ?? 0;
    const y = LUMA_R * r + LUMA_G * g + LUMA_B * b;
    out[i] = clamp8(y + (r - y) * s);
    out[i + 1] = clamp8(y + (g - y) * s);
    out[i + 2] = clamp8(y + (b - y) * s);
    out[i + 3] = d[i + 3] ?? 0;
  }
  return clone;
}
