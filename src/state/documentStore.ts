/**
 * documentStore.ts — the document Zustand store (EDIT-10 / D-05, D-06).
 *
 * Holds the SERIALIZABLE document slice (D-05): the imported `photos[]` with
 * their per-photo non-destructive edit `Pipeline`s, plus the `activePresetId`.
 * This is exactly the `DocumentData` shape the undo/redo history (plan 04-04)
 * snapshots and the autosave serializer (plan 04-05) persists — plain JSON-able
 * data, structuredClone-safe, no functions in the data slices, no bitmaps.
 *
 * SCOPE: state container only. Stores call the Phase 3 engines; engines never
 * import stores (D-06 — one-way data flow). `/state` is NOT an engine glob, so
 * Zustand/immer are permitted here. Live decoded `ImageBitmap`s are NOT held in
 * this store — they live in the runtime `bitmapCache.ts` Map, keyed by
 * `assetId`, so snapshot/serialize paths stay structuredClone-safe (Pitfall 4).
 *
 * Uses the MANDATORY curried form `create<DocumentState>()(immer(...))` — the
 * non-curried `create<T>(...)` breaks immer-middleware type inference (Pitfall 5).
 * Named exports only.
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Pipeline } from '../editor/pipeline/types';
import { deleteBitmap } from './bitmapCache';
import type { DocumentData, PhotoEntry } from './types';
import { EMPTY_DOCUMENT } from './types';

/** The document store: serializable `DocumentData` plus its mutating actions. */
export interface DocumentState extends DocumentData {
  /** Append an imported photo to the document. */
  addPhoto: (entry: PhotoEntry) => void;
  /** Replace the matching photo's pipeline; unknown id is a silent no-op. */
  updatePipeline: (photoId: string, next: Pipeline) => void;
  /** Remove the matching photo; unknown id is a silent no-op. */
  removePhoto: (photoId: string) => void;
  /** Set the active passport/visa/ID preset id. */
  setActivePreset: (presetId: string) => void;
  /** Swap the whole document data — used by undo apply and project restore. */
  replaceDocument: (data: DocumentData) => void;
}

export const useDocumentStore = create<DocumentState>()(
  immer((set) => ({
    ...EMPTY_DOCUMENT,

    addPhoto: (entry) =>
      set((s) => {
        s.photos.push(entry);
      }),

    updatePipeline: (photoId, next) =>
      set((s) => {
        const photo = s.photos.find((p) => p.id === photoId);
        if (photo) photo.pipeline = next;
      }),

    removePhoto: (photoId) =>
      set((s) => {
        const removed = s.photos.find((p) => p.id === photoId);
        s.photos = s.photos.filter((p) => p.id !== photoId);
        // Release the removed photo's decoded bitmap — an `ImageBitmap` holds
        // non-GC'd GPU memory, so dropping the `PhotoEntry` without closing it
        // leaks (Pitfall 4 / finding WR-06). Guard against a second photo
        // still referencing the same asset id.
        if (removed && !s.photos.some((p) => p.assetId === removed.assetId)) {
          deleteBitmap(removed.assetId);
        }
      }),

    setActivePreset: (presetId) =>
      set((s) => {
        s.activePresetId = presetId;
      }),

    replaceDocument: (data) =>
      set((s) => {
        // `data` may be externally owned (a cached `TemplateRecord`, a
        // `ProjectRecord`'s `documentJson`). Deep-clone so the store never
        // shares a mutable reference with the caller's object (WR-04).
        s.photos = structuredClone(data.photos);
        s.activePresetId = data.activePresetId;
      }),
  })),
);
