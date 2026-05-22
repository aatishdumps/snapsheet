/**
 * whiteBalance.ts — white-balance adjustment op (EDIT-07 / D-02, D-03, D-04, D-08).
 *
 * One adjustment op per file (D-02). A scale-free per-pixel transform (D-03)
 * applying per-channel gain — all color work is sRGB end-to-end (D-08).
 * Non-destructive (D-04) — operates on a fresh clone of the caller's
 * ImageData, never mutating the input.
 *
 * SCOPE: pure per-pixel op — no DOM, no React. Honors the `no-restricted-imports`
 * engine rule. Named exports only.
 */
import { clamp8, assertFinite } from './_clamp';

/**
 * Documented inclusive bounds of `temp`/`tint` (0 is identity). Clamping to
 * ±100 keeps every gain in `[0, 2]` — a value beyond +100 makes the opposite
 * gain negative, which inverts a channel before `clamp8` floors it to 0.
 */
const WB_MIN = -100;
const WB_MAX = 100;

/**
 * White balance via per-channel gain. `temp` is roughly -100..100: warm(+)
 * raises R and lowers B, cool(-) the inverse. `tint` is roughly -100..100:
 * positive lowers G (magenta), negative raises G (green). temp=tint=0 is
 * identity. Gains: rGain=1+temp/100, bGain=1-temp/100, gGain=1-tint/100.
 * `temp`/`tint` are clamped to ±100 before use — the Adjustment union types
 * them as bare `number`s, so a deserialized/tampered pipeline (Phase 4) could
 * otherwise drive a negative gain and silently invert a channel.
 * Output channels are clamped to 0..255; alpha is copied unchanged.
 * Throws (via `assertFinite`) if `temp` or `tint` is NaN/Infinity (threat T-03-05).
 */
export function whiteBalance(
  img: ImageData,
  p: { temp: number; tint: number },
): ImageData {
  assertFinite('temp', p.temp);
  assertFinite('tint', p.tint);
  const temp = Math.min(WB_MAX, Math.max(WB_MIN, p.temp));
  const tint = Math.min(WB_MAX, Math.max(WB_MIN, p.tint));
  const rGain = 1 + temp / 100;
  const bGain = 1 - temp / 100;
  const gGain = 1 - tint / 100;
  const d = img.data;
  const clone = new ImageData(
    new Uint8ClampedArray(d),
    img.width,
    img.height,
  );
  const out = clone.data;
  for (let i = 0; i < d.length; i += 4) {
    out[i] = clamp8((d[i] ?? 0) * rGain);
    out[i + 1] = clamp8((d[i + 1] ?? 0) * gGain);
    out[i + 2] = clamp8((d[i + 2] ?? 0) * bGain);
    out[i + 3] = d[i + 3] ?? 0;
  }
  return clone;
}
