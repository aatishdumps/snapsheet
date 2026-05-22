/**
 * sniff.ts — signature-byte image format detection (D-04 / IMP-05, IMP-06).
 *
 * Resolves the format of an imported file from its leading magic bytes so the
 * decode dispatch knows whether to use the native `createImageBitmap` path
 * (JPG/PNG/WebP) or the lazy-loaded HEIC WASM path.
 *
 * SCOPE: detection is by signature bytes ONLY. This module NEVER reads the
 * file's MIME type or its extension — iOS hands HEIC files an empty or wrong
 * MIME and users rename files, so both are unreliable (Pitfall 4).
 * Pure, headless, no DOM: a `Blob` in, a `DetectedFormat` out.
 */
import type { DetectedFormat } from './types';

/** ISO-BMFF `ftyp` brands that identify a HEIC/HEIF still image (D-04). */
const HEIC_BRANDS = ['heic', 'heix', 'heif', 'hevc', 'mif1', 'msf1'] as const;

/**
 * Detect the image format of `file` from its first 32 signature bytes (D-04).
 *
 * Recognises JPEG, PNG, WebP, and HEIC/HEIF (by `ftyp` brand). Any other byte
 * pattern — including an empty file — resolves to `'unsupported'`.
 *
 * ISO-BMFF assumption (WR-06): a HEIC file's first box is expected to be
 * `ftyp`. The 32-bit box-size field at bytes 0-3 normally places `ftyp` at
 * byte 4 and the brand at byte 8; when that field equals `1` an 8-byte
 * `largesize` follows the box type, pushing the first box's `ftyp`/brand 8
 * bytes later — that extended-size layout is handled here. A file whose first
 * box is not `ftyp` (rare but legal) still resolves to `'unsupported'`.
 *
 * @param file the imported file/blob to inspect
 * @returns the {@link DetectedFormat} resolved purely from signature bytes
 */
export async function sniffFormat(file: Blob): Promise<DetectedFormat> {
  const buf = new Uint8Array(await file.slice(0, 32).arrayBuffer());

  // ASCII slice helper — `noUncheckedIndexedAccess` makes `buf[i]` `number | undefined`,
  // but `subarray` always yields a defined `Uint8Array`, so this is index-safe.
  const ascii = (s: number, e: number): string =>
    String.fromCharCode(...buf.subarray(s, e));

  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpeg';
  if (buf[0] === 0x89 && ascii(1, 4) === 'PNG') return 'png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';

  // ISO-BMFF box layout: 32-bit box size at bytes 0-3, box type at bytes 4-7.
  // When the size field equals 1, an 8-byte 64-bit `largesize` follows the
  // box type, so the first box's `ftyp`/brand sit 8 bytes further along.
  const size32 =
    ((buf[0] ?? 0) << 24) |
    ((buf[1] ?? 0) << 16) |
    ((buf[2] ?? 0) << 8) |
    (buf[3] ?? 0);
  const ftypAt = size32 === 1 ? 12 : 4;
  if (ascii(ftypAt, ftypAt + 4) === 'ftyp') {
    const brand = ascii(ftypAt + 4, ftypAt + 8);
    if ((HEIC_BRANDS as readonly string[]).includes(brand)) return 'heic';
  }

  return 'unsupported';
}
