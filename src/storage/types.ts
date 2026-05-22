/**
 * types.ts — storage-layer Dexie row contracts (STO-01..05 / D-07, D-08).
 *
 * The shared row-shape contract every Phase 4 storage file builds against: the
 * Dexie schema (db.ts), the repositories (projectRepo/assetRepo/templateRepo),
 * autosave, and the backup codec all import `ProjectRecord`, `AssetRecord`,
 * and `TemplateRecord` from here. Defining them first prevents a downstream
 * scavenger hunt.
 *
 * Original photos are stored as compressed `Blob`s in the `assets` table (D-08)
 * — never base64 strings (≈33% bloat) and never decoded `ImageBitmap`s. Base64
 * appears only inside the downloadable backup file, never in IndexedDB.
 *
 * SCOPE: type-only — pure `interface` declarations, zero runtime code. This
 * file is therefore TEST-EXEMPT from the house "every source file gets a
 * sibling test" rule; `tsc -b --noEmit` is its sole verification gate. `/storage`
 * IS an engine glob — no React/Konva imports (Dexie types are permitted, but
 * this file needs none). Named exports only.
 */

/**
 * A persisted project row in the `projects` table — metadata plus the
 * serialized document and layout state, and the FK list of referenced assets.
 */
export interface ProjectRecord {
  /** Primary key — stable project identifier. */
  id: string;
  /** Human-readable project name. */
  name: string;
  /** Schema version of the serialized document/layout payloads. */
  schemaVersion: number;
  /** Serialized `documentStore` data (plain JSON — DocumentData shape). */
  documentJson: unknown;
  /** Serialized `layoutStore` data (plain JSON — LayoutData shape). */
  layoutJson: unknown;
  /** Foreign-key list into the `assets` table. */
  assetIds: string[];
  /** Creation timestamp, epoch milliseconds. */
  createdAt: number;
  /** Last-modified timestamp, epoch milliseconds — indexed for history sort. */
  updatedAt: number;
}

/**
 * An original-photo row in the `assets` table. The photo is a compressed
 * `Blob` — NEVER base64 in IndexedDB (D-08); base64 is for the backup file only.
 */
export interface AssetRecord {
  /** Primary key — stable asset identifier, referenced by `ProjectRecord.assetIds`. */
  id: string;
  /** The compressed original photo — a raw Blob, never base64 (D-08). */
  blob: Blob;
  /** Original file name as imported. */
  fileName: string;
  /** MIME type of the stored Blob. */
  mimeType: string;
}

/**
 * A per-photo adjustment row in the `photoAdjustments` table (DB version 2).
 *
 * Holds the DOM/CSS-filter UI's slider values + crop for one photo, keyed by
 * the `PhotoEntry.id`. Stored as opaque JSON (`values`) so the UI owns the
 * shape — the storage layer treats it as plain serializable data. Persisted so
 * adjustments survive a reload.
 */
export interface PhotoAdjustmentRecord {
  /** Primary key — the `PhotoEntry.id` this adjustment set belongs to. */
  id: string;
  /** The UI-owned adjustment values (plain JSON — `PhotoAdjustments` shape). */
  values: unknown;
}

/**
 * A reusable layout/preset template row in the `templates` table — a named,
 * apply-able layout config (paper size, preset, copy counts, spacing, margins).
 */
export interface TemplateRecord {
  /** Primary key — stable template identifier. */
  id: string;
  /** Human-readable template name. */
  name: string;
  /** The reusable layout config payload (plain JSON). */
  config: unknown;
  /** Creation timestamp, epoch milliseconds. */
  createdAt: number;
}
