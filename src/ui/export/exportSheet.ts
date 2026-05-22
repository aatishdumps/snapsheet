/**
 * exportSheet.ts — bake every photo, then export via the export-engine.
 *
 * The bridge between the DOM/CSS-filter UI and the project's `runExport`. CSS
 * filters do not pixel-match the engine's custom adjustment math, so instead of
 * routing slider values through `Pipeline.adjustments` we BAKE each photo (crop
 * + rotate/flip + `ctx.filter`) to a flat bitmap — the task-sanctioned fallback
 * — register those baked bitmaps as temporary assets, and feed a derived
 * `SerializedProject` (photos pointing at the baked assets, `EMPTY_PIPELINE`)
 * to the unchanged `runExport`. This preserves the export-engine's 300-DPI
 * `pHYs`/JFIF metadata and pdf-lib point geometry while guaranteeing the
 * exported sheet matches the on-screen preview.
 *
 * SCOPE: orchestration in `/ui` — canvas/DOM permitted. Named exports only.
 */
import { runExport, type ExportFormat, type ExportResult } from '../../export-engine';
import { EMPTY_PIPELINE } from '../../editor';
import {
  putBitmap,
  deleteBitmap,
  useDocumentStore,
  useLayoutStore,
  useActiveProjectStore,
} from '../../state';
import { assetRepo } from '../../storage';
import { SCHEMA_VERSION, type SerializedProject } from '../../state';
import { useAdjustmentsStore } from '../state/adjustmentsStore';
import { bakePhoto, addBorder } from '../photo/bakePhoto';

/** A sheet-export request from the Layout view. */
export interface ExportSheetOptions {
  /** Output format. */
  format: ExportFormat;
  /** Render corner crop marks. */
  cutMarks?: boolean;
  /** JPEG quality 0–1 (jpeg only). */
  jpgQuality?: number;
  /** Border thickness baked around every photo cell, mm (`0` = no border). */
  borderMm?: number;
  /** Border color (any CSS color); used only when `borderMm > 0`. */
  borderColor?: string;
}

/**
 * Bake all photos referenced by the current layout and run a sheet export.
 *
 * Baked assets are written to the `assets` table under fresh ids and dropped
 * from the bitmap cache afterwards — they exist only for the lifetime of one
 * export and never pollute the persisted document model.
 */
export async function exportSheet(
  opts: ExportSheetOptions,
): Promise<ExportResult> {
  const doc = useDocumentStore.getState();
  const layout = useLayoutStore.getState();
  const active = useActiveProjectStore.getState();
  const adjStore = useAdjustmentsStore.getState();

  // Bake every photo referenced by a cell group; map original id → baked id.
  const referencedPhotoIds = new Set(layout.cellGroups.map((g) => g.photoId));
  const bakedAssetIds: string[] = [];
  const idMap = new Map<string, string>();

  try {
    for (const photo of doc.photos) {
      if (!referencedPhotoIds.has(photo.id)) continue;
      const adj = adjStore.get(photo.id);
      let baked = await bakePhoto(photo.assetId, adj);
      if (!baked) {
        return { ok: false, reason: 'asset-missing' };
      }
      // Bake a sheet-wide border into the cell bitmap when requested. The cell
      // size is the photo's CellGroup mm size, so the border prints at a true
      // physical thickness.
      if (opts.borderMm && opts.borderMm > 0) {
        const group = layout.cellGroups.find((g) => g.photoId === photo.id);
        if (group) {
          baked = await addBorder(
            baked,
            group.size.widthMm,
            group.size.heightMm,
            opts.borderMm,
            opts.borderColor ?? '#000000',
          );
        }
      }
      const bakedId = `baked-${photo.id}-${Date.now().toString(36)}`;
      putBitmap(bakedId, baked.bitmap);
      await assetRepo.putBlob({
        id: bakedId,
        blob: baked.blob,
        fileName: `${bakedId}.png`,
        mimeType: 'image/png',
      });
      bakedAssetIds.push(bakedId);
      idMap.set(photo.id, bakedId);
    }

    // Derived project: photos point at baked assets with an identity pipeline.
    const project: SerializedProject = {
      schemaVersion: SCHEMA_VERSION,
      id: active.id,
      name: active.name,
      document: {
        activePresetId: doc.activePresetId,
        photos: doc.photos
          .filter((p) => idMap.has(p.id))
          .map((p) => ({
            id: p.id,
            assetId: idMap.get(p.id)!,
            pipeline: EMPTY_PIPELINE,
          })),
      },
      layout: {
        paper: layout.paper,
        cellGroups: layout.cellGroups,
        spacing: layout.spacing,
      },
    };

    return await runExport({
      project,
      format: opts.format,
      scope: 'sheet',
      cutMarks: opts.cutMarks ?? false,
      jpgQuality: opts.jpgQuality,
    });
  } finally {
    // Clean up the throw-away baked assets — they served one export only.
    for (const id of bakedAssetIds) {
      deleteBitmap(id);
      void assetRepo.remove(id);
    }
  }
}
