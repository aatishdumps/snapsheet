/**
 * bridge.ts — main-thread RPC client for the image worker (D-03, D-11 / IMP-06).
 *
 * The import pipeline (plan 02-04) calls `processInWorker` to hand a file off
 * to `image.worker.ts`; D-03 keeps the heavy decode/HEIC/downscale work off the
 * main thread. Each call correlates by a unique `id`, so concurrent calls are
 * safe even though the pipeline drives them sequentially (RESEARCH Pattern 4).
 * `disposeWorker` lets callers release the worker for D-11 memory hygiene.
 *
 * SCOPE: transport only — no decode logic here. It MUST NOT import
 * React/Konva/ui (the `no-restricted-imports` engine rule covers
 * `src/workers/**`).
 */
import type { WorkerRequest, WorkerResponse } from './protocol';

/** Lazily-created singleton worker — spawned on first `processInWorker` call. */
let worker: Worker | null = null;

/**
 * In-flight requests keyed by request `id`. A worker-level `error` event
 * carries no `id` — it is a global worker-failure signal — so on `error` every
 * pending entry must be rejected (WR-01). Without this shared registry an
 * `error` event would only resolve whichever per-call closure happened to be
 * registered, mis-attributing the failure to the wrong caller.
 */
const pending = new Map<string, (res: WorkerResponse) => void>();

/** Return the singleton worker, creating it on first use. */
function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL('./image.worker.ts', import.meta.url), {
    type: 'module',
  });
  // A response carrying a known `id` resolves exactly that caller.
  w.addEventListener('message', (e: MessageEvent<WorkerResponse>): void => {
    const resolve = pending.get(e.data.id);
    if (!resolve) return; // unknown/stale id — nothing to resolve
    pending.delete(e.data.id);
    resolve(e.data);
  });
  // A worker-level `error` is a GLOBAL failure (e.g. module load failure) and
  // carries no request id: resolve EVERY in-flight caller as a `decode-error`
  // and dispose the worker so the next call re-spawns a fresh one. A worker
  // left broken would otherwise fail every subsequent call (WR-01).
  w.addEventListener('error', (): void => {
    const entries = [...pending.entries()];
    pending.clear();
    for (const [id, resolve] of entries) {
      resolve({ id, ok: false, reason: 'decode-error' });
    }
    disposeWorker();
  });
  worker = w;
  return w;
}

/**
 * Send a file to the image worker and resolve with its typed response.
 *
 * Registers the call in the shared `pending` map keyed by a unique `id`, posts
 * a {@link WorkerRequest}, and resolves when the matching response arrives. A
 * worker-level `error` event resolves the promise as a `decode-error`
 * {@link WorkerResponse} so callers always get a typed result. Concurrent calls
 * are safe — each is correlated independently by `id`.
 *
 * @param file    the imported file to decode, bake upright, and downscale
 * @param maxEdge working-copy longest-edge target in pixels (D-08)
 * @returns the {@link WorkerResponse} — `ok: true` success or `ok: false` error
 */
export async function processInWorker(
  file: File,
  maxEdge: number,
): Promise<WorkerResponse> {
  const w = getWorker();
  const id = crypto.randomUUID();

  return await new Promise<WorkerResponse>((resolve) => {
    pending.set(id, resolve);
    const req: WorkerRequest = { id, file, maxEdge };
    w.postMessage(req);
  });
}

/**
 * Terminate the image worker and drop the reference (memory hygiene). The next
 * {@link processInWorker} call transparently re-spawns it. Called by the
 * worker `error` handler so a crashed worker does not poison later calls.
 */
function disposeWorker(): void {
  worker?.terminate();
  worker = null;
}

