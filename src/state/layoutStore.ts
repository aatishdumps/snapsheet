/**
 * layoutStore.ts — the layout Zustand store (D-05, D-06).
 *
 * Holds the SERIALIZABLE layout slice (D-05): the mm-first sheet spec — `paper`
 * dimensions, the per-photo-size `cellGroups`, and `spacing` (margin + gap).
 * This is exactly the `LayoutData` shape the undo/redo history (plan 04-04)
 * snapshots and the autosave serializer (plan 04-05) persists — plain data,
 * structuredClone-safe. All dimensions are millimetres (mm-first; no px math).
 *
 * SCOPE: state container only. The store calls the Phase 3 layout engine;
 * the engine never imports this store (D-06 — one-way data flow). `/state` is
 * NOT an engine glob, so Zustand/immer are permitted here.
 *
 * Uses the MANDATORY curried form `create<LayoutState>()(immer(...))` — the
 * non-curried `create<T>(...)` breaks immer-middleware type inference (Pitfall 5).
 * Named exports only.
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { CellGroup, PaperSpec, SpacingOpts } from '../layout-engine/types';
import type { LayoutData } from './types';
import { EMPTY_LAYOUT } from './types';

/** The layout store: serializable `LayoutData` plus its mutating actions. */
export interface LayoutState extends LayoutData {
  /** Replace the paper spec (mm). */
  setPaper: (spec: PaperSpec) => void;
  /** Replace the spacing opts — margin and inter-cell gap (mm). */
  setSpacing: (opts: SpacingOpts) => void;
  /** Replace the cell-group array (one group per distinct photo size). */
  setCellGroups: (groups: CellGroup[]) => void;
  /** Swap the whole layout data — used by undo apply and project restore. */
  replaceLayout: (data: LayoutData) => void;
}

export const useLayoutStore = create<LayoutState>()(
  immer((set) => ({
    ...EMPTY_LAYOUT,

    setPaper: (spec) =>
      set((s) => {
        s.paper = spec;
      }),

    setSpacing: (opts) =>
      set((s) => {
        s.spacing = opts;
      }),

    setCellGroups: (groups) =>
      set((s) => {
        s.cellGroups = groups;
      }),

    replaceLayout: (data) =>
      set((s) => {
        // `data` may be externally owned (a cached `TemplateRecord`'s config,
        // a `ProjectRecord`'s `layoutJson`). Deep-clone so the store never
        // shares a mutable reference with the caller's object (WR-04).
        s.paper = structuredClone(data.paper);
        s.cellGroups = structuredClone(data.cellGroups);
        s.spacing = structuredClone(data.spacing);
      }),
  })),
);
