/**
 * geometry.ts — Stage-1 geometry resolution (EDIT-01/02/03/04 / D-01).
 *
 * Resolves the editor pipeline's geometry stage — crop, rotate, flip, and
 * zoom/pan (zoom/pan encoded in the normalized crop rect) — in one
 * `OffscreenCanvas` affine pass. Geometry resolves BEFORE the color/filter
 * stack (D-01) so guides and aspect-lock compute against final geometry.
 *
 * SCOPE: pure resample — no DOM, no React (honors `no-restricted-imports`).
 * Browser APIs here (OffscreenCanvas) are unavailable in jsdom — the resample
 * is exercised via Playwright later, NOT a Vitest unit test. The pure
 * transform MATH below IS unit-tested.
 *
 * The file is split into two parts: PART A is pure transform math, fully
 * Vitest-tested in `geometry.test.ts`; PART B is the `resolveGeometry`
 * OffscreenCanvas resample, whose automated coverage is a documented,
 * Phase-3-owned deferral to a Playwright geometry-resample smoke test in
 * Phase 5/6 (see this plan's objective).
 */
import type { CropTransform } from './types';

// ───────────────────────────────────────────────────────────────────────────
// PART A — pure transform math (Vitest-testable, no OffscreenCanvas)
// ───────────────────────────────────────────────────────────────────────────

/** Throw if a value is not a finite number. */
function assertFinite(name: string, v: number): void {
  if (!Number.isFinite(v)) {
    throw new Error(`geometry: ${name} must be a finite number`);
  }
}

/**
 * Validate a crop rect: every field finite, the rect within `[0,1]`, and
 * `w`/`h` strictly positive. Mitigates T-03-11 (huge/zero output canvas) and
 * T-03-12 (non-finite transform fields) before any canvas allocation.
 *
 * Exported so callers that gate on `isIdentityGeometry` (a non-validating pure
 * predicate) can validate the crop explicitly (WR-04).
 */
export function assertValidCrop(crop: CropTransform): void {
  assertFinite('crop.x', crop.x);
  assertFinite('crop.y', crop.y);
  assertFinite('crop.w', crop.w);
  assertFinite('crop.h', crop.h);
  assertFinite('crop.rotateDeg', crop.rotateDeg);
  if (crop.w <= 0 || crop.h <= 0) {
    throw new Error('geometry: crop width/height must be > 0');
  }
  if (
    crop.x < 0 ||
    crop.y < 0 ||
    crop.x + crop.w > 1 ||
    crop.y + crop.h > 1
  ) {
    throw new Error('geometry: crop rect must lie within [0,1]');
  }
}

/**
 * True when the crop rect represents an identity geometry transform — the
 * full source, unrotated, unflipped. Callers (and `resolveGeometry`) use this
 * to skip the resample entirely (mirrors `downscale.ts` early-return).
 *
 * NOTE: this is a PURE PREDICATE — it does NOT validate the crop. A crop with
 * a `NaN` field returns `false` (NaN never `===` a finite literal), so callers
 * using it as a "needs resample" precondition must validate separately with
 * `assertValidCrop` / `cropOutputDimensions` (WR-04). `resolveGeometry`
 * validates unconditionally before consulting this predicate.
 */
export function isIdentityGeometry(crop: CropTransform): boolean {
  return (
    crop.x === 0 &&
    crop.y === 0 &&
    crop.w === 1 &&
    crop.h === 1 &&
    crop.rotateDeg === 0 &&
    !crop.flipH &&
    !crop.flipV
  );
}

/**
 * True when `rotateDeg` is an odd multiple of 90° — the case where the output
 * width/height swap. Lets callers/tests reason about post-rotation dimensions
 * without a canvas. Arbitrary (non-90°) angles are handled by the canvas pass
 * via a computed rotated bounding box; this helper only flags the exact
 * 90°/270° swap case.
 */
