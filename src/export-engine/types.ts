/**
 * types.ts — the export-engine public contract (EXP-02/EXP-03/EXP-04 /
 * D-03, D-04, D-07).
 *
 * The shared request/result contract every export emitter builds against:
 * `exportImage.ts` (PNG/JPG) and `exportPdf.ts` (PDF) consume `ExportRequest`
 * and return `ExportResult`. `ExportResult` is a discriminated union mirroring
 * `LayoutResult` / `WorkerResponse` — failures are typed, never thrown.
 *
 * SCOPE: type declarations only — no runtime logic, no DOM, no React. Honors
 * the `no-restricted-imports` engine rule. Named exports only.
 */

import type { SerializedProject } from '../state/types';

/** Output file format for an export (D-03 — PDF is the recommended path). */
export type ExportFormat = 'png' | 'jpeg' | 'pdf';

/** What to export — the whole laid-out sheet or a single photo (D-04). */
export type ExportScope = 'sheet' | 'single';

/** A request to render and export the document model to a downloadable file. */
export interface ExportRequest {
  /** The document model to render (D-04). */
  project: SerializedProject;
  /** Output format — PNG / JPG / PDF (D-03). */
  format: ExportFormat;
  /** Whole sheet or one photo (D-04). */
  scope: ExportScope;
  /** Required when `scope === 'single'` — the `PhotoEntry.id` to export (D-04). */
  singlePhotoId?: string;
  /** Render corner-tick crop marks; defaults to false (D-07). */
  cutMarks?: boolean;
  /** JPEG quality 0–1; defaults to 0.92, used only when `format === 'jpeg'`. */
  jpgQuality?: number;
}

/**
 * The outcome of an export — a discriminated union narrowed on `ok`. Success
 * carries the file blob; failure is a typed reason (e.g. `canvas-cap-exceeded`
 * steers the user toward PDF, Open Q1).
 */
export type ExportResult =
  | { ok: true; blob: Blob; format: ExportFormat }
  | {
      ok: false;
      reason:
        /** PNG/JPG sheet > 16.7M px — steer to PDF (Open Q1). */
        | 'canvas-cap-exceeded'
        /** `singlePhotoId` / `group.photoId` not in the document. */
        | 'photo-not-found'
        /**
         * A photo's stored image data is gone from IndexedDB — distinct from a
         * generic render failure so the UI can prompt the user to re-import
         * the photo rather than just reporting a failure (WR-06).
         */
        | 'asset-missing'
        /** The render pipeline failed. */
        | 'render-failed'
        /** No cells to export. */
        | 'empty-layout';
    };
