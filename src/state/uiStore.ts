/**
 * uiStore.ts — the ephemeral UI Zustand store (D-05).
 *
 * Holds transient view-state only — the current `mode`, `selectionId` and
 * canvas `zoom`. `mode` (the active Import/Edit/Layout view, UI-01) is ephemeral
 * view-state exactly like `selectionId`/`zoom`: NOT persisted, NOT in the undo
 * snapshot, NOT an autosave trigger. Three constraints are LOAD-BEARING and must
 * never be violated:
 *   (1) NOT persisted — uiStore state is never written to IndexedDB; the
 *       persisted project is `documentStore` + `layoutStore` only (D-05).
 *   (2) NOT in the undo snapshot — selection/zoom changes are not undoable;
 *       the undo history (plan 04-04) snapshots the document model only.
 *   (3) NOT an autosave trigger — a selection or zoom change must not debounce
 *       an autosave write; only document/layout mutations do (plan 04-05).
 * Letting ephemeral UI state cross into serialization/snapshot would tamper
 * with the persisted project — threat T-04-05.
 *
 * SCOPE: state container only. `/state` is NOT an engine glob, so Zustand/immer
 * are permitted here. Uses the MANDATORY curried form
 * `create<UiState>()(immer(...))` — non-curried breaks inference (Pitfall 5).
 * Named exports only.
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

/** Ephemeral UI state — mode, selection and zoom — plus its mutating actions. */
export interface UiState {
  /** The active shell view (UI-01). Ephemeral — never persisted/snapshotted. */
  mode: 'import' | 'edit' | 'layout';
  /** Id of the currently selected photo, or null if nothing is selected. */
  selectionId: string | null;
  /** Current canvas zoom factor (1 = 100%). */
  zoom: number;
  /** Switch the active shell view. */
  setMode: (mode: UiState['mode']) => void;
  /** Select a photo by id. */
  setSelection: (id: string) => void;
  /** Clear the current selection. */
  clearSelection: () => void;
  /** Set the canvas zoom factor. */
  setZoom: (zoom: number) => void;
}

export const useUiStore = create<UiState>()(
  immer((set) => ({
    mode: 'import',
    selectionId: null,
    zoom: 1,

    setMode: (mode) =>
      set((s) => {
        s.mode = mode;
      }),

    setSelection: (id) =>
      set((s) => {
        s.selectionId = id;
      }),

    clearSelection: () =>
      set((s) => {
        s.selectionId = null;
      }),

    setZoom: (zoom) =>
      set((s) => {
        s.zoom = zoom;
      }),
  })),
);
