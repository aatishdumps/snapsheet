/**
 * backgroundWhitening.ts — threshold-based background whitening op
 * (EDIT-08 / D-05, D-06, D-07, D-08).
 *
 * One adjustment op per file (D-02). Background whitening is threshold-based,
 * never ML (D-05). It acts on GLOBAL near-white pixels — any pixel within the
 * threshold, anywhere in the image, with no region selection, flood-fill, or
 * mask (D-07). It works because passport specs already require a plain light
 * background.
 *
 * Per pixel a "whiteness" score is computed from sRGB-weighted luminance
 * (D-08) gated by chroma — a bright but slightly-colored pixel (skin, fabric)
 * scores low so the subject is preserved (RESEARCH Pitfall 4). A smoothstep
 * feather around the threshold gives a soft background↔subject boundary
 * instead of a hard halo (D-06). Above the band, RGB is pushed toward pure
 * sRGB white (255,255,255) by `strength` (D-08).
 *
 * Non-destructive (D-04) — the caller's ImageData is never mutated; the op
 * writes into a fresh ImageData.
 *
 * SCOPE: pure global per-pixel whitening — no flood-fill, no mask, no DOM, no
 * React. Honors the `no-restricted-imports` engine rule. Named exports only.
 */
import { clamp8, assertFinite } from './_clamp';

/**
 * Conservative default whitening parameters (D-06, RESEARCH Assumption A1).
 * These are starting values to tune against real passport photos — they only
 * whiten genuinely near-white pixels and leave subject skin/clothing untouched.
 */
export const DEFAULT_WHITENING = {
  threshold: 0.82,
  strength: 0.6,
  feather: 0.12,
} as const;

/**
 * Chroma tolerance (0–255 channel spread). A pixel whose `max-min` channel
 * spread reaches this value is treated as fully colored and scores zero
 * whiteness — this is what stops the op from eating the subject.
 */
const CHROMA_TOL = 40;

/**
 * Smoothstep ramp: 0 below `a`, 1 above `b`, a smooth Hermite curve between.
 * Guards the degenerate `b === a` case (feather 0 → a hard step).
 */
function smoothstep(a: number, b: number, x: number): number {
  if (b === a) return x >= a ? 1 : 0;
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

/**
 * Threshold-based background whitening (D-05/06/07/08). `threshold` is the
 * whiteness cutoff 0–1; `strength` is how far toward pure sRGB white to push
 * (0–1); `feather` is the half-width of the smooth ramp straddling the
 * threshold. Output channels are clamped to 0..255; alpha is copied unchanged.
 * Throws (via `assertFinite`) if any param is NaN/Infinity (threat T-03-09).
 */
export function backgroundWhitening(
  img: ImageData,
  p: { threshold: number; strength: number; feather: number },
): ImageData {
  assertFinite('threshold', p.threshold);
  assertFinite('strength', p.strength);
  assertFinite('feather', p.feather);

  const d = img.data;
  const out = new Uint8ClampedArray(d.length);
  const lo = p.threshold - p.feather;
  const hi = p.threshold + p.feather;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] ?? 0;
    const g = d[i + 1] ?? 0;
    const b = d[i + 2] ?? 0;

    const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    const whiteness =
      (Y / 255) * (1 - Math.min(1, Math.max(0, chroma / CHROMA_TOL)));
    const t = smoothstep(lo, hi, whiteness);
    const push = t * p.strength;

    out[i] = clamp8(r + (255 - r) * push);
    out[i + 1] = clamp8(g + (255 - g) * push);
    out[i + 2] = clamp8(b + (255 - b) * push);
    out[i + 3] = d[i + 3] ?? 0;
  }

  return new ImageData(out, img.width, img.height);
}
