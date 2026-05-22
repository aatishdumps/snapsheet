/**
 * dpi-metadata.ts — embed 300-DPI print metadata into PNG/JPEG bytes (EXP-03 / D-05).
 *
 * After `OffscreenCanvas.convertToBlob` produces a raster, browsers tag it with
 * no usable physical resolution (PNG omits `pHYs`; JPEG emits a JFIF APP0 with
 * `units = 0`). `patchPngDpi` inserts/replaces a `pHYs` chunk and `patchJpegDpi`
 * patches — or, when absent, inserts — a JFIF APP0 density segment so the file
 * prints at exact physical size. `crc32` and `ppmFromDpi` back the PNG path.
 *
 * SCOPE: pure byte math on `ArrayBuffer`/`Uint8Array` — NO canvas, no DOM, no
 * React/Konva/ui (the `no-restricted-imports` engine rule covers
 * `src/export-engine/**`). Named exports only.
 */

/** PNG 8-byte signature `89 50 4E 47 0D 0A 1A 0A`. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

/** Pixels-per-metre for a DPI value: `ppm = round(dpi / 0.0254)` (D-05). */
export function ppmFromDpi(dpi: number): number {
  return Math.round(dpi / 0.0254);
}

/** Build the 256-entry IEEE CRC32 table (reversed polynomial 0xEDB88320). */
function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

/**
 * 256-entry IEEE CRC32 table, built once eagerly at module load. An eager
 * `const` avoids a hidden lazy-init mutable global in a module the prologue
 * describes as pure byte math (WR-01).
 */
const CRC_TABLE = buildCrcTable();