export function rotatedBoundsSwap(rotateDeg: number): boolean {
  if (!Number.isFinite(rotateDeg)) return false;
  // Normalize to [0,360); an odd multiple of 90 swaps bounds.
  const norm = ((rotateDeg % 360) + 360) % 360;
  return norm === 90 || norm === 270;
}

// ───────────────────────────────────────────────────────────────────────────
// PART B — the OffscreenCanvas resample (NOT unit-tested in Vitest)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Resolve the geometry stage: crop the normalized sub-rect out of `src`, then
 * apply rotation and horizontal/vertical flips in a single `OffscreenCanvas`
 * affine pass. Returns a new `ImageData`; the source is never mutated (D-04).
 *
 * The crop is validated UNCONDITIONALLY before the identity-transform check
 * (WR-04) — a malformed crop is rejected even though `isIdentityGeometry`
 * would itself return `false` for it; this keeps the validation responsibility
 * unambiguous. When the crop is an identity geometry transform, `src` is
 * returned unchanged (mirrors `downscale.ts`'s no-op early return).
 *
 * NOTE: `OffscreenCanvas` is unavailable in jsdom — this function is exercised
 * by a Playwright smoke test (deferred to Phase 5/6), NOT a Vitest unit test.
 *
 * @param src  the source ImageData (the ~2000px working copy, or full-res at export)
 * @param crop the normalized crop + rotate + flip transform
 */
export function resolveGeometry(
  src: ImageData,
  crop: CropTransform,
): ImageData {
  assertValidCrop(crop); // validate first (WR-04) — before the identity check
  if (isIdentityGeometry(crop)) return src; // no-op — skip the resample

  const srcW = src.width;
  const srcH = src.height;

  // Source sub-rect from the normalized crop.
  const sx = crop.x * srcW;
  const sy = crop.y * srcH;
  const sw = crop.w * srcW;
  const sh = crop.h * srcH;

  // Put the source onto a source canvas so we can drawImage a sub-rect.
  const fromCanvas = new OffscreenCanvas(srcW, srcH);
  const fromCtx = fromCanvas.getContext('2d')!;
  fromCtx.putImageData(src, 0, 0);

  const rad = (crop.rotateDeg * Math.PI) / 180;

  // Output canvas size: the rotated bounding box of the cropped sub-rect.
  // For the exact 90°/270° case the bounds simply swap; for arbitrary angles
  // compute the rotated bbox of a sw×sh rectangle.
  let outW: number;
  let outH: number;
  if (rotatedBoundsSwap(crop.rotateDeg)) {
    outW = Math.round(sh);
    outH = Math.round(sw);
  } else if (crop.rotateDeg % 180 === 0) {
    outW = Math.round(sw);
    outH = Math.round(sh);
  } else {
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    outW = Math.round(sw * cos + sh * sin);
    outH = Math.round(sw * sin + sh * cos);
  }

  const toCanvas = new OffscreenCanvas(outW, outH);
  const ctx = toCanvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // For an arbitrary (non-90°) straighten the rotated image does not cover the
  // enlarged bounding-box canvas — the four corner triangles would otherwise
  // be transparent black and render as solid black on a no-alpha JPG export.
  // A passport photo requires a plain light background, so the canvas is
  // pre-filled with pure sRGB white (D-08) before drawing (WR-05). 90°/180°/
  // 270° rotations cover the canvas exactly, so the fill is a harmless no-op
  // there; doing it unconditionally keeps the behavior simple and documented.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outW, outH);

  // Center the transform, rotate, flip, then draw the sub-rect centered.
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate(rad);
  ctx.scale(crop.flipH ? -1 : 1, crop.flipV ? -1 : 1);
  ctx.drawImage(
    fromCanvas,
    sx,
    sy,
    sw,
    sh,
    -sw / 2,
    -sh / 2,
    sw,
    sh,
  );

  return ctx.getImageData(0, 0, outW, outH);
}
