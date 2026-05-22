/**
 * export-engine — PNG/JPG/PDF emitters at exact 300 DPI / physical size
 * (EXP-02/03/04).
 *
 * The public surface of the Phase 5 export layer: the `runExport` format
 * router, the three emitters (`exportImage` for PNG/JPG, `exportPdf` for PDF),
 * the `ExportRequest`/`ExportResult` contract, and the DPI-metadata / EXIF byte
 * utilities. Workers are entry points and are NOT re-exported here.
 *
 * SCOPE: a flat re-export barrel — no runtime logic. Named exports only.
 */
export * from './types';
export * from './exportImage';
export * from './exportPdf';
export * from './exportEngine';
export * from './dpi-metadata';
export * from './stripExif';
