/**
 * pipeline.ts — batch import orchestrator (D-10, D-12, D-13 / IMP-04, IMP-07).
 *
 * `importFiles` is the public entry point of the import module: an async
 * generator that drives the fixed decode/normalize pipeline over a batch of
 * user files, one file at a time, and yields an {@link ImportEvent} for each
 * outcome. It realizes three Phase 2 decisions:
 *   - D-12: per-file failures become an {@link ImportFailure} and the batch
 *     continues (skip-and-continue) — one bad file never blocks the rest.
 *   - D-13: a batch past the soft cap emits an {@link ImportWarning} first —
 *     the user is informed, nothing is silently dropped or blocked.
 *   - D-10: each {@link ImportResult} carries the source `File` as
 *     `sourceMeta.blob`, so Phase 4 can persist it to IndexedDB with no caller
 *     change.
 *
 * SCOPE: orchestration only — decode/EXIF-bake/downscale live in the worker
 * (`workers/image.worker.ts`, reached via `processInWorker`). Files are
 * processed strictly sequentially (`for...of`, never `Promise.all`) to bound
 * mobile memory — Pitfall 1. This module MUST NOT import React/Konva/ui (the
 * `no-restricted-imports` engine rule covers `src/editor/**`). Named exports only.
 */
import { processInWorker } from '../../workers/bridge';
import type { ImportEvent, ImportOpts } from './types';

/** Default soft cap — warn past this many files in one batch (D-13). */
const DEFAULT_SOFT_CAP = 10;
/** Default working-copy longest-edge target in pixels (D-08). */
const DEFAULT_MAX_EDGE = 2000;

/**
 * Import a batch of files, yielding one {@link ImportEvent} per outcome.
 *
 * Emits an {@link ImportWarning} first if the batch exceeds `softCap`, then
 * processes each file sequentially through the image worker. A successful
 * decode yields an {@link ImportResult}; a worker-reported failure or a thrown
 * error yields an {@link ImportFailure} and the loop continues (D-12).
 *
 * @param files the batch of user-supplied files to import
 * @param opts  optional `softCap` (default 10) and `maxEdge` (default 2000)
 * @returns an async generator of {@link ImportEvent}s — narrow on `kind`
 */
export async function* importFiles(
  files: File[],
  opts: ImportOpts = {},
): AsyncGenerator<ImportEvent> {
  const softCap = opts.softCap ?? DEFAULT_SOFT_CAP;
  const maxEdge = opts.maxEdge ?? DEFAULT_MAX_EDGE;

  if (files.length > softCap) {
    yield { kind: 'warning', count: files.length, softCap };
  }

  // Sequential — never Promise.all (Pitfall 1: bounds mobile memory).
  for (const file of files) {
    try {
      const res = await processInWorker(file, maxEdge);
      if (res.ok === false) {
        yield {
          kind: 'failure',
          fileName: file.name,
          reason: res.reason,
          detail: res.detail,
        };
      } else {
        yield {
          kind: 'result',
          id: res.id,
          original: res.original,
          working: res.working,
          sourceMeta: {
            fileName: file.name,
            format: res.format,
            // `blob: file` is the D-10 hook — Phase 4 persists this Blob with
            // no caller change.
            blob: file,
            originalDims: res.originalDims,
          },
        };
      }
    } catch (err) {
      // Skip-and-continue (D-12) — a thrown worker error never aborts the batch.
      yield {
        kind: 'failure',
        fileName: file.name,
        reason: 'decode-error',
        detail:
          err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      };
    }
  }
}
