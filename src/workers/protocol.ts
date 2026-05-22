/**
 * protocol.ts — typed message contract for the image worker boundary
 * (D-03, D-11 / IMP-06).
 *
 * The main thread and the image worker only ever exchange the message shapes
 * declared here. Defining the request/response union in one shared module keeps
 * the structured-clone / transferable boundary fully typed on both sides — the
 * worker (`image.worker.ts`) types its `onmessage` against `WorkerRequest`, the
 * bridge (`bridge.ts`) types its responses against `WorkerResponse`.
 *
 * D-03: decode/HEIC/downscale run inside the worker so a heavy decode never
 * freezes the UI. D-11: `WorkerSuccess` bitmaps cross the boundary on the
 * transferables list — they move, not copy.
 *
 * SCOPE: type declarations only — no runtime logic, no DOM, no React. Honors
 * the `no-restricted-imports` engine rule. Named exports only.
 */
import type { DetectedFormat } from '../editor/import/types';

/**
 * A request posted from the main thread to the image worker. One per imported
 * file. `id` correlates the eventual {@link WorkerResponse} back to its caller.
 */
export interface WorkerRequest {
  /** Unique per-request id; the matching response carries the same id. */
  id: string;
  /** The imported file to decode, bake upright, and downscale. */
  file: File;
  /** Working-copy longest-edge target in pixels (D-08). */
  maxEdge: number;
}

/**
 * A successful decode result. Both `original` and `working` are transferred to
 * the main thread via the transferables list — they are no longer usable in the
 * worker after `postMessage` (D-11, Pitfall 5).
 */
export interface WorkerSuccess {
  /** Correlates to the originating {@link WorkerRequest.id}. */
  id: string;
  /** Discriminant — narrow with `if (res.ok)`. */
  ok: true;
  /** Full-resolution, upright bitmap. Caller owns its lifecycle (D-11). */
  original: ImageBitmap;
  /** ~`maxEdge`px longest-edge upright downscale — what the editor uses (D-08). */
  working: ImageBitmap;
  /** Format resolved by signature-byte sniffing (D-04). */
  format: DetectedFormat;
  /** Dimensions of the upright original, in pixels. */
  originalDims: { w: number; h: number };
}

/**
 * A failed decode. The batch pipeline (plan 02-04) skips and continues (D-12).
 */
export interface WorkerError {
  /** Correlates to the originating {@link WorkerRequest.id}. */
  id: string;
  /** Discriminant — narrow with `if (!res.ok)`. */
  ok: false;
  /** Why the file could not be processed. */
  reason: 'unsupported-format' | 'decode-error' | 'corrupt';
  /** Underlying error detail (`name: message`), when a stage threw. */
  detail?: string;
}

/**
 * The discriminated union the worker posts back. Consumers narrow on `ok`.
 */
export type WorkerResponse = WorkerSuccess | WorkerError;
