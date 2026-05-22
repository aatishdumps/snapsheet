/**
 * PhotoThumb.tsx — one selectable photo thumbnail in the grid.
 *
 * Renders a photo's working bitmap with its live CSS-filter applied, so the
 * grid reflects the user's edits. Clicking selects the photo.
 *
 * SCOPE: a presentational UI component. Lives in `/ui`. Named exports only.
 */
import { usePhotoUrl } from '../photo/usePhotoUrl';
import { useAdjustmentsStore } from '../state/adjustmentsStore';
import { buildFilterString } from '../state/buildFilterString';

/** Props for {@link PhotoThumb}. */
export interface PhotoThumbProps {
  /** The photo's id (also its assetId in this UI). */
  photoId: string;
  /** Whether this thumbnail is the current selection. */
  selected: boolean;
  /** Select this photo. */
  onSelect: (id: string) => void;
  /** Remove this photo. */
  onRemove: (id: string) => void;
}

/** A single photo thumbnail with selection + remove. */
export function PhotoThumb({
  photoId,
  selected,
  onSelect,
  onRemove,
}: PhotoThumbProps): React.ReactElement {
  const url = usePhotoUrl(photoId);
  const adj = useAdjustmentsStore((s) => s.entries[photoId]?.current);
  const filter = adj ? buildFilterString(adj) : 'none';
  const transform = adj
    ? `rotate(${String(adj.rotateDeg)}deg) scaleX(${adj.flipH ? -1 : 1}) scaleY(${adj.flipV ? -1 : 1})`
    : 'none';

  return (
    <div
      className={[
        'group relative aspect-square overflow-hidden rounded-xl bg-canvas-layout transition-shadow',
        selected
          ? 'shadow-card ring-2 ring-accent'
          : 'ring-1 ring-chrome hover:ring-fg-subtle',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={() => onSelect(photoId)}
        className="block h-full w-full focus-visible:outline-none"
        aria-label={`Select photo${selected ? ' (selected)' : ''}`}
        aria-pressed={selected}
      >
        {url ? (
          <img
            src={url}
            alt=""
            className="h-full w-full object-contain"
            style={{ filter, transform }}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-label text-fg-muted">
            Loading…
          </span>
        )}
      </button>

      {selected && (
        <span
          aria-hidden="true"
          className="absolute left-sm top-sm flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white shadow-card"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
      )}

      <button
        type="button"
        onClick={() => onRemove(photoId)}
        className="absolute right-sm top-sm flex h-8 w-8 items-center justify-center rounded-full bg-card/90 text-fg-muted opacity-0 shadow-card backdrop-blur transition-all hover:bg-destructive hover:text-white group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="Remove photo"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
