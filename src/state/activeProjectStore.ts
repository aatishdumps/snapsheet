/**
 * activeProjectStore.ts — the single active-project identity store
 * (D-04 / RESEARCH Open Question 2 — RESOLVED: single active project for v1).
 *
 * v1 has exactly ONE active project at a time. This store holds its identity
 * — `{ id, name }` — and nothing else. New-project / save-as / restore flows
 * call `setActiveProject` to redirect autosave: the autosave writer (plan
 * 04-05 autosave.ts) reads the identity from THIS store on each debounced save
 * rather than freezing it at `startAutosave` call time, so switching the active
 * project correctly redirects subsequent autosaves (threat T-04-17).
 *
 * SCOPE: identity only — it holds the id+name of the ONE active project; it is
 * NOT itself persisted to IndexedDB, NOT part of the undo/redo snapshot, and is
 * network-free. `/state` is NOT an engine glob, so Zustand/immer are permitted.
 * Uses the MANDATORY curried form `create<ActiveProjectState>()(immer(...))` —
 * non-curried breaks immer-middleware type inference (Pitfall 5). Named exports
 * only.
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

/**
 * A generated default id for the implicit first active project. crypto.randomUUID
 * is available in every modern browser and in the Node test runner; the fallback
 * keeps the store usable in any odd environment without throwing.
 */
function generateDefaultId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `project-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** The active-project identity store — id + name plus its setter. */
export interface ActiveProjectState {
  /** Stable id of the single active project. */
  id: string;
  /** Human-readable name of the single active project. */
  name: string;
  /** Replace the active-project identity — redirects subsequent autosaves. */
  setActiveProject: (id: string, name: string) => void;
}

export const useActiveProjectStore = create<ActiveProjectState>()(
  immer((set) => ({
    id: generateDefaultId(),
    name: 'Untitled',
    setActiveProject: (id, name) =>
      set((s) => {
        s.id = id;
        s.name = name;
      }),
  })),
);
