/**
 * types.ts — state-layer contract types (EDIT-10 / D-01, D-05).
 *
 * The shared contract every Phase 4 state and storage file builds against: the
 * Zustand stores (documentStore.ts, layoutStore.ts — plan 04-02/04-03), the
 * undo/redo history module (history.ts), the autosave serializer, and the
 * backup codec all import `SerializedProject`, `DocumentData`, `LayoutData`,
 * and `PhotoEntry` from here. Defining them first prevents a downstream
 * scavenger hunt and a parallel-creation conflict between plans 02 and 03.
 *
 * The document model is plain JSON-able data (D-01) — per-photo `Pipeline` op
 * lists and the layout spec, never decoded bitmaps. `SerializedProject` is
 * exactly what autosave persists and the backup bundle carries; it is
 * structuredClone-safe by construction (no functions, no Blobs, no bitmaps).
 *
 * SCOPE: type declarations only — no runtime logic, no DOM, no React. The
 * `EMPTY_DOCUMENT` / `EMPTY_LAYOUT` / `SCHEMA_VERSION` consts are pure data
 * for store initial state. `/state` is NOT an engine glob, but this file
 * imports only sibling type contracts. Named exports only.
 */

import type { Pipeline } from '../editor/pipeline/types';
import type { PaperSpec, CellGroup, SpacingOpts } from '../layout-engine/types';

/**
 * One imported photo in the document model — its asset reference plus the
 * serializable, non-destructive edit op list (D-01). The decoded `ImageBitmap`
 * is held in a separate runtime cache, never here (RESEARCH Pitfall 4).
 */
export interface PhotoEntry {
  /** Stable identifier for this photo within the document. */
  id: string;
  /** Foreign key into the `assets` IndexedDB table — the original Blob. */
  assetId: string;
  /** The serializable edit op list (crop geometry + Adjustment[]). */
  pipeline: Pipeline;
}

/**
 * The SERIALIZABLE slice of `documentStore` (D-05) — imported photos and the
 * active passport preset. Contains no actions and no decoded bitmaps; this is
 * the plain-data shape persisted in a project record.
 */
export interface DocumentData {
  /** Imported photos with their per-photo edit pipelines. */
  photos: PhotoEntry[];
  /** Id of the active passport/visa/ID preset. */
  activePresetId: string;
}

/**
 * The SERIALIZABLE slice of `layoutStore` (D-05) — the mm-first sheet spec.
 * Mirrors the layout-engine input contract; all dimensions are millimetres.
 */
export interface LayoutData {
  /** Paper dimensions, mm. */
  paper: PaperSpec;
  /** Photo cell groups (one per distinct photo size on the sheet). */
  cellGroups: CellGroup[];
  /** Margin and inter-cell gap, mm. */
  spacing: SpacingOpts;
}

/**
 * A complete persisted project — the document model plus layout, tagged with a
 * schema version for migration. This is exactly what autosave writes and the
 * backup bundle carries; it is plain data and structuredClone-safe.
 */
export interface SerializedProject {
  /** Schema version of this serialized shape — see `SCHEMA_VERSION`. */
  schemaVersion: number;
  /** Stable project identifier. */
  id: string;
  /** Human-readable project name. */
  name: string;
  /** The serializable documentStore slice. */
  document: DocumentData;
  /** The serializable layoutStore slice. */
  layout: LayoutData;
}

/** Current serialized-project schema version — bump on any breaking shape change. */
export const SCHEMA_VERSION = 1;

/** The default empty document state for store initialization (D-05). */
export const EMPTY_DOCUMENT: DocumentData = {
  photos: [],
  activePresetId: 'us-passport',
};

/**
 * The default empty layout state for store initialization (D-05) — a sensible
 * A4 sheet with conservative margins; all dimensions mm.
 */
export const EMPTY_LAYOUT: LayoutData = {
  // Default to 4R (4×6 in) photo paper — the most common size users print at.
  paper: { widthMm: 101.6, heightMm: 152.4 },
  cellGroups: [],
  // No inter-cell gap: photos pack flush. Visual separation between copies is
  // handled by the per-photo border option in the Layout view.
  spacing: { marginMm: 5, gapMm: 0 },
};
