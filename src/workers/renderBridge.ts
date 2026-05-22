/**
 * renderBridge.ts — main-thread RPC client for the render worker (D-01).
 *
 * `composeSheet` (the print-engine orchestrator) calls `renderSheet` to hand a
 * `RenderSpec` plus the photo-resolution inputs off to `render.worker.ts`; D-01
 * keeps 300 DPI compositing off the main thread. Each call correlates by a
 * unique `id`, mirroring the Phase 2 `bridge.ts` pattern, so concurrent calls
 * are independently tracked. `disposeWorker` releases the worker for D-01
 * memory hygiene.
 *
 * SCOPE: transport only — no compositing logic here. It MUST NOT import
 * React/Konva/ui (the `no-restricted-imports` engine rule covers
 * `src/workers/**`). Named exports only.
 */
import type { RenderRequest, RenderResponse } from './renderProtocol';
import type { RenderSpec } from '../print-engine/renderSpec';
import type { CellGroup } from '../layout-engine/types';
import type { PhotoEntry } from '../state/types';

/** Lazily-created singleton worker — spawned on first `renderSheet` call. */
let worker: Worker | null = null;

/**
 * In-flight requests keyed by request `id`. A worker-level `error` event
 * carries no `id` — it is a global worker-failure signal — so on `error` every
 * pending entry must be resolved (the WR-01 global-failure rule). Without this
 * shared registry an `error` would mis-attribute the failure to one caller.
 */
const pending = new Map<string, (res: RenderResponse) => void>();

/** Return the singleton worker, creating it on first use. */
function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL('./render.worker.ts', import.meta.url), {
    type: 'module',
  });
  // A response carrying a known `id` resolves exactly that caller.
  w.addEventListener('message', (e: MessageEvent<RenderResponse>): void => {
    const resolve = pending.get(e.data.id);
    if (!resolve) return; // unknown/stale id — nothing to resolve
    pending.delete(e.data.id);
    resolve(e.data);
  });
  // A worker-level `error` is a GLOBAL failure (e.g. module load failure) and
  // carries no request id: resolve EVERY in-flight caller as a `render-error`
  // and dispose the worker so the next call re-spawns a fresh one (WR-01).
  w.addEventListener('error', (): void => {
    const entries = [...pending.entries()];
    pending.clear();
    for (const [id, resolve] of entries) {
      resolve({ id, ok: false, reason: 'render-error' });
    }
    disposeWorker();
  });
  worker = w;
  return w;
}

/**
 * Send a render request to the render worker and resolve with its typed
 * response.
 *
 * Registers the call in the shared `pending` map keyed by a unique `id`, posts
 * a {@link RenderRequest} carrying the `RenderSpec` plus `cellGroups` + `photos`
 * (so the worker resolves each photo BY groupId, never by index), and resolves
 * when the matching response arrives. A worker-level `error` resolves the
 * promise as a `render-error` {@link RenderResponse}.
 *
 * @param spec       the px-space render plan for the sheet
 * @param cellGroups the layout's cell groups — the `groupId -> photoId` link
 * @param photos     the document's photos — resolved BY groupId, not by index
 * @param cutMarks   whether to rasterize corner-tick crop marks (D-07)
 * @returns the {@link RenderResponse} — `ok: true` success or `ok: false` error
 */
export async function renderSheet(
  spec: RenderSpec,
  cellGroups: CellGroup[],
  photos: PhotoEntry[],
  cutMarks: boolean,
): Promise<RenderResponse> {
  const w = getWorker();
  const id = crypto.randomUUID();

  return await new Promise<RenderResponse>((resolve) => {
    const req: RenderRequest = { id, spec, cellGroups, photos, cutMarks };
    // Register the pending entry only AFTER a successful post: if
    // `postMessage` throws synchronously (a non-cloneable value, or a worker
    // terminated between `getWorker()` and here) we must reject this caller
    // rather than leave a `pending` entry that never settles — a permanent
    // hang of `composeSheet` -> `exportImage` -> the UI (CR-03).
    try {
      w.postMessage(req);
    } catch {
      resolve({ id, ok: false, reason: 'render-error' });
      return;
    }
    pending.set(id, resolve);
  });
}

/**
 * Terminate the render worker and drop the reference (memory hygiene). Called
 * by the worker `error` handler; in-flight requests are drained as
 * `render-error` since a terminated worker fires no further events (WR-05).
 */
function disposeWorker(): void {
  worker?.terminate();
  worker = null;
  const entries = [...pending.entries()];
  pending.clear();
  for (const [id, resolve] of entries) {
    resolve({ id, ok: false, reason: 'render-error' });
  }
}

