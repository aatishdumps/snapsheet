/**
 * db.ts — the Dexie IndexedDB schema for SnapSheet (D-07).
 *
 * Defines a single `Dexie` subclass, database name `'phototool'`, with three
 * version(1) tables: `projects` (project metadata + serialized document/layout
 * state), `assets` (original photo Blobs — D-08), and `templates` (named,
 * reusable layout configs). The repositories under `repositories/` are the
 * only callers; the row shapes live in `./types`.
 *
 * SCOPE: headless storage — NO React/Konva imports. `/storage` IS an engine
 * glob; Dexie itself is permitted but `dexie-react-hooks` (`useLiveQuery`,
 * which imports React) is NOT — reactive selectors are deferred to the Phase 6
 * UI. This module makes zero network calls (OFF-03).
 *
 * Do NOT edit `version(1)` after release — a shipped schema is frozen. Any
 * future schema change MUST add a new `db.version(2).stores(...).upgrade(...)`
 * block; mutating version(1) corrupts existing user databases (Pitfall 3).
 *
 * Only fields you query or sort by are indexed — Blob/JSON payloads are not.
 */
import Dexie, { type EntityTable } from 'dexie';
import type {
  AssetRecord,
  ProjectRecord,
  TemplateRecord,
  PhotoAdjustmentRecord,
} from './types';

/**
 * The `phototool` IndexedDB database. Typed via `EntityTable<T, 'id'>` so each
 * table's primary key is `id` and rows are the contracts from `./types`.
 */
const db = new Dexie('phototool') as Dexie & {
  projects: EntityTable<ProjectRecord, 'id'>;
  assets: EntityTable<AssetRecord, 'id'>;
  templates: EntityTable<TemplateRecord, 'id'>;
  photoAdjustments: EntityTable<PhotoAdjustmentRecord, 'id'>;
};

// version(1) — FROZEN. Never edit; future changes add version(2). (Pitfall 3)
db.version(1).stores({
  projects: 'id, name, updatedAt',
  assets: 'id',
  templates: 'id, name, createdAt',
});

// version(2) — adds the `photoAdjustments` table for the DOM/CSS-filter UI:
// per-photo slider values + crop, persisted so edits survive a reload. The
// version(1) tables are repeated unchanged (Dexie requires the full schema).
db.version(2).stores({
  projects: 'id, name, updatedAt',
  assets: 'id',
  templates: 'id, name, createdAt',
  photoAdjustments: 'id',
});

export { db };
