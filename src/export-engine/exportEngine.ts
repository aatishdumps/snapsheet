/**
 * exportEngine.ts — the single-entry export format router (EXP-02).
 *
 * `runExport` is the one public entry point a caller (the Phase 6 export UI)
 * uses: it switches on `ExportRequest.format` and delegates to the matching
 * emitter — `exportPdf` for `'pdf'`, `exportImage` for `'png'` and `'jpeg'`.
 * The emitters own the actual render/encode/patch work; this module only
 * dispatches.
 *
 * SCOPE: format dispatch only — no canvas, no React/Konva/ui (the
 * `no-restricted-imports` engine rule covers `src/export-engine/**`). Named
 * exports only.
 */
import { exportImage } from './exportImage';
import { exportPdf } from './exportPdf';
import type { ExportRequest, ExportResult } from './types';

/**
 * Route an export request to the format-appropriate emitter.
 *
 * @param req the export request — format selects the emitter
 */
export async function runExport(
  req: ExportRequest,
): Promise<ExportResult> {
  switch (req.format) {
    case 'pdf':
      return exportPdf(req);
    case 'png':
    case 'jpeg':
      return exportImage(req);
  }
}
