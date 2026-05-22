/**
 * types.ts — import pipeline contract types (IMP-05, IMP-06, IMP-07 / D-10, D-12).
 *
 * The shared contract every downstream Phase 2 plan builds against: signature
 * sniffing (02-02), the EXIF-bake / decode / downscale engine (02-02), the
 * image worker + bridge (02-03), and the batch pipeline (02-04) all import
 * these types. Defining them first prevents a downstream "scavenger hunt".
 *
 * Phase 2 deals in PIXELS only — `ImageBitmap`, `{ w, h }`. There is no mm math
 * here; do NOT import `print-engine/units`. The "~2000px working copy" is a
 * pixel target, not a physical dimension.
 *
 * SCOPE: type declarations only — no runtime logic, no DOM, no React. Honors
 * the `no-restricted-imports` engine rule. Named exports only.
 */

/**
 * Image format resolved by signature-byte sniffing (D-04) — never trusted from
 * `file.type` / extension. `'unsupported'` covers every byte signature the
 * pipeline cannot decode (e.g. GIF, BMP, TIFF).
 */
export type DetectedFormat = 'jpeg' | 'png' | 'webp' | 'heic' | 'unsupported';

/**
 * Provenance + original-file metadata carried alongside a decoded result.
 * Designed so Phase 4 can persist the source `blob` to IndexedDB without
 * reworking any caller (D-10).
 */
export interface SourceMeta {
  /** Original file name as supplied by the OS/file input. */
  fileName: string;
  /** Format resolved by byte-signature sniffing (D-04). */
  format: DetectedFormat;
  /** Original file — Phase 4 persists THIS to IndexedDB (D-10). */
  blob: Blob;
  /** Dimensions after EXIF orientation is baked upright, in pixels. */
  originalDims: { w: number; h: number };
}

/**
 * A successfully imported image. One per decoded file.
 *
 * `original` is the full-resolution upright bitmap — the caller owns its
 * lifecycle and must `close()` it when done (D-11). `working` is the ~2000px
 * (longest-edge) upright downscale the editor actually renders (D-08).
 */
export interface ImportResult {
  /** Discriminant — narrow with `if (e.kind === 'result')`. */
  kind: 'result';
  /** Stable per-import id. */
  id: string;
  /** Full-resolution, upright. Caller owns lifecycle (D-11). */
  original: ImageBitmap;
  /** ~2000px longest edge, upright — what the editor uses (D-08). */
  working: ImageBitmap;
  /** Original-file metadata + provenance. */
  sourceMeta: SourceMeta;
}

/**
 * A per-file import failure. The batch pipeline skips and continues (D-12);
 * one bad file never blocks the rest of the batch.
 */
export interface ImportFailure {
  /** Discriminant — narrow with `if (e.kind === 'failure')`. */
  kind: 'failure';
  /** File name of the file that failed. */
  fileName: string;
  /** Why the file was skipped. */
  reason: 'unsupported-format' | 'decode-error' | 'corrupt' | 'too-large';
  /** Underlying error detail, when available. */
  detail?: string;
}

/**
 * Emitted once at the start of a batch that exceeds the soft cap (D-13).
 * Not an error — the import still proceeds; the user decides.
 */
export interface ImportWarning {
  /** Discriminant — narrow with `if (e.kind === 'warning')`. */
  kind: 'warning';
  /** Number of files in the batch. */
  count: number;
  /** The soft-cap threshold that was exceeded. */
  softCap: number;
}

/**
 * The discriminated union the batch pipeline yields. Consumers narrow on
 * `kind` (`'result' | 'failure' | 'warning'`).
 */
export type ImportEvent = ImportResult | ImportFailure | ImportWarning;

/** Options for a batch import. */
export interface ImportOpts {
  /** Warn-past-this-many-files soft cap; default ~10 (D-13). */
  softCap?: number;
  /** Working-copy longest-edge target in pixels; default 2000 (D-08). */
  maxEdge?: number;
}
