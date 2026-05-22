/**
 * index.ts — storage-layer public API barrel (STO-01..05 / D-07).
 *
 * The single public entry point for the `/storage` layer: the Dexie database
 * handle, the persistence (eviction-defense) helpers, the store<->record codec,
 * the debounced autosave, the repositories, and the DB row contract types.
 *
 * SCOPE: re-exports only — no logic of its own. Named exports only (house
 * rule); the repository modules are namespaced re-exports because their
 * function names (`save`, `get`, `remove`, ...) collide. `/storage` IS an
 * engine glob — no React imports — and the whole tree is network-free (OFF-03).
 */

// Dexie database handle.
export { db } from './db';

// Eviction-defense persistence helper (D-13).
export { requestPersistence } from './persistence';

// The store->record serialize codec (Pattern 5).
export { serializeActiveProject } from './serialize';

// Debounced autosave (STO-01 / D-04).
export { startAutosave } from './autosave';

// Repositories — namespaced re-exports (their function names collide).
export * as projectRepo from './repositories/projectRepo';
export * as assetRepo from './repositories/assetRepo';
export * as photoAdjustmentRepo from './repositories/photoAdjustmentRepo';

// DB row contract types.
export type {
  ProjectRecord,
  AssetRecord,
  PhotoAdjustmentRecord,
} from './types';
