/**
 * serialize.ts — the single store<->record codec (STO-01, STO-02 / D-04).
 *
 * `serializeActiveProject` / `deserializeIntoStores` are the SOLE serialize and
 * deserialize path between the Zustand stores and a persisted `ProjectRecord`
 * (RESEARCH Pattern 5 — keep one pair so the two never drift). Autosave
 * (autosave.ts) and project restore both go through here, never around it.
 *
 * SCOPE: headless storage — NO React/Konva imports (`/storage` IS an engine
 * glob; importing the plain Zustand store objects to read their state is fine
 * — Zustand's `getState` is not a React hook). Zero network calls (OFF-03).
 * Named exports only.
 */
import { useDocumentStore } from '../state/documentStore';
import { useLayoutStore } from '../state/layoutStore';
import { SCHEMA_VERSION } from '../state/types';
import type { DocumentData, LayoutData } from '../state/types';
import type { ProjectRecord } from './types';

/**
 * Extract ONLY the plain-data `DocumentData` fields from the document store —
 * never the store object itself (which mixes data with action functions).
 */
function readDocumentData(): DocumentData {
  const s = useDocumentStore.getState();
  return { photos: s.photos, activePresetId: s.activePresetId };
}

/** Extract ONLY the plain-data `LayoutData` fields from the layout store. */
function readLayoutData(): LayoutData {
  const s = useLayoutStore.getState();
  return { paper: s.paper, cellGroups: s.cellGroups, spacing: s.spacing };
}

/**
 * Serialize the current document + layout stores into a `ProjectRecord` tagged
 * with the given identity. `assetIds` are derived from the photos so the
 * referenced `assets` rows can be located on restore.
 */
export function serializeActiveProject(id: string, name: string): ProjectRecord {
  const document = readDocumentData();
  const layout = readLayoutData();
  const now = Date.now();
  return {
    id,
    name,
    schemaVersion: SCHEMA_VERSION,
    documentJson: document,
    layoutJson: layout,
    assetIds: document.photos.map((p) => p.assetId),
    createdAt: now,
    updatedAt: now,
  };
}

