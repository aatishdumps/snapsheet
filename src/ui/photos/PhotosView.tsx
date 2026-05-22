/**
 * PhotosView.tsx — the import + photo-library view.
 *
 * Drag-and-drop, "Choose files", and camera capture all feed the engine's
 * `importFiles` pipeline via `usePhotoImport`. Imported photos appear in a
 * selectable thumbnail grid; selecting one and pressing Edit jumps to the Edit
 * view. Removing a photo drops it from the document store (and bitmap cache).
 *
 * SCOPE: a view component — DOM/React only. Named exports only.
 */
import { useEffect, useRef } from 'react';
import {
  attachDropZone,
  openFilePicker,
  openCameraCapture,
} from '../../editor/adapters';
import { useDocumentStore, useUiStore } from '../../state';
import { usePhotoImport } from '../photo/usePhotoImport';
import { btnPrimary, btnSecondary, card } from '../theme/controls';
import { PhotoThumb } from './PhotoThumb';

/** The Photos / Import view. */
export function PhotosView(): React.ReactElement {
  const photos = useDocumentStore((s) => s.photos);
  const removePhoto = useDocumentStore((s) => s.removePhoto);
  const selectionId = useUiStore((s) => s.selectionId);
  const setSelection = useUiStore((s) => s.setSelection);
  const setMode = useUiStore((s) => s.setMode);
  const { importing, errors, importBatch, clearErrors } = usePhotoImport();
  const dropRef = useRef<HTMLDivElement>(null);

  // Wire drag-and-drop onto the drop zone element.
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    return attachDropZone(el, (files) => void importBatch(files));
  }, [importBatch]);

  return (
    <div className="mx-auto flex max-w-readable flex-col gap-lg p-lg">
      <div
        ref={dropRef}
        data-testid="drop-zone"
        className="flex flex-col items-center gap-md rounded-xl border border-dashed border-chrome bg-card p-2xl text-center transition-colors hover:border-accent"
      >
        <span
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-fg-muted"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 16V4M5 11l7-7 7 7M4 20h16" />
          </svg>
        </span>
        <div className="flex flex-col gap-xs">
          <p className="text-body font-semibold">Drag photos here</p>
          <p className="text-label text-fg-muted">
            JPG, PNG, WebP or HEIC — processed entirely on your device
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-sm">
          <button
            type="button"
            onClick={() => openFilePicker((files) => void importBatch(files))}
            className={btnPrimary}
          >
            Choose files
          </button>
          <button
            type="button"
            onClick={() => openCameraCapture((files) => void importBatch(files))}
            className={btnSecondary}
          >
            Use camera
          </button>
        </div>
        {importing && (
          <p className="text-label font-medium text-accent" role="status">
            Importing…
          </p>
        )}
      </div>

      {errors.length > 0 && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-md">
          <div className="flex items-center justify-between gap-md">
            <p className="text-label font-semibold text-destructive">
              Some files were skipped
            </p>
            <button
              type="button"
              onClick={clearErrors}
              className="rounded-md px-sm py-xs text-label text-fg-muted transition-colors hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Dismiss
            </button>
          </div>
          <ul className="mt-sm list-disc pl-lg text-label text-fg-muted">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {photos.length === 0 ? (
        <div
          className={`${card} flex flex-col items-center gap-xs p-2xl text-center`}
        >
          <p className="text-body font-medium">No photos yet</p>
          <p className="text-label text-fg-muted">
            Import a photo above to get started.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between">
            <h2 className="text-heading font-semibold tracking-tight">
              Your photos
            </h2>
            <span className="text-label text-fg-muted tabular-nums">
              {photos.length} imported
            </span>
          </div>
          <div
            data-testid="photo-grid"
            className="grid grid-cols-2 gap-md sm:grid-cols-3 md:grid-cols-4"
          >
            {photos.map((p) => (
              <PhotoThumb
                key={p.id}
                photoId={p.id}
                selected={p.id === selectionId}
                onSelect={setSelection}
                onRemove={removePhoto}
              />
            ))}
          </div>
          <div className="flex flex-wrap justify-end gap-sm">
            <button
              type="button"
              onClick={() => setMode('layout')}
              className={btnSecondary}
            >
              Go to layout
            </button>
            <button
              type="button"
              disabled={selectionId === null}
              onClick={() => setMode('edit')}
              className={btnPrimary}
            >
              Edit selected
            </button>
          </div>
        </>
      )}
    </div>
  );
}
