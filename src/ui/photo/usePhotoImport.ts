/**
 * usePhotoImport.ts — the React hook that drives photo import.
 *
 * Wraps the engine's `importFiles` batch pipeline: for every successfully
 * decoded file it persists the original Blob to the `assets` table, registers
 * the decoded working bitmap in the runtime `bitmapCache`, and appends a
 * `PhotoEntry` to the document store (which arms autosave). Failures are
 * collected and surfaced to the caller.
 *
 * SCOPE: a UI hook — lives in `/ui` (React permitted). Named exports only.
 */
import { useCallback, useState } from 'react';
import { importFiles } from '../../editor';
import { putBitmap, useDocumentStore, useUiStore } from '../../state';
import { EMPTY_PIPELINE } from '../../editor';
import { assetRepo } from '../../storage';

/** The state returned by {@link usePhotoImport}. */
export interface PhotoImportState {
  /** True while a batch is being decoded. */
  importing: boolean;
  /** Human-readable messages for files that failed to import. */
  errors: string[];
  /** Import a batch of files — decode, persist, register. */
  importBatch: (files: File[]) => Promise<void>;
  /** Clear the accumulated error messages. */
  clearErrors: () => void;
}

/** Drives photo import and wires results into the stores. */
export function usePhotoImport(): PhotoImportState {
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const importBatch = useCallback(async (files: File[]): Promise<void> => {
    if (files.length === 0) return;
    setImporting(true);
    const batchErrors: string[] = [];
    let firstId: string | null = null;
    try {
      for await (const event of importFiles(files)) {
        if (event.kind === 'failure') {
          batchErrors.push(
            `${event.fileName}: ${event.reason}${
              event.detail ? ` — ${event.detail}` : ''
            }`,
          );
          continue;
        }
        if (event.kind === 'warning') {
          batchErrors.push(
            `Large batch (${String(event.count)} files) — importing all.`,
          );
          continue;
        }
        // A successful decode — persist + register.
        const photoId = `photo-${event.id}`;
        putBitmap(photoId, event.working);
        await assetRepo.putBlob({
          id: photoId,
          blob: event.sourceMeta.blob,
          fileName: event.sourceMeta.fileName,
          mimeType: event.sourceMeta.blob.type || 'image/png',
        });
        useDocumentStore.getState().addPhoto({
          id: photoId,
          assetId: photoId,
          pipeline: EMPTY_PIPELINE,
        });
        if (firstId === null) firstId = photoId;
      }
      // Auto-select the first imported photo for convenience.
      if (firstId !== null && useUiStore.getState().selectionId === null) {
        useUiStore.getState().setSelection(firstId);
      }
    } finally {
      setImporting(false);
      if (batchErrors.length > 0) {
        setErrors((prev) => [...prev, ...batchErrors]);
      }
    }
  }, []);

  const clearErrors = useCallback(() => setErrors([]), []);

  return { importing, errors, importBatch, clearErrors };
}
