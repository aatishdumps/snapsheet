/**
 * autosave.ts — the debounced project autosave writer (STO-01 / D-04).
 *
 * Subscribes to the document and layout stores; on any change it schedules a
 * debounced (~800ms) last-state write of the CURRENT active project to
 * IndexedDB via `projectRepo.save`. `put` overwrites the same row (D-04) — a
 * snapshot, not an append log.
 *
 * IDENTITY IS NOT FROZEN (RESEARCH Open Question 2): `startAutosave` takes NO
 * project arguments. Each debounced save reads `useActiveProjectStore.getState()`
 * for the current `{ id, name }`, so a new-project / save-as / restore that
 * calls `setActiveProject` correctly redirects subsequent autosaves
 * (threat T-04-17).
 *
 * UNDO INTERACTION: plan 04-04's `history.ts` undo()/redo() apply via
 * `replaceDocument`/`replaceLayout`, which fire the same documentStore/
 * layoutStore subscribe callbacks wired here — so an undo WILL schedule an
 * autosave. This is INTENDED: an undone state is the new last-state worth
 * persisting. It is not suppressed; autosave.test.ts covers it explicitly.
 *
 * SCOPE: headless storage — NO React/Konva imports (`/storage` IS an engine
 * glob). `useDocumentStore.subscribe` is Zustand's STANDALONE subscribe, not a
 * React hook, so it is permitted here. The ephemeral UI store is deliberately
 * NOT subscribed — selection/zoom must never trigger a write. Zero
 * network calls (OFF-03). Named exports only.
 */
import { useActiveProjectStore } from '../state/activeProjectStore';
import { useDocumentStore } from '../state/documentStore';
import { useLayoutStore } from '../state/layoutStore';
import * as projectRepo from './repositories/projectRepo';
import { serializeActiveProject } from './serialize';

/**
 * Autosave debounce window, milliseconds. 800ms coalesces a burst of edits
 * (slider drags, rapid typing) into a single write while still feeling
 * near-immediate — within RESEARCH D-04's ~800ms guidance (Claude's discretion).
 */
const AUTOSAVE_DEBOUNCE_MS = 800;

/** The pending debounce timer — module-level so it is cancellable. */
let timer: ReturnType<typeof setTimeout> | undefined;

/**
 * Write the CURRENT active project to IndexedDB. Reads identity from
 * `activeProjectStore` at call time (never frozen) so a project switch
 * redirects the write.
 */
function saveNow(): void {
  const { id, name } = useActiveProjectStore.getState();
  void projectRepo.save(serializeActiveProject(id, name));
}

/** Debounce a save — a fresh change within the window restarts the timer. */
function scheduleSave(): void {
  clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    saveNow();
  }, AUTOSAVE_DEBOUNCE_MS);
}

/**
 * Start autosave: subscribe to the document and layout stores so any change
 * schedules a debounced write of the current active project. Takes NO project
 * arguments — identity is read from `activeProjectStore` on each save. Returns
 * a cleanup function that unsubscribes both stores and cancels the timer.
 */
export function startAutosave(): () => void {
  const unsubDoc = useDocumentStore.subscribe(scheduleSave);
  const unsubLayout = useLayoutStore.subscribe(scheduleSave);
  return () => {
    unsubDoc();
    unsubLayout();
    clearTimeout(timer);
    timer = undefined;
  };
}
