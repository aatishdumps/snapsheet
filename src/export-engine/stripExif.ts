/**
 * stripExif.ts — remove EXIF APP1 metadata from a JPEG byte buffer (D-06).
 *
 * D-06 requires that an exported passport photo never leak the user's home
 * location via embedded EXIF GPS / camera metadata. PRIVACY REALITY (checker):
 * in the Phase 5 export pipeline the composited / single-photo JPEG is produced
 * by an `OffscreenCanvas` re-encode — and a canvas re-encode CANNOT carry the
 * original camera's EXIF. The GPS-leak risk is therefore ALREADY structurally
 * eliminated by re-encoding. `stripExif` is a DEFENSIVE, belt-and-suspenders
 * pass at the export boundary: it guarantees no APP1/Exif segment survives even
 * if a future code path feeds it bytes from a source that did carry EXIF. It is
 * NOT "the" GPS strip — it is a defensive guard.
 *
 * Note (Assumption A4): Phase 2's `editor/import/orientation.ts` only strips
 * EXIF on its canvas:true rotation branch; on the canvas:false path the
 * original file's EXIF is deliberately left in `sourceMeta.blob`. So an
 * unrotated original can still carry EXIF — making this export-boundary guard a
 * meaningful second line of defence.
 *
 * SCOPE: pure byte op on an `ArrayBuffer` — NO canvas, no DOM, no
 * React/Konva/ui (the `no-restricted-imports` engine rule covers
 * `src/export-engine/**`). Named exports only.
 */

/** ASCII identifier `Exif\0\0` that prefixes an EXIF APP1 payload. */
const EXIF_ID = 'Exif\0\0';

/**
 * Remove every EXIF APP1 segment from a JPEG buffer (D-06 defensive guard).
 *
 * Validates the `FF D8` SOI marker first; a non-JPEG buffer is returned
 * unchanged. Walks the marker segments from offset 2, splicing out any `FF E1`
 * (APP1) segment whose payload begins with the `Exif\0\0` identifier while
 * preserving every other segment (APP0 included) and the entropy-coded scan
 * data after SOS. Scanning stops at the SOS marker (`FF DA`).
 */
export function stripExif(jpeg: ArrayBuffer): ArrayBuffer {
  const src = new Uint8Array(jpeg);
  // Validate SOI — never touch a non-JPEG buffer.
  if (src.length < 4 || src[0] !== 0xff || src[1] !== 0xd8) return jpeg;

  // Collect [start,end) byte ranges of EXIF APP1 segments to drop.
  const drops: { start: number; end: number }[] = [];
  let off = 2;
  while (off + 4 <= src.length) {
    if (src[off] !== 0xff) break; // not a marker — bail out safely
    const marker = src[off + 1];
    // SOS / EOI / standalone markers — stop, do not touch scan data.
    if (marker === 0xda || marker === 0xd9) break;
    const segLen = ((src[off + 2] ?? 0) << 8) | (src[off + 3] ?? 0);
    const segEnd = off + 2 + segLen;
    // A JPEG segment length includes the 2 length bytes, so a valid segment
    // has segLen >= 2 and segEnd <= buffer end. A malformed length would make
    // `off` fail to advance (or jump past the buffer), silently truncating the
    // scan and potentially MISSING a later EXIF segment — a GPS leak (D-06).
    // On any structural violation, abandon the strip and return unchanged.
    if (segLen < 2 || segEnd > src.length) return jpeg;
    if (marker === 0xe1) {
      const id = String.fromCharCode(...src.subarray(off + 4, off + 10));
      if (id === EXIF_ID) {
        drops.push({ start: off, end: segEnd });
      }
    }
    off = segEnd;
  }

  if (drops.length === 0) return jpeg;

  // Rebuild the buffer without the dropped segments.
  const removed = drops.reduce((s, d) => s + (d.end - d.start), 0);
  const out = new Uint8Array(src.length - removed);
  let read = 0;
  let write = 0;
  for (const d of drops) {
    out.set(src.subarray(read, d.start), write);
    write += d.start - read;
    read = d.end;
  }
  out.set(src.subarray(read), write);
  return out.buffer;
}
