/**
 * exposure.ts — photographic-stop exposure adjustment op (EDIT-05 / D-02, D-03, D-04).
 *
 * One adjustment op per file (D-02). A scale-free per-pixel transform (D-03):
 * a multiplicative gain of `2^ev` (one stop per ev unit). Non-destructive
 * (D-04) — operates on a fresh clone of the caller's ImageData, never mutating
 * the input.
 *
 * SCOPE: pure per-pixel op — no DOM, no React. Honors the `no-restricted-imports`
 * engine rule. Named exports only.
 */
import { clamp8, assertFinite } from './_clamp';

/**
 * Documented inclusive bounds of `ev` in photographic stops (0 is identity).
 * The slider domain is roughly -2..+2; the clamp uses a slightly wider -4..+4
 * to leave headroom while still preventing absurd `2^ev` gains (e.g. ev=50).
 */
const EV_MIN = -4;
const EV_MAX = 4;

/**
 * Exposure in photographic stops. `ev` is roughly -2..+2 (0 is identity);
 * each channel is multiplied by `2^ev` — ev=1 doubles, ev=-1 halves.
 * `ev` is clamped to a bounded domain before use — the Adjustment union types
 * it as a bare `number`, so a deserialized/tampered pipeline (Phase 4) could
 * otherwise supply e.g. ev=50 (a 2^50 gain) for silently-wrong output.
 * Output channels are clamped to 0..255; alpha is copied unchanged.
 * Throws (via `assertFinite`) if `ev` is NaN/Infinity (threat T-03-05).
 */
export function exposure(
  img: ImageData,
  p: { ev: number },
): ImageData {
  assertFinite('ev', p.ev);
  const ev = Math.min(EV_MAX, Math.max(EV_MIN, p.ev));
  const mul = Math.pow(2, ev);
  const d = img.data;
  const clone = new ImageData(
    new Uint8ClampedArray(d),
    img.width,
    img.height,
  );
  const out = clone.data;
  for (let i = 0; i < d.length; i += 4) {
    out[i] = clamp8((d[i] ?? 0) * mul);
    out[i + 1] = clamp8((d[i + 1] ?? 0) * mul);
    out[i + 2] = clamp8((d[i + 2] ?? 0) * mul);
    out[i + 3] = d[i + 3] ?? 0;
  }
  return clone;
}
