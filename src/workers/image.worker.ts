/**
 * image.worker.ts — Web Worker hosting the CPU-heavy import stages
 * (D-03, D-09, D-11 / IMP-06).
 *
 * D-03: decode (incl. lazy HEIC WASM) and the Pica downscale (D-09) run here,
 * off the main thread, so a heavy decode never freezes the UI. D-11: decoded
 * bitmaps cross the boundary on the transferables list — they move, not copy.
 *
 * SCOPE: transport + stage sequencing only — all decode/bake/resize logic lives
 * in `src/editor/import/*`; this worker stays thin. It MUST NOT import
 * React/Konva/ui (the `no-restricted-imports` engine rule covers
 * `src/workers/**`).
 */
import { sniffFormat } from '../editor/import/sniff';
import { decode } from '../editor/import/decode';
import { bakeUpright } from '../editor/import/orientation';
import { toWorkingCopy } from '../editor/import/downscale';
import type { WorkerRequest, WorkerResponse } from './protocol';

/**
 * The dedicated-worker global scope, narrowed to just what this worker uses.
 * The project's tsconfig `lib` is `["ES2023", "DOM"]` (no `WebWorker` lib, so
 * `DedicatedWorkerGlobalScope` is not declared globally); this local type lets
 * the thin transport layer stay typed without pulling the whole `WebWorker`
 * lib in and clashing with `DOM`'s `self`/`postMessage` declarations.
 */
interface WorkerScope {
  postMessage(message: WorkerResponse, transfer: Transferable[]): void;
  onmessage:
    | ((e: MessageEvent<WorkerRequest>) => void | Promise<void>)
    | null;
}

/** This module runs as a dedicated worker — `self` IS the worker scope. */
const ctx = self as unknown as WorkerScope;

/** Post a typed response back to the main thread. */
function reply(msg: WorkerResponse, transfer: Transferable[] = []): void {
  ctx.postMessage(msg, transfer);
}

ctx.onmessage = async (e: MessageEvent<WorkerRequest>): Promise<void> => {
  // The ENTIRE handler body is wrapped in try/catch: `ctx.onmessage` is an
  // async handler, so any rejection that escapes here becomes an unhandled
  // promise rejection that never fires the worker's `error` event and never
  // resolves the bridge promise — hanging the whole sequential pipeline
  // (CR-01). Stage 1 (sniff) must be inside the guard, not before it.
  const { id, file, maxEdge } = e.data;

  try {
    // Stage 1: signature-byte sniff (D-04). Unsupported -> typed error, no decode.
    const format = await sniffFormat(file);
    if (format === 'unsupported') {
      reply({ id, ok: false, reason: 'unsupported-format' });
      return;
    }

    // Stage 2: decode to a full-res bitmap (HEIC takes the lazy-WASM branch).
    const decoded = await decode(file, format);
    // Stage 3: bake EXIF orientation upright (D-15); may close `decoded`.
    const original = await bakeUpright(file, decoded);
    // Stage 4: Pica downscale to the editor working copy (D-08/D-09).
    // `toWorkingCopy` returns `original` unchanged when the image already
    // fits, so `working` may be the SAME object as `original`.
    const working = await toWorkingCopy(original, maxEdge);

    // Pitfall 5 / D-11: transfer the bitmaps — they move, not copy. Dedupe so
    // the same object is never listed twice (working === original when small).
    const transfer: Transferable[] =
      working === original ? [original] : [original, working];

    reply(
      {
        id,
        ok: true,
        original,
        working,
        format,
        originalDims: { w: original.width, h: original.height },
      },
      transfer,
    );
  } catch (err) {
    // A throw mid-pipeline means the bytes were bad or a stage failed. Surface
    // the real error — a bare 'decode-error' is undiagnosable.
    const detail =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error('[image worker] import pipeline failed:', err);
    reply({ id, ok: false, reason: 'decode-error', detail });
  }
};
