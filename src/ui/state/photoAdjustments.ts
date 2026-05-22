/**
 * photoAdjustments.ts — the per-photo adjustment model for the DOM/CSS UI.
 *
 * `PhotoAdjustments` is the UI-owned, plain-serializable edit state for ONE
 * photo: CSS-filter slider values plus geometry (rotate / flip / crop). The
 * crop is a normalized 0–1 rect on the *current* working bitmap.
 *
 * This is deliberately separate from the engine's `Pipeline` — the export path
 * bakes these values with `ctx.filter` using the SAME `buildFilterString`
 * the preview uses, so what-you-see-is-what-you-get. See ui-rebuild-NOTES.md.
 *
 * SCOPE: type + pure helpers only. Lives in `/ui` (engine layers must not
 * import it). Named exports only.
 */

/** A normalized 0–1 crop rect on the working bitmap. */
export interface CropRect {
  /** Left edge, fraction 0–1 of bitmap width. */
  x: number;
  /** Top edge, fraction 0–1 of bitmap height. */
  y: number;
  /** Width, fraction 0–1 of bitmap width. */
  w: number;
  /** Height, fraction 0–1 of bitmap height. */
  h: number;
}

/**
 * The complete UI edit state for one photo — CSS-filter slider values plus
 * geometry. All slider ranges are chosen so `0` (or the documented identity)
 * is a no-op.
 */
export interface PhotoAdjustments {
  /** Brightness, -100..100; 0 = identity. Maps to CSS `brightness()`. */
  brightness: number;
  /** Contrast, -100..100; 0 = identity. Maps to CSS `contrast()`. */
  contrast: number;
  /** Saturation, -100..100; 0 = identity. Maps to CSS `saturate()`. */
  saturation: number;
  /** Exposure, -100..100; 0 = identity. Folded into CSS `brightness()`. */
  exposure: number;
  /** Temperature, -100..100; 0 = identity. Warm = `sepia()`, cool = `hue-rotate`. */
  temperature: number;
  /** Tint, -100..100; 0 = identity. Approximated via `hue-rotate()`. */
  tint: number;
  /** Blur radius in CSS px, 0..10; 0 = identity. Maps to CSS `blur()`. */
  blur: number;
  /** Background-whiten strength, 0..100; 0 = off. Adds a screen-blend wash. */
  whiten: number;
  /** Clockwise rotation in degrees — only 0/90/180/270. */
  rotateDeg: number;
  /** Horizontal flip. */
  flipH: boolean;
  /** Vertical flip. */
  flipV: boolean;
  /** Optional baked-in crop rect (normalized) on the working bitmap. */
  crop: CropRect | null;
}

/** The identity adjustment state — every slider a no-op, no crop. */
export const DEFAULT_ADJUSTMENTS: PhotoAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  exposure: 0,
  temperature: 0,
  tint: 0,
  blur: 0,
  whiten: 0,
  rotateDeg: 0,
  flipH: false,
  flipV: false,
  crop: null,
};

/** Runtime guard — is `v` a structurally valid `PhotoAdjustments`? */
export function isPhotoAdjustments(v: unknown): v is PhotoAdjustments {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  const nums = [
    'brightness',
    'contrast',
    'saturation',
    'exposure',
    'temperature',
    'tint',
    'blur',
    'whiten',
    'rotateDeg',
  ];
  for (const k of nums) {
    if (typeof o[k] !== 'number' || !Number.isFinite(o[k])) return false;
  }
  if (typeof o['flipH'] !== 'boolean' || typeof o['flipV'] !== 'boolean') {
    return false;
  }
  const c = o['crop'];
  if (c !== null) {
    if (typeof c !== 'object' || c === null) return false;
    const cr = c as Record<string, unknown>;
    for (const k of ['x', 'y', 'w', 'h']) {
      if (typeof cr[k] !== 'number' || !Number.isFinite(cr[k])) return false;
    }
  }
  return true;
}
