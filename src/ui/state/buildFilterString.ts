/**
 * buildFilterString.ts — the SINGLE CSS-filter mapping for the editor.
 *
 * Turns a `PhotoAdjustments` value into one CSS `filter` string. The exact
 * same string is used for the live `<img>` preview AND for `ctx.filter` when
 * baking a photo at export time — so preview == export (WYSIWYG). This is the
 * one place CSS-filter math lives; keep it the sole source of truth.
 *
 * SCOPE: a pure string builder — no DOM, no React. Lives in `/ui`.
 */
import type { PhotoAdjustments } from './photoAdjustments';

/**
 * Build the CSS `filter` string for the given adjustments. Returns `'none'`
 * when every slider is at its identity value.
 *
 * Mapping rationale (CSS filters only approximate photographic ops — accepted
 * per the project's reference-app approach):
 *  - brightness + exposure both fold into CSS `brightness()` (multiplicative).
 *  - contrast/saturation map directly.
 *  - temperature: warm → `sepia()` for a warm cast; cool → mild `hue-rotate`.
 *  - tint: small `hue-rotate()` toward green/magenta.
 *  - blur maps to CSS `blur(px)`.
 *  - whiten lifts brightness + drops contrast slightly to wash the background.
 */
export function buildFilterString(adj: PhotoAdjustments): string {
  const parts: string[] = [];

  // brightness + exposure → one multiplicative brightness factor.
  // -100..100 → 0.4..1.6 each; combined multiplicatively.
  const brightnessFactor = 1 + adj.brightness / 167;
  const exposureFactor = 1 + adj.exposure / 167;
  const whitenLift = 1 + adj.whiten / 250;
  const bright = brightnessFactor * exposureFactor * whitenLift;
  if (Math.abs(bright - 1) > 1e-4) parts.push(`brightness(${bright.toFixed(4)})`);

  // contrast: -100..100 → 0.4..1.6; whiten reduces contrast slightly.
  const contrast = (1 + adj.contrast / 167) * (1 - adj.whiten / 500);
  if (Math.abs(contrast - 1) > 1e-4) parts.push(`contrast(${contrast.toFixed(4)})`);

  // saturation: -100..100 → 0..2.
  const sat = 1 + adj.saturation / 100;
  if (Math.abs(sat - 1) > 1e-4) parts.push(`saturate(${Math.max(0, sat).toFixed(4)})`);

  // temperature: warm (+) → sepia cast; cool (-) → blue-ward hue-rotate.
  if (adj.temperature > 0) {
    parts.push(`sepia(${(adj.temperature / 200).toFixed(4)})`);
  } else if (adj.temperature < 0) {
    parts.push(`hue-rotate(${(adj.temperature / 8).toFixed(2)}deg)`);
  }

  // tint: small hue rotation toward green/magenta.
  if (adj.tint !== 0) {
    parts.push(`hue-rotate(${(adj.tint / 10).toFixed(2)}deg)`);
  }

  // blur: direct CSS px.
  if (adj.blur > 0) parts.push(`blur(${adj.blur.toFixed(2)}px)`);

  return parts.length > 0 ? parts.join(' ') : 'none';
}
