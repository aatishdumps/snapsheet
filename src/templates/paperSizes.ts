/**
 * paperSizes.ts — print paper sizes (LAY-07).
 *
 * A flat array of paper-size records. Fixed sizes are international standards
 * / standard photo-print sizes (HIGH confidence). The long edge is stored as
 * `heightMm`; portrait/landscape orientation is a layout-engine concern
 * (Phase 3), not a Phase 1 data concern.
 *
 * The `custom` entry carries no dimensions — those are supplied and validated
 * at the UI edge (custom paper-size bounds are a Phase 3 concern).
 */
import type { PaperSize } from './types';

export const paperSizes = [
  {
    id: '4r',
    displayName: '4R (4x6 in)',
    dimensionsMm: { widthMm: 101.6, heightMm: 152.4 },
    isCustom: false,
  },
  {
    id: '5x7',
    displayName: '5x7 in',
    dimensionsMm: { widthMm: 127, heightMm: 177.8 },
    isCustom: false,
  },
  {
    id: 'a4',
    displayName: 'A4',
    dimensionsMm: { widthMm: 210, heightMm: 297 },
    isCustom: false,
  },
  {
    id: 'letter',
    displayName: 'US Letter',
    dimensionsMm: { widthMm: 215.9, heightMm: 279.4 },
    isCustom: false,
  },
  {
    id: 'custom',
    displayName: 'Custom',
    isCustom: true,
  },
] satisfies PaperSize[];
