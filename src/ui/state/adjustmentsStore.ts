/**
 * adjustmentsStore.ts — the UI store for per-photo CSS-filter adjustments.
 *
 * Keyed by `PhotoEntry.id`. Holds the live `PhotoAdjustments` for every photo
 * plus a small per-photo undo stack. Every mutation also schedules a debounced
 * write to the `photoAdjustments` Dexie table so edits survive a reload.
 *
 * SCOPE: a UI state container. Lives in `/ui` (React/Zustand permitted here).
 * Named exports only.
 */
import { create } from 'zustand';
import { photoAdjustmentRepo } from '../../storage';
import {
  DEFAULT_ADJUSTMENTS,
  isPhotoAdjustments,
  type PhotoAdjustments,
} from './photoAdjustments';

/** Per-photo entry: the current value plus a bounded undo history. */
interface Entry {
  current: PhotoAdjustments;
  history: PhotoAdjustments[];
}

interface AdjustmentsState {
  /** Map of photoId → its adjustment entry. */
  entries: Record<string, Entry>;
  /** Read one photo's current adjustments (defaults if unseen). */
  get: (photoId: string) => PhotoAdjustments;
  /** Patch one photo's adjustments — pushes the prior value onto history. */
  patch: (photoId: string, patch: Partial<PhotoAdjustments>) => void;
  /** Undo the last change for a photo; no-op if history is empty. */
  undo: (photoId: string) => void;
  /** Reset a photo to the identity adjustments. */
  reset: (photoId: string) => void;
  /** True if a photo has an undoable change. */
  canUndo: (photoId: string) => boolean;
  /** Rehydrate every saved adjustment row from IndexedDB (called at boot). */
  hydrate: () => Promise<void>;
}

/** Max undo depth per photo — bounds memory for long editing sessions. */
const HISTORY_CAP = 30;

/** Debounce timers for persistence, keyed by photoId. */
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Debounce a write of one photo's adjustments to IndexedDB. */
function schedulePersist(photoId: string, values: PhotoAdjustments): void {
  const existing = saveTimers.get(photoId);
  if (existing) clearTimeout(existing);
  saveTimers.set(
    photoId,
    setTimeout(() => {
      saveTimers.delete(photoId);
      void photoAdjustmentRepo.put({ id: photoId, values });
    }, 500),
  );
}

export const useAdjustmentsStore = create<AdjustmentsState>()((set, getState) => ({
  entries: {},

  get: (photoId) =>
    getState().entries[photoId]?.current ?? DEFAULT_ADJUSTMENTS,

  patch: (photoId, patch) =>
    set((s) => {
      const prev = s.entries[photoId]?.current ?? DEFAULT_ADJUSTMENTS;
      const prevHist = s.entries[photoId]?.history ?? [];
      const next: PhotoAdjustments = { ...prev, ...patch };
      const history = [...prevHist, prev].slice(-HISTORY_CAP);
      schedulePersist(photoId, next);
      return {
        entries: { ...s.entries, [photoId]: { current: next, history } },
      };
    }),

  undo: (photoId) =>
    set((s) => {
      const entry = s.entries[photoId];
      if (!entry || entry.history.length === 0) return s;
      const history = entry.history.slice();
      const restored = history.pop()!;
      schedulePersist(photoId, restored);
      return {
        entries: {
          ...s.entries,
          [photoId]: { current: restored, history },
        },
      };
    }),

  reset: (photoId) =>
    set((s) => {
      const prev = s.entries[photoId]?.current ?? DEFAULT_ADJUSTMENTS;
      const prevHist = s.entries[photoId]?.history ?? [];
      const history = [...prevHist, prev].slice(-HISTORY_CAP);
      schedulePersist(photoId, DEFAULT_ADJUSTMENTS);
      return {
        entries: {
          ...s.entries,
          [photoId]: { current: { ...DEFAULT_ADJUSTMENTS }, history },
        },
      };
    }),

  canUndo: (photoId) => (getState().entries[photoId]?.history.length ?? 0) > 0,

  hydrate: async () => {
    const rows = await photoAdjustmentRepo.getAll();
    const entries: Record<string, Entry> = {};
    for (const row of rows) {
      if (isPhotoAdjustments(row.values)) {
        entries[row.id] = { current: row.values, history: [] };
      }
    }
    set((s) => ({ entries: { ...entries, ...s.entries } }));
  },
}));
