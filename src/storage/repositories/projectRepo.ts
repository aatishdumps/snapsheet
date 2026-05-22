/**
 * projectRepo.ts — CRUD for the `projects` table (STO-01).
 *
 * The persistence boundary for project records: autosave calls `save`. Each
 * `save` is a last-state overwrite of the whole record (D-04), never an
 * append — Dexie `put` upserts by `id`.
 *
 * SCOPE: headless storage — pure promises returning plain data. NO React
 * imports; `/storage` IS an engine glob. Zero network calls (OFF-03).
 */
import { db } from '../db';
import type { ProjectRecord } from '../types';

/** Upsert a project record — last-state overwrite by `id` (D-04). */
export async function save(record: ProjectRecord): Promise<void> {
  await db.projects.put(record);
}
