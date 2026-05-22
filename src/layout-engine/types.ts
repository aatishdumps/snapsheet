/**
 * types.ts — layout-engine contract types (LAY-01..06 / D-09..D-14).
 *
 * The shared mm-first contract every downstream Phase 3 layout file builds
 * against: the shelf packer (packer/shelfPack.ts), the grid layout
 * (packer/grid.ts), the auto-fit search (packer/autoFit.ts), and the snapping
 * engine (snapping.ts) all import these types. Defining them first prevents a
 * downstream "scavenger hunt".
 *
 * ALL geometry here is MILLIMETRES (D-10) — the document model is mm-first and
 * px conversion happens only at the Phase 5 rendering boundary via
 * `print-engine/units`. There is no px math in the layout engine; every
 * dimension field is `*Mm`-suffixed.
 *
 * SCOPE: type declarations only — no runtime logic, no DOM, no React. Honors
 * the `no-restricted-imports` engine rule. Named exports only.
 */

/**
 * The resolved paper dimensions in mm — either a custom paper size or the
 * `dimensionsMm` of a `PaperSize` preset, resolved by the caller. Kept
 * standalone (no `/templates` import) so the engine stays decoupled.
 */
export interface PaperSpec {
  /** Paper width, mm (D-10). */
  widthMm: number;
  /** Paper height, mm (D-10). */
  heightMm: number;
}

/** A single photo cell's physical size in mm. */
export interface CellSpec {
  /** Cell width, mm (D-10). */
  widthMm: number;
  /** Cell height, mm (D-10). */
  heightMm: number;
}

/**
 * A group of identically-sized photo cells (D-09 — the packer groups by photo
 * size; D-03 — mixed copy counts). All `count` copies of ONE photo on the
 * sheet form one group.
 *
 * CONTRACT (Phase 5 addition): `id` is the group's own identity — every
 * PlacedCell the packer emits for this group carries `groupId === id`.
 * `photoId` is the foreign key into `DocumentData.photos` (a `PhotoEntry.id`)
 * identifying WHICH photo this group renders. The two are distinct on purpose:
 * the packer keys placement by `id`; the renderer resolves pixels by
 * `photoId`. Before this addition there was NO typed link from a placed cell
 * back to its PhotoEntry — see `print-engine/resolvePhotos.ts`.
 */
export interface CellGroup {
  /** The group's own stable id — `PlacedCell.groupId` equals this (LAY-02). */
  id: string;
  /** Foreign key into `DocumentData.photos` — the `PhotoEntry.id` this group renders (Phase 5 link). */
  photoId: string;
  /** Physical cell size, mm. */
  size: CellSpec;
  /** Number of copies of this photo on the sheet (LAY-01/LAY-03 mixed counts). */
  count: number;
}

/** Spacing and margin options for a packed sheet (LAY-05). All mm. */
export interface SpacingOpts {
  /** Uniform margin from every paper edge, mm. */
  marginMm: number;
  /** Gap between adjacent cells, mm. */
  gapMm: number;
}

/**
 * One packed cell's absolute position on the paper — all coordinates mm,
 * measured from the paper origin (top-left).
 */
export interface PlacedCell {
  /** The `CellGroup.id` this cell belongs to. */
  groupId: string;
  /** Left edge from paper origin, mm (cumulative-sum, not rounded — Pitfall 2). */
  xMm: number;
  /** Top edge from paper origin, mm. */
  yMm: number;
  /** Placed width, mm (may be the rotated dimension — LAY-06/D-11). */
  widthMm: number;
  /** Placed height, mm. */
  heightMm: number;
  /** True if the cell was placed at 90° for packing density (D-11). */
  rotated: boolean;
}

/**
 * Result of a layout-pack operation — a discriminated union mirroring
 * `templates/validate.ts` `ValidationResult`. Success carries the placed cells
 * in mm plus a count of cells that did not fit on the sheet; failure carries
 * dimension-rejection messages (non-positive / non-finite paper or cell sizes —
 * RESEARCH Security V5, threat T-03-03).
 */
export type LayoutResult =
  | { ok: true; placedCells: PlacedCell[]; unplacedCount: number }
  | { ok: false; errors: string[] };

/**
 * An alignment-guide descriptor emitted by the snapping engine (D-13 — the
 * Phase 6 UI renders these as guide lines during drag). Pure geometry, mm.
 */
export interface AlignmentGuide {
  /** Horizontal or vertical guide line. */
  orientation: 'h' | 'v';
  /** The line's mm coordinate on the cross-axis. */
  positionMm: number;
  /** Guide-line extent along its axis, mm: `[fromMm, toMm]`. */
  span: [fromMm: number, toMm: number];
  /** What the dragged cell aligned to (D-12). */
  snappedTo:
    | 'paper-edge'
    | 'margin'
    | 'sheet-center'
    | 'sibling-edge'
    | 'sibling-center';
  /** Present only when `snappedTo` is a `sibling-*` value — the aligned sibling's id. */
  siblingId?: string;
}

/**
 * An axis-aligned rectangle in mm — used as the dragged-rect input to the
 * snapping engine (plan 06). Coordinates measured from the paper origin.
 */
export interface RectMm {
  /** Left edge from paper origin, mm. */
  xMm: number;
  /** Top edge from paper origin, mm. */
  yMm: number;
  /** Rectangle width, mm. */
  widthMm: number;
  /** Rectangle height, mm. */
  heightMm: number;
}
