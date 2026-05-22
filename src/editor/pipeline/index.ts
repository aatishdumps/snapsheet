/**
 * pipeline — the non-destructive editor pipeline public surface (D-01..D-04).
 *
 * Re-exports the pipeline contract types, the `applyPipeline` ordered
 * evaluator, and the geometry resolver. The per-op `adjustments/*` modules are
 * intentionally NOT re-exported: the adjustment ops are internal to the
 * pipeline and `applyPipeline` is the public entry point. Named exports only.
 */
export * from './types';
export * from './applyPipeline';
export * from './geometry';
