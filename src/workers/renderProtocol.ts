/**
 * renderProtocol.ts — typed message contract for the render worker boundary
 * (D-01).
 *
 * The main thread and the render worker (`render.worker.ts`) only ever exchange
 * the message shapes declared here, mirroring `protocol.ts`: an id-correlated
 * `RenderRequest`, and a discriminated `RenderResponse` union narrowed on `ok`.
 * The request carries the resolver INPUTS (`cellGroups` + `photos`) so a photo
 * is always resolved BY groupId via `resolvePhotos` — never by array index.
 *
 * SCOPE: type declarations only — no runtime logic, no DOM, no React. Honors
 * the `no-restricted-imports` engine rule. Named exports only.
 */

import type { RenderSpec } from '../print-engine/renderSpec';
import type { PhotoEntry } from '../state/types';
import type { CellGroup } from '../layout-engine/types';

/**
 * A request posted from the main thread to the render worker. `id` correlates
 * the eventual {@link RenderResponse} back to its caller.
 */
export interface RenderRequest {
  /** Unique per-request id; the matching response carries the same id. */
  id: string;
  /** Sheet px size + per-photo px rects, each tagged with its `groupId`. */
  spec: RenderSpec;
  /** The layout's cell groups — the `groupId -> photoId` link source. */
  cellGroups: CellGroup[];
  /** The document's photos — resolved BY groupId via `resolvePhotos`, NOT by index. */
  photos: PhotoEntry[];
  /** Render corner-tick crop marks on the sheet (D-07). */
  cutMarks: boolean;
}

/**
 * A successful sheet render. `blob` is the rasterized sheet image.
 */
export interface RenderSuccess {
  /** Correlates to the originating {@link RenderRequest.id}. */
  id: string;
  /** Discriminant — narrow with `if (res.ok)`. */
  ok: true;
  /** The rendered sheet as an image blob. */
  blob: Blob;
}

/**
 * A failed sheet render. The orchestrator maps this to a typed `ExportResult`
 * failure (steering the user toward the PDF path for `canvas-cap-exceeded`).
 */
export interface RenderError {
  /** Correlates to the originating {@link RenderRequest.id}. */
  id: string;
  /** Discriminant — narrow with `if (!res.ok)`. */
  ok: false;
  /** Why the sheet could not be rendered. */
  reason:
    | 'render-error'
    | 'canvas-cap-exceeded'
    | 'asset-missing'
    | 'group-missing'
    | 'photo-missing';
}

/** The discriminated union the render worker posts back. Consumers narrow on `ok`. */
export type RenderResponse = RenderSuccess | RenderError;
