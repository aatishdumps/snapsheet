/**
 * filePicker.ts — thin DOM file-picker import adapter (IMP-01, IMP-04).
 *
 * Thin DOM adapter — produces `File[]` only; NO decode logic; the pipeline
 * never knows the source (D-07). Opens a detached `<input type="file">`,
 * supports multi-select (IMP-04), and hands the chosen files straight to the
 * caller untouched.
 *
 * SCOPE: DOM event handling only. May touch `File` / `<input>` (DOM is allowed
 * in adapters) but MUST NOT import React/Konva/ui — `no-restricted-imports`
 * applies here (this file is under `src/editor/**`).
 */

/**
 * Open the OS file picker and deliver the chosen files.
 *
 * Creates a detached `<input type="file" multiple>` accepting JPG/PNG/WebP and
 * HEIC/HEIF, listens once for `change`, and calls {@link onFiles} with the
 * selected files as a plain array (empty if the user cancels with no
 * selection). No file is read or decoded here — that is the pipeline's job.
 *
 * @param onFiles Callback receiving the selected files as `File[]`.
 */
export function openFilePicker(onFiles: (files: File[]) => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/png,image/webp,.heic,.heif';
  input.multiple = true;
  input.addEventListener('change', () => {
    onFiles(Array.from(input.files ?? []));
  });
  input.click();
}
