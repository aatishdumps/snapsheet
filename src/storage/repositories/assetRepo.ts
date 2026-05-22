/**
 * assetRepo.ts — CRUD for the `assets` table (STO-02 / D-08).
 *
 * Stores original photos as raw, compressed `Blob`s — NEVER base64 (≈33%
 * bloat) and never decoded `ImageBitmap`s (D-08).
 *
 * SCOPE: headless storage — pure promises returning plain data. NO React
 * imports; `/storage` IS an engine glob. Zero network calls (OFF-03).
 */
import { db } from '../db';
import type { AssetRecord } from '../types';

/** Upsert an asset record — the photo stays a raw `Blob` (D-08). */
export async function putBlob(record: AssetRecord): Promise<void> {
  await db.assets.put(record);
}

/** Fetch an asset by id, or `undefined` if absent. */
export async function getBlob(id: string): Promise<AssetRecord | undefined> {
  return db.assets.get(id);
}

/** Delete an asset by id. Named `remove` to avoid the `delete` keyword. */
export async function remove(id: string): Promise<void> {
  await db.assets.delete(id);
}
