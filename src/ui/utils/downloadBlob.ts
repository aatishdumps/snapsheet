/**
 * downloadBlob.ts — the centralized Blob → file download helper (UI-01 / D-09).
 *
 * One small, shared helper that turns an in-memory `Blob` into a browser file
 * download: `URL.createObjectURL` → a detached `<a download>` click → an
 * immediate `URL.revokeObjectURL`. Centralized so the export dialog (the
 * `runExport` result Blob) and the project panel (the backup-bundle JSON) share
 * exactly one download path — no scattered, leak-prone anchor plumbing
 * (RESEARCH "Don't Hand-Roll").
 *
 * SCOPE: a single DOM-side effect utility — no React, no engine logic. Lives in
 * `/ui` (the only tree where DOM/React is permitted). Named exports only.
 */

/**
 * Trigger a browser download of `blob` saved as `filename`. Creates an object
 * URL, clicks a detached anchor, then revokes the URL on the same tick so the
 * backing Blob is not pinned for the page lifetime (no URL leak across calls).
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.click();
  } finally {
    // Revoke after the click is dispatched — the browser has already captured
    // the URL by then. `finally` guarantees no leak even if `.click()` throws.
    URL.revokeObjectURL(url);
  }
}

/**
 * Build an export file name from a source photo's original name.
 *
 * Strips the original extension, appends `_${suffix}`, and applies `ext` —
 * e.g. `deriveExportName('john passport.jpg', 'edited', 'png')` →
 * `'john passport_edited.png'`. Falls back to `'photo'` when no usable name
 * is available.
 *
 * @param original the source file's name (may be null/empty/undefined)
 * @param suffix   a short tag, e.g. `'edited'` or `'multi'`
 * @param ext      the output extension, without a dot
 */
export function deriveExportName(
  original: string | null | undefined,
  suffix: string,
  ext: string,
): string {
  const base =
    (original ?? '').replace(/\.[^./\\]+$/, '').trim() || 'photo';
  return `${base}_${suffix}.${ext}`;
}
