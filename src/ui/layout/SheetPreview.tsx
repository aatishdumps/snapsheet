/**
 * SheetPreview.tsx — a scaled DOM preview of the packed print sheet.
 *
 * Runs the real `shelfPack` engine on the layout's paper + cell groups, then
 * renders every `PlacedCell` as an absolutely-positioned `<img>` at its exact
 * mm proportions (scaled uniformly to fit the viewport). Each photo is shown
 * as its *baked* result (crop + rotate + flip + colour all applied), so the
 * preview is pixel-identical to the export. Pure presentation — the
 * mm→display-px scale is the only math here.
 *
 * SCOPE: a view component — DOM/React only. Named exports only.
 */
import { shelfPack } from '../../layout-engine';
import type { CellGroup, PaperSpec, SpacingOpts } from '../../layout-engine/types';
import { useBakedPhotoUrl } from '../photo/useBakedPhotoUrl';
import { useAdjustmentsStore } from '../state/adjustmentsStore';
import { DEFAULT_ADJUSTMENTS } from '../state/photoAdjustments';

/** Props for {@link SheetPreview}. */
export interface SheetPreviewProps {
  /** Paper dimensions, mm. */
  paper: PaperSpec;
  /** Cell groups — one per photo, with copy counts. */
  cellGroups: CellGroup[];
  /** Margin + gap, mm. */
  spacing: SpacingOpts;
  /** Sheet-wide border thickness around each cell, mm (`0` = none). */
  borderMm?: number;
  /** Border color (any CSS color). */
  borderColor?: string;
}

/** One placed photo cell inside the preview. */
function PreviewCell({
  photoId,
  left,
  top,
  width,
  height,
  rotated,
  borderPx,
  borderColor,
}: {
  photoId: string;
  left: number;
  top: number;
  width: number;
  height: number;
  rotated: boolean;
  borderPx: number;
  borderColor: string;
}): React.ReactElement {
  const adj = useAdjustmentsStore(
    (s) => s.entries[photoId]?.current ?? DEFAULT_ADJUSTMENTS,
  );
  // The baked URL already has crop + rotate + flip + colour applied, so the
  // only transform left here is the packer's 90° cell rotation.
  const url = useBakedPhotoUrl(photoId, adj);
  return (
    <div
      className="absolute overflow-hidden bg-paper"
      style={{
        left,
        top,
        width,
        height,
        boxSizing: 'border-box',
        border: borderPx > 0 ? `${String(borderPx)}px solid ${borderColor}` : undefined,
      }}
    >
      {url && (
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          style={rotated ? { transform: 'rotate(90deg)' } : undefined}
        />
      )}
    </div>
  );
}

/** A scaled DOM preview of the packed sheet. */
export function SheetPreview({
  paper,
  cellGroups,
  spacing,
  borderMm = 0,
  borderColor = '#000000',
}: SheetPreviewProps): React.ReactElement {
  const packed = shelfPack(paper, cellGroups, spacing);

  // Uniform mm → display-px scale: fit the sheet's long edge into ~520px.
  const maxDisplay = 520;
  const scale = maxDisplay / Math.max(paper.widthMm, paper.heightMm);
  const borderPx = Math.max(0, borderMm) * scale;
  const groupOf = (groupId: string): CellGroup | undefined =>
    cellGroups.find((g) => g.id === groupId);

  if (!packed.ok) {
    return (
      <p className="text-label text-destructive" role="alert">
        Cannot lay out sheet: {packed.errors.join('; ')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-md">
      <div
        data-testid="sheet-preview"
        className="relative mx-auto overflow-hidden rounded-sm bg-paper shadow-pop ring-1 ring-chrome"
        style={{ width: paper.widthMm * scale, height: paper.heightMm * scale }}
      >
        {packed.placedCells.map((cell, i) => {
          const group = groupOf(cell.groupId);
          if (!group) return null;
          return (
            <PreviewCell
              key={`${cell.groupId}-${String(i)}`}
              photoId={group.photoId}
              left={cell.xMm * scale}
              top={cell.yMm * scale}
              width={cell.widthMm * scale}
              height={cell.heightMm * scale}
              rotated={cell.rotated}
              borderPx={borderPx}
              borderColor={borderColor}
            />
          );
        })}
      </div>
      <p className="text-center text-label text-fg-muted tabular-nums">
        <span className="font-medium text-fg">
          {packed.placedCells.length}
        </span>{' '}
        photo{packed.placedCells.length === 1 ? '' : 's'} placed
        {packed.unplacedCount > 0
          ? ` · ${String(packed.unplacedCount)} did not fit`
          : ''}
      </p>
    </div>
  );
}
