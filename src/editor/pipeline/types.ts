/**
 * types.ts — editor-pipeline contract types (EDIT-01..09 / D-01, D-02, D-03, D-04).
 *
 * The shared contract every downstream Phase 3 pipeline plan builds against:
 * the per-op adjustment files under `adjustments/*` (plans 02, 03), the
 * geometry resolver `geometry.ts` (plan 05), and the `applyPipeline.ts`
 * orchestrator (plan 07) all import the `Adjustment` union and `Pipeline`
 * contract defined here. Defining them first prevents a downstream
 * "scavenger hunt" and a parallel-creation conflict between waves.
 *
 * The pipeline is a typed, ordered op set (D-02) evaluated in a single fixed
 * `CANONICAL_ORDER` (D-01) — the user sets parameter values but never reorders
 * ops. Geometry resolves before the color/filter stack. All parameters are
 * stored resolution-independently (D-03): crop is a normalized 0–1 rect,
 * blur/sharpness radii are a fraction of the image diagonal. The engine never
 * mutates the source bitmap (D-04); `reset` (EDIT-09) returns to EMPTY_PIPELINE.
 *
 * SCOPE: type declarations only — no runtime logic, no DOM, no React. The one
 * frozen `CANONICAL_ORDER` const array and `EMPTY_PIPELINE` const are pure
 * data. Honors the `no-restricted-imports` engine rule. Named exports only.
 */

/**
 * Crop / zoom / pan / rotate / flip geometry, stored resolution-independently
 * (D-03/D-04). Crop is a normalized 0–1 rect on the source bitmap; zoom and pan
 * are encoded in the rect (zoom = a smaller rect, pan = the rect origin). The
 * aspect ratio is not enforced here — `constrainCrop` in geometry.ts locks it
 * to the active preset (EDIT-01 — plan 05 Task 1).
 */
export interface CropTransform {
  /** Left edge as fraction 0–1 of source width. */
  x: number;
  /** Top edge as fraction 0–1 of source height. */
  y: number;
  /** Width as fraction 0–1 of source width (zoom = smaller w/h). */
  w: number;
  /** Height as fraction 0–1 of source height (zoom = smaller w/h). */
  h: number;
  /** Rotation in degrees, applied in the geometry stage (EDIT-02). */
  rotateDeg: number;
  /** Horizontal flip (EDIT-03). */
  flipH: boolean;
  /** Vertical flip (EDIT-03). */
  flipV: boolean;
}

/**
 * The discriminated union of every color/filter adjustment op (D-02). Each
 * member is one interface carrying a `type` string discriminant; consumers
 * narrow with `if (a.type === 'brightness')`. Geometry ops (crop/rotate/flip/
 * zoom-pan) are NOT in this union — they live in `CropTransform` and resolve
 * before this stack runs (D-01).
 */
export type Adjustment =
  /** White balance — per-channel gain shifting warmth and green/magenta (EDIT-07). */
  | {
      type: 'whiteBalance';
      /** Warm(+)/cool(-) shift, roughly -100..100; raises R, lowers B as it rises. */
      temp: number;
      /** Green(-)/magenta(+) shift, roughly -100..100; adjusts the G channel. */
      tint: number;
    }
  /** Exposure — multiplicative brightness in photographic stops (EDIT-05). */
  | {
      type: 'exposure';
      /** Exposure value in stops, roughly -2..+2; output is multiplied by 2^ev. */
      ev: number;
    }
  /** Brightness — additive lightness shift (EDIT-05). */
  | {
      type: 'brightness';
      /** Additive amount, -100..100; 0 is identity. */
      amount: number;
    }
  /** Contrast — expand/compress tones around mid-grey 128 (EDIT-05). */
  | {
      type: 'contrast';
      /** Contrast amount, -100..100; 0 is identity. */
      amount: number;
    }
  /** Saturation — scale chroma around per-pixel luminance (EDIT-05). */
  | {
      type: 'saturation';
      /** Saturation amount, -100..100; -100 is greyscale, 0 is identity. */
      amount: number;
    }
  /** Blur — Gaussian/box blur, radius resolution-independent (EDIT-06). */
  | {
      type: 'blur';
      /** Blur radius as a fraction of the image diagonal (D-03); e.g. 0.004. */
      fractionOfDiagonal: number;
    }
  /** Sharpness — unsharp mask, radius resolution-independent (EDIT-06). */
  | {
      type: 'sharpness';
      /** USM radius as a fraction of the image diagonal (D-03); e.g. 0.004. */
      fractionOfDiagonal: number;
      /** USM strength multiplier on the (original - blurred) detail, roughly 0..2. */
      amount: number;
    }
  /** Background whitening — push global near-white pixels to pure white (EDIT-08). */
  | {
      type: 'backgroundWhitening';
      /** Whiteness cutoff 0–1; pixels above this count as background (D-06). */
      threshold: number;
      /** How far toward pure sRGB white (255,255,255) to push, 0–1 (D-06/D-08). */
      strength: number;
      /** Feather half-width 0–1 — smooths the background↔subject boundary (D-06). */
      feather: number;
    };

/** The set of valid `Adjustment` discriminants — derived from the union. */
export type AdjustmentType = Adjustment['type'];

/**
 * Fixed canonical adjustment order — geometry resolves first, then this
 * color/filter stack (D-01). User sets values, never reorders.
 */
export const CANONICAL_ORDER: readonly AdjustmentType[] = Object.freeze([
  'whiteBalance',
  'exposure',
  'brightness',
  'contrast',
  'saturation',
  'blur',
  'sharpness',
  'backgroundWhitening',
] as const);

/**
 * The complete non-destructive edit state — plain serializable data (D-04),
 * which sets up Phase 4's operation-based undo/redo.
 */
export interface Pipeline {
  /** Geometry stage parameters (D-01 — resolves before the color stack). */
  crop: CropTransform;
  /** The color/filter ops; evaluated in CANONICAL_ORDER, not array order (D-01). */
  adjustments: Adjustment[];
}

/**
 * The reset / default pipeline state (EDIT-09 / D-04): an identity crop and an
 * empty adjustment list. `reset` is returning to exactly this value.
 */
export const EMPTY_PIPELINE: Pipeline = {
  crop: { x: 0, y: 0, w: 1, h: 1, rotateDeg: 0, flipH: false, flipV: false },
  adjustments: [],
};
