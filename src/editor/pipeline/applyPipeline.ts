/**
 * applyPipeline.ts — the editor pipeline's public entry point (D-01..D-04 / EDIT-09).
 *
 * `applyPipeline` is the single ordered evaluator of the non-destructive edit
 * graph. It realizes four locked Phase 3 decisions:
 *   - D-01: a two-stage order — Stage 1 resolves geometry (crop/rotate/flip/
 *     zoom-pan), THEN Stage 2 reduces the color/filter stack. The color ops are
 *     always evaluated in the fixed `CANONICAL_ORDER`, never the order the
 *     caller happens to list them in `pipeline.adjustments`.
 *   - D-02: a single evaluator over a typed, ordered op set — one entry point,
 *     not a per-op scatter.
 *   - D-03: resolution-independent — the identical op list runs unchanged on
 *     the ~2000px editor working copy and the full-resolution export original;
 *     there is no separate export code path and no parameter rescaling.
 *   - D-04: non-destructive — the source `ImageData` is never mutated; each op
 *     returns a fresh clone, and `applyPipeline` returns a fresh `ImageData`
 *     (RESEARCH Open Question 2 — no caller-supplied target bitmap).
 *
 * EDIT-09 reset: an empty pipeline (`EMPTY_PIPELINE` — identity crop, no
 * adjustments) produces the geometry-only result, which for an identity crop
 * equals the source. `reset` is simply returning to `EMPTY_PIPELINE`.
 *
 * SCOPE: orchestration only — this module holds NO pixel math. Stage 1 is
 * delegated to `geometry.ts` (`resolveGeometry`); Stage 2 dispatches to the
 * per-op functions under `adjustments/*`. This module MUST NOT import
 * React/Konva/ui (the `no-restricted-imports` engine rule covers
 * `src/editor/**`). Named exports only.
 */
import type { Adjustment, Pipeline } from './types';
import { CANONICAL_ORDER } from './types';
import { resolveGeometry } from './geometry';
import { brightness } from './adjustments/brightness';
import { contrast } from './adjustments/contrast';
import { saturation } from './adjustments/saturation';
import { exposure } from './adjustments/exposure';
import { whiteBalance } from './adjustments/whiteBalance';
import { blur } from './adjustments/blur';
import { sharpness } from './adjustments/sharpness';
import { backgroundWhitening } from './adjustments/backgroundWhitening';

/**
 * Apply one adjustment op to `img`, returning a fresh `ImageData`. The `switch`
 * narrows the discriminated union on `a.type` so each op is called with its
 * exact param shape — type-safe without `any` and satisfying
 * `noUncheckedIndexedAccess` (no index access on a dispatch object).
 */
function applyOne(img: ImageData, a: Adjustment): ImageData {
  switch (a.type) {
    case 'whiteBalance':
      return whiteBalance(img, { temp: a.temp, tint: a.tint });
    case 'exposure':
      return exposure(img, { ev: a.ev });
    case 'brightness':
      return brightness(img, { amount: a.amount });
    case 'contrast':
      return contrast(img, { amount: a.amount });
    case 'saturation':
      return saturation(img, { amount: a.amount });
    case 'blur':
      return blur(img, { fractionOfDiagonal: a.fractionOfDiagonal });
    case 'sharpness':
      return sharpness(img, {
        fractionOfDiagonal: a.fractionOfDiagonal,
        amount: a.amount,
      });
    case 'backgroundWhitening':
      return backgroundWhitening(img, {
        threshold: a.threshold,
        strength: a.strength,
        feather: a.feather,
      });
  }
}

/**
 * Evaluate the full non-destructive pipeline against `src`, returning a fresh
 * `ImageData` (D-04 — `src` is never mutated).
 *
 * Stage 1 (D-01): `resolveGeometry` resolves the crop/rotate/flip/zoom-pan
 * geometry. For an identity crop it early-returns `src` unchanged.
 *
 * Stage 2 (D-01): the color/filter ops run in `CANONICAL_ORDER`. The caller's
 * `pipeline.adjustments` array order is irrelevant — ops are selected by
 * iterating `CANONICAL_ORDER` and applying every matching adjustment in the
 * array (duplicate adjustments of the same type are both applied; there is no
 * dedup). An empty adjustment list yields the geometry-only result (EDIT-09).
 *
 * @param src the source ImageData (the ~2000px working copy, or full-res at export)
 * @param p   the pipeline — geometry crop + color/filter adjustments
 */
export function applyPipeline(src: ImageData, p: Pipeline): ImageData {
  // Stage 1 — geometry resolves before the color stack (D-01).
  let img = resolveGeometry(src, p.crop);

  // Stage 2 — reduce the color/filter ops in fixed canonical order (D-01).
  // Iterate CANONICAL_ORDER (not p.adjustments) so evaluation is deterministic
  // regardless of the caller's array order.
  for (const type of CANONICAL_ORDER) {
    for (const adjustment of p.adjustments) {
      if (adjustment.type === type) {
        img = applyOne(img, adjustment);
      }
    }
  }

  return img;
}
