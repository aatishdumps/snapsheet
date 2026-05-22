/**
 * cameraCapture.ts — thin DOM camera-capture import adapter (IMP-03, D-06).
 *
 * Thin DOM adapter — produces `File[]` only; NO decode logic; the pipeline
 * never knows the source (D-07). Identical to the file picker but additionally
 * sets `<input capture="environment">`, which taps the OS camera app on mobile
 * (D-06 — no in-app camera UI to build).
 *
 * The `capture` attribute is honoured on mobile browsers and SILENTLY IGNORED
 * on desktop — so there is no code-path divergence from the file picker (no
 * branching needed; RESEARCH.md Pattern 1). On desktop this simply behaves as
 * an ordinary file picker.
 *
 * SCOPE: DOM event handling only. DOM is allowed in adapters; React/Konva/ui
 * imports are NOT — `no-restricted-imports` applies (file under `src/editor/**`).
 */

/**
 * Open the device camera (mobile) or file picker (desktop) and deliver the
 * captured/chosen files.
 *
 * Creates a detached `<input type="file" capture="environment">`, listens once
 * for `change`, and calls {@link onFiles} with the resulting files as a plain
 * array. No file is read or decoded here — that is the pipeline's job.
 *
 * @param onFiles Callback receiving the captured files as `File[]`.
 */
export function openCameraCapture(onFiles: (files: File[]) => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/png,image/webp,.heic,.heif';
  input.multiple = true;
  // `capture` opens the OS camera on mobile; desktop browsers ignore it (D-06).
  input.capture = 'environment';
  input.addEventListener('change', () => {
    onFiles(Array.from(input.files ?? []));
  });
  input.click();
}
