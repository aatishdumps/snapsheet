/**
 * blur.ts — separable Gaussian blur op (EDIT-06 / D-02, D-03, D-04).
 *
 * One adjustment op per file (D-02). The blur radius is stored
 * resolution-independently as `fractionOfDiagonal` (D-03): at apply time the
 * pixel radius is recomputed from `fraction * hypot(width, height)`, so the
 * identical op applies unchanged to the ~2000px editor working copy and to the
 * full-resolution export original — there is no separate export code path.
 * Non-destructive (D-04) — the caller's ImageData is never mutated; every pass
 * writes into a fresh buffer.
 *
 * `gaussianBlur` is exported for reuse by `sharpness.ts` (unsharp mask =
 * original + amount * (original - gaussianBlur(original))).
 *
 * Implementation: a separable two-pass Gaussian (horizontal pass into a temp
 * buffer, then vertical pass into the output). The 1-D kernel has standard
 * deviation `sigma = radiusPx`, half-width `ceil(3*sigma)`, weights
 * `exp(-x*x/(2*sigma*sigma))` normalized to sum 1. Sample coordinates are
 * clamped to image bounds (edge-extend).
 *
 * SCOPE: pure separable-kernel op — no DOM, no React. Honors the
 * `no-restricted-imports` engine rule. Named exports only.
 */
import { assertFinite } from './_clamp';

/** Minimum effective sigma — guards `exp(-x*x / 0) = NaN` at sigma == 0. */
const MIN_SIGMA = 1e-6;

/**
 * Build a normalized 1-D Gaussian kernel for the given standard deviation.
 *
 * `sigma` is floored to `MIN_SIGMA`: at `sigma === 0` the weight for `x === 0`
 * is `exp(-0/0) = exp(NaN) = NaN`, poisoning the whole kernel and producing an
 * all-NaN output image. `gaussianBlur` is an exported function reused by
 * `sharpness.ts`, so the guard lives here rather than relying on every caller.
 */
function gaussianKernel(sigma: number): number[] {
  const s = Math.max(MIN_SIGMA, sigma);
  const half = Math.max(1, Math.ceil(3 * s));
  const kernel: number[] = [];
  let sum = 0;
  for (let x = -half; x <= half; x++) {
    const w = Math.exp(-(x * x) / (2 * s * s));
    kernel.push(w);
    sum += w;
  }
  for (let i = 0; i < kernel.length; i++) {
    const w = kernel[i] ?? 0;
    kernel[i] = w / sum;
  }
  return kernel;
}

/** Clamp an index into the [0, max-1] range (edge-extend sampling). */
function clampIndex(v: number, max: number): number {
  return v < 0 ? 0 : v > max - 1 ? max - 1 : v;
}

/**
 * A pure separable two-pass Gaussian blur. `radiusPx` is used as the Gaussian
 * standard deviation. Returns a fresh ImageData; the input is never mutated.
 * Reused by `sharpness.ts`.
 */
export function gaussianBlur(img: ImageData, radiusPx: number): ImageData {
  const { width: w, height: h } = img;
  const src = img.data;
  const kernel = gaussianKernel(radiusPx);
  const half = (kernel.length - 1) / 2;

  // Horizontal pass: src -> temp
  const temp = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let k = -half; k <= half; k++) {
        const weight = kernel[k + half] ?? 0;
        const sx = clampIndex(x + k, w);
        const si = (y * w + sx) * 4;
        r += (src[si] ?? 0) * weight;
        g += (src[si + 1] ?? 0) * weight;
        b += (src[si + 2] ?? 0) * weight;
        a += (src[si + 3] ?? 0) * weight;
      }
      const ti = (y * w + x) * 4;
      temp[ti] = r;
      temp[ti + 1] = g;
      temp[ti + 2] = b;
      temp[ti + 3] = a;
    }
  }

  // Vertical pass: temp -> out
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let k = -half; k <= half; k++) {
        const weight = kernel[k + half] ?? 0;
        const sy = clampIndex(y + k, h);
        const si = (sy * w + x) * 4;
        r += (temp[si] ?? 0) * weight;
        g += (temp[si + 1] ?? 0) * weight;
        b += (temp[si + 2] ?? 0) * weight;
        a += (temp[si + 3] ?? 0) * weight;
      }
      const oi = (y * w + x) * 4;
      out[oi] = r;
      out[oi + 1] = g;
      out[oi + 2] = b;
      out[oi + 3] = a;
    }
  }

  return new ImageData(out, w, h);
}

/**
 * Gaussian blur adjustment op. `fractionOfDiagonal` is the blur radius as a
 * fraction of the image diagonal (D-03) — resolution-independent. The fraction
 * is clamped to `[0, 0.1]` so the derived `radiusPx` is bounded by
 * `0.1 * diagonal` and the kernel loop cannot hang the CPU (threat T-03-08).
 * Throws (via `assertFinite`) if `fractionOfDiagonal` is NaN/Infinity
 * (threat T-03-09).
 */
export function blur(
  img: ImageData,
  p: { fractionOfDiagonal: number },
): ImageData {
  assertFinite('fractionOfDiagonal', p.fractionOfDiagonal);
  const frac = Math.min(0.1, Math.max(0, p.fractionOfDiagonal));
  const radiusPx = Math.max(
    1,
    Math.round(frac * Math.hypot(img.width, img.height)),
  );
  return gaussianBlur(img, radiusPx);
}
