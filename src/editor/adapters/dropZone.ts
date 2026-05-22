/**
 * dropZone.ts — thin DOM drag-and-drop import adapter (IMP-02).
 *
 * Thin DOM adapter — produces `File[]` only; NO decode logic; the pipeline
 * never knows the source (D-07). Attaches `dragover`/`drop` listeners to a
 * host element and extracts the dropped files from the `DataTransfer`.
 *
 * The `dragover` handler calls `preventDefault()` so the browser does NOT
 * navigate to / open the dropped file itself (threat T-02-14); the `drop`
 * handler likewise calls `preventDefault()` before reading `dataTransfer.files`.
 *
 * SCOPE: DOM event handling only. DOM is allowed in adapters; React/Konva/ui
 * imports are NOT — `no-restricted-imports` applies (file under `src/editor/**`).
 */

/**
 * Attach drag-and-drop import handling to a host element.
 *
 * Adds `dragover` (preventing the browser's default file-open behaviour) and
 * `drop` listeners. On `drop`, the default is prevented and the dropped files
 * are handed to {@link onFiles} as a plain array. No file is read or decoded
 * here — that is the pipeline's job.
 *
 * @param el      The element that should accept dropped files.
 * @param onFiles Callback receiving the dropped files as `File[]`.
 * @returns A cleanup function that removes both listeners.
 */
export function attachDropZone(
  el: HTMLElement,
  onFiles: (files: File[]) => void,
): () => void {
  const onDragOver = (e: DragEvent): void => {
    // preventDefault so the browser does not open/navigate to the file itself.
    e.preventDefault();
  };
  const onDrop = (e: DragEvent): void => {
    // preventDefault so the browser does not open the dropped file.
    e.preventDefault();
    onFiles(Array.from(e.dataTransfer?.files ?? []));
  };

  el.addEventListener('dragover', onDragOver);
  el.addEventListener('drop', onDrop);

  return () => {
    el.removeEventListener('dragover', onDragOver);
    el.removeEventListener('drop', onDrop);
  };
}
