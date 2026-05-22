/**
 * photoAdjustmentRepo.ts — CRUD for the `photoAdjustments` table (DB v2).
 *
 * Persists the DOM/CSS-filter UI's per-photo slider values + crop so an edit
 * survives a page reload. The row payload (`values`) is opaque JSON owned by
 * the UI layer — this repo treats it as plain serializable data.
 *
 * SCOPE: headless storage — pure promises returning plain data. NO React/Konva
 * imports; `/storage` IS an engine glob. Zero network calls (OFF-03).
 */
import { db } from '../db';
import type { PhotoAdjustmentRecord } from '../types';

/** Upsert one photo's adjustment row. */
export async function put(record: PhotoAdjustmentRecord): Promise<void> {
  await db.photoAdjustments.put(record);
}

/** Fetch every saved adjustment row — used to rehydrate the UI store at boot. */
export async function getAll(): Promise<PhotoAdjustmentRecord[]> {
  return db.photoAdjustments.toArray();
}