/** Standard IEEE CRC32 over `bytes`; returns an unsigned 32-bit result. */
export function crc32(bytes: Uint8Array): number {
  const table = CRC_TABLE;
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ (table[(crc ^ (bytes[i] ?? 0)) & 0xff] ?? 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Write a big-endian uint32 into `out` starting at `off`. */
function writeBe32(out: Uint8Array, off: number, value: number): void {
  out[off] = (value >>> 24) & 0xff;
  out[off + 1] = (value >>> 16) & 0xff;
  out[off + 2] = (value >>> 8) & 0xff;
  out[off + 3] = value & 0xff;
}

/** Read a big-endian uint32 from `b` at `off`. */
function readBe32(b: Uint8Array, off: number): number {
  return (
    (((b[off] ?? 0) << 24) |
      ((b[off + 1] ?? 0) << 16) |
      ((b[off + 2] ?? 0) << 8) |
      (b[off + 3] ?? 0)) >>>
    0
  );
}

/** ASCII chars of `s` as a number array. */
function ascii(s: string): number[] {
  return [...s].map((c) => c.charCodeAt(0));
}

const PHYS_TYPE = ascii('pHYs');

/** Build a complete 21-byte `pHYs` chunk (length + type + 9 data + CRC). */
function buildPhysChunk(ppm: number): Uint8Array {
  const chunk = new Uint8Array(21);
  writeBe32(chunk, 0, 9); // data length
  chunk.set(PHYS_TYPE, 4); // "pHYs"
  writeBe32(chunk, 8, ppm); // ppm X
  writeBe32(chunk, 12, ppm); // ppm Y
  chunk[16] = 1; // unit specifier: 1 = metre
  // CRC over the 13 type+data bytes (NOT the length prefix — Pitfall 1).
  writeBe32(chunk, 17, crc32(chunk.subarray(4, 17)));
  return chunk;
}

/**
 * Insert or replace a `pHYs` chunk so the PNG carries `dpi` (EXP-03 / D-05).
 *
 * Validates the 8-byte PNG signature first; a buffer that is not a PNG is
 * returned unchanged (never a blind write — threat T-05-04). If a `pHYs` chunk
 * already exists it is replaced in place; otherwise a fresh chunk is spliced in
 * at byte offset 33 (immediately after IHDR, before IDAT).
 */
export function patchPngDpi(png: ArrayBuffer, dpi: number): ArrayBuffer {
  const src = new Uint8Array(png);
  // Validate signature — never blind-write a non-PNG buffer.
  if (src.length < 8) return png;
  for (let i = 0; i < 8; i++) {
    if (src[i] !== PNG_SIGNATURE[i]) return png;
  }

  const newChunk = buildPhysChunk(ppmFromDpi(dpi));

  // Scan chunks for an existing pHYs to replace.
  let off = 8;
  while (off + 8 <= src.length) {
    const len = readBe32(src, off);
    const type = String.fromCharCode(...src.subarray(off + 4, off + 8));
    const chunkTotal = 12 + len; // length(4) + type(4) + data + crc(4)
    if (type === 'pHYs') {
      const out = new Uint8Array(src.length - chunkTotal + newChunk.length);
      out.set(src.subarray(0, off), 0);
      out.set(newChunk, off);
      out.set(src.subarray(off + chunkTotal), off + newChunk.length);
      return out.buffer;
    }
    if (type === 'IEND') break;
    off += chunkTotal;
  }

  // No pHYs present — insert immediately after IHDR. Never trust the fixed
  // offset 33: verify IHDR really is the first chunk and read its declared
  // length, so a non-conformant PNG is returned unchanged rather than spliced
  // mid-chunk (threat T-05-04).
  if (src.length < 33) return png;
  const firstType = String.fromCharCode(...src.subarray(12, 16));
  if (firstType !== 'IHDR') return png; // not a conformant PNG — do not patch
  const ihdrLen = readBe32(src, 8);
  const insertAt = 8 + 12 + ihdrLen; // sig(8) + len(4)+type(4)+data+crc(4)
  if (insertAt > src.length) return png; // truncated IHDR — do not patch
  const out = new Uint8Array(src.length + newChunk.length);
  out.set(src.subarray(0, insertAt), 0);
  out.set(newChunk, insertAt);
  out.set(src.subarray(insertAt), insertAt + newChunk.length);
  return out.buffer;
}

const JFIF_ID = ascii('JFIF\0'); // "JFIF" + null terminator

/** Build a complete 18-byte JFIF APP0 segment carrying `dpi` density. */
function buildApp0Segment(dpi: number): Uint8Array {
  // payload: "JFIF\0"(5) ver(2) units(1) Xdensity(2) Ydensity(2) Xthumb(1) Ythumb(1) = 14
  const segLen = 14 + 2; // payload + the 2-byte length field
  const seg = new Uint8Array(2 + segLen);
  seg[0] = 0xff;
  seg[1] = 0xe0; // APP0 marker
  seg[2] = (segLen >> 8) & 0xff;
  seg[3] = segLen & 0xff;
  seg.set(JFIF_ID, 4); // bytes 4-8
  seg[9] = 1; // version major
  seg[10] = 2; // version minor
  seg[11] = 1; // units: 1 = dots per inch
  seg[12] = (dpi >> 8) & 0xff; // Xdensity hi
  seg[13] = dpi & 0xff; // Xdensity lo
  seg[14] = (dpi >> 8) & 0xff; // Ydensity hi
  seg[15] = dpi & 0xff; // Ydensity lo
  seg[16] = 0; // Xthumbnail
  seg[17] = 0; // Ythumbnail
  return seg;
}

/**
 * Patch or insert a JFIF APP0 density segment so the JPEG carries `dpi`
 * (EXP-03 / D-05).
 *
 * Validates the `FF D8` SOI marker first; a non-JPEG buffer is returned
 * unchanged (threat T-05-05). PATCH PATH: when a JFIF APP0 segment is present
 * directly after SOI, its units/Xdensity/Ydensity bytes are overwritten in
 * place (no length change). INSERT PATH (mandatory — A1): when no APP0 segment
 * is present, a full JFIF APP0 segment is spliced in immediately after SOI —
 * `OffscreenCanvas.convertToBlob('image/jpeg')` may emit an APP0-less JPEG.
 */
export function patchJpegDpi(jpeg: ArrayBuffer, dpi: number): ArrayBuffer {
  const src = new Uint8Array(jpeg);
  // Validate SOI.
  if (src.length < 4 || src[0] !== 0xff || src[1] !== 0xd8) return jpeg;

  // Is the first segment after SOI an APP0?
  if (src[2] === 0xff && src[3] === 0xe0) {
    const payload = 6; // after SOI(2) + marker(2) + length(2)
    // Read the APP0 2-byte length field BEFORE trusting any payload offset.
    // A standard JFIF APP0 segment is >= 16 bytes (length 2 + payload 14);
    // and the buffer must actually cover the density bytes we overwrite
    // (payload+11 = absolute byte 17). Without these checks a truncated or
    // short FF E0 segment would cause silent out-of-bounds writes (threat
    // T-05-05). On any failure, fall through to the INSERT PATH.
    const segLen = ((src[4] ?? 0) << 8) | (src[5] ?? 0);
    const id =
      src.length >= payload + 5
        ? String.fromCharCode(...src.subarray(payload, payload + 5))
        : '';
    if (id === 'JFIF\0' && segLen >= 16 && src.length >= payload + 12) {
      // PATCH PATH — overwrite density fields in place.
      const out = new Uint8Array(src); // copy
      out[payload + 7] = 1; // units: dpi
      out[payload + 8] = (dpi >> 8) & 0xff; // Xdensity hi
      out[payload + 9] = dpi & 0xff; // Xdensity lo
      out[payload + 10] = (dpi >> 8) & 0xff; // Ydensity hi
      out[payload + 11] = dpi & 0xff; // Ydensity lo
      return out.buffer;
    }
  }

  // INSERT PATH — splice a fresh APP0 segment in right after SOI.
  const seg = buildApp0Segment(dpi);
  const out = new Uint8Array(src.length + seg.length);
  out.set(src.subarray(0, 2), 0); // SOI
  out.set(seg, 2); // new APP0
  out.set(src.subarray(2), 2 + seg.length); // rest of the JPEG
  return out.buffer;
}
