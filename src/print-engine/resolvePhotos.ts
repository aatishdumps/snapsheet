/**
 * resolvePhotos.ts — the placement->photo link resolver (EXP-02 / D-01).
 *
 * The SINGLE place the `PlacedCell -> PhotoEntry` link is computed. The packer
 * emits one `PlacedCell` per `CellGroup.count` copy, so
 * `placedCells.length != photos.length` and `placedCells[i]` does NOT
 * correspond to `photos[i]` — index correspondence is invalid. This resolver
 * walks each distinct `PlacedCell.groupId` to its `CellGroup`, then through
 * `CellGroup.photoId` to the owning `PhotoEntry`. The render worker and both
 * exporters call this instead of assuming index alignment.
 *
 * SCOPE: pure resolution logic — no canvas, no px math, no React/Konva/ui (the
 * `no-restricted-imports` engine rule covers `src/print-engine/**`). Named
 * exports only.
 */

import type { CellGroup, PlacedCell } from '../layout-engine/types';
import type { PhotoEntry } from '../state/types';

/**
 * Result of resolving placements to photos — a discriminated union mirroring
 * `LayoutResult`. Success carries a map from each distinct `PlacedCell.groupId`
 * to its `PhotoEntry`; failure is a typed broken-link reason, never a throw or
 * an out-of-bounds read (threat T-05-19).
 */
export type ResolvePhotosResult =
  | { ok: true; byGroupId: Map<string, PhotoEntry> }
  | { ok: false; reason: 'group-missing' | 'photo-missing'; detail: string };

/**
 * Resolve each distinct `PlacedCell.groupId` to its owning `PhotoEntry`,
 * strictly by id lookup — never by array index. The returned map has one entry
 * per distinct groupId, not one per `PlacedCell`.
 *
 * @param placedCells the packer's placed cells (a group repeats `count` times)
 * @param cellGroups  the layout's cell groups — the `id -> photoId` link source
 * @param photos      the document's photos, keyed by `PhotoEntry.id`
 */
export function resolvePhotos(
  placedCells: PlacedCell[],
  cellGroups: CellGroup[],
  photos: PhotoEntry[],
): ResolvePhotosResult {
  const groupById = new Map(cellGroups.map((g) => [g.id, g]));
  const photoById = new Map(photos.map((p) => [p.id, p]));
  const byGroupId = new Map<string, PhotoEntry>();

  for (const cell of placedCells) {
    if (byGroupId.has(cell.groupId)) continue;
    const group = groupById.get(cell.groupId);
    if (group === undefined) {
      return { ok: false, reason: 'group-missing', detail: cell.groupId };
    }
    const photo = photoById.get(group.photoId);
    if (photo === undefined) {
      return { ok: false, reason: 'photo-missing', detail: group.photoId };
    }
    byGroupId.set(cell.groupId, photo);
  }

  return { ok: true, byGroupId };
}
