/**
 * sharpness.ts — unsharp-mask sharpness op (EDIT-06 / D-02, D-03, D-04).
 *
 * One adjustment op per file (D-02). Unsharp masking:
 *   sharpened = original + amount * (original - gaussianBlur(original))
 * The blur radius is stored resolution-independently as `fractionOfDiagonal`
 * (D-03): the pixel radius is recomputed from `fraction * hypot(width, height)`
 * so the identical op applies unchanged to the ~2000px editor working copy and
 * to the full-resolution export original — there is no separate export path.
 * Non-destructive (D-04) — the caller's ImageData is never mutated; the op
 * writes into a fresh ImageData.
 *
 * SCOPE: pure per-pixel op — no DOM, no React. Honors the
 * `no-restricted-imports` engine rule. Named exports only.
 */
import { clamp8, assertFinite } from './_clamp';
import { gaussianBlur } from './blur';

/**
 * Unsharp-mask sharpness. `fractionOfDiagonal` is the USM radius as a fraction
 * of the image diagonal (D-03) — resolution-independent, clamped to `[0, 0.1]`
 * so the derived `radiusPx` is bounded and the kernel loop cannot hang
 * (threat T-03-08). `amount` is the detail multiplier (roughly 0..2; 0 is
 * identity). Output channels are clamped to 0..255; alpha is copied unchanged.
 * Throws (via `assertFinite`) if either param is NaN/Infinity (threat T-03-09).
 */
export function sharpness(
  img: ImageData,
  p: { fractionOfDiagonal: number; amount: number },
): ImageData {
  assertFinite('fractionOfDiagonal', p.fractionOfDiagonal);
  assertFinite('amount', p.amount);

  const frac = Math.min(0.1, Math.max(0, p.fractionOfDiagonal));
  const radiusPx = Math.max(
    1,
    Math.round(frac * Math.hypot(img.width, img.height)),
  );
  const blurred = gaussianBlur(img, radiusPx);

  const d = img.data;
  const b = blurred.data;
  const out = new Uint8ClampedArray(d.length);
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] ?? 0;
    const g = d[i + 1] ?? 0;
    const bl = d[i + 2] ?? 0;
    out[i] = clamp8(r + p.amount * (r - (b[i] ?? 0)));
    out[i + 1] = clamp8(g + p.amount * (g - (b[i + 1] ?? 0)));
    out[i + 2] = clamp8(bl + p.amount * (bl - (b[i + 2] ?? 0)));
    out[i + 3] = d[i + 3] ?? 0;
  }
  return new ImageData(out, img.width, img.height);
}
