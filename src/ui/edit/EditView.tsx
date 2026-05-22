/**
 * EditView.tsx — the single-photo editing view.
 *
 * Operates on the selected photo: live CSS-filter adjustment sliders, rotate
 * left/right, flip H/V, a Cropper.js crop modal locked to the active passport
 * preset's aspect ratio, plus reset and undo. Adjustment values live in the
 * `adjustmentsStore` (persisted) and are baked at export.
 *
 * Crop is fully non-destructive: pressing "Apply crop" only stores the crop
 * rectangle on the photo's `PhotoAdjustments`, so Undo / Reset cover it like
 * any colour slider. The imported original bitmap is never overwritten.
 *
 * SCOPE: a view component — DOM/React only. Named exports only.
 */
import { useState } from 'react';
import { useDocumentStore, useUiStore } from '../../state';
import { passportPresets } from '../../templates';
import { assetRepo } from '../../storage';
import { usePhotoUrl } from '../photo/usePhotoUrl';
import { useBakedPhotoUrl } from '../photo/useBakedPhotoUrl';
import { bakeBitmap, resolveSourceBitmap } from '../photo/bakePhoto';
import { downloadBlob, deriveExportName } from '../utils/downloadBlob';
import { useAdjustmentsStore } from '../state/adjustmentsStore';
import { DEFAULT_ADJUSTMENTS, type CropRect } from '../state/photoAdjustments';
import { btnPrimary, btnSecondary, card, field } from '../theme/controls';
import { AdjustSlider } from './AdjustSlider';
import { CropModal } from './CropModal';

/** The Edit view. */
export function EditView(): React.ReactElement {
  const photos = useDocumentStore((s) => s.photos);
  const activePresetId = useDocumentStore((s) => s.activePresetId);
  const setActivePreset = useDocumentStore((s) => s.setActivePreset);
  const selectionId = useUiStore((s) => s.selectionId);
  const setMode = useUiStore((s) => s.setMode);

  const adj = useAdjustmentsStore((s) =>
    selectionId ? s.entries[selectionId]?.current ?? DEFAULT_ADJUSTMENTS : DEFAULT_ADJUSTMENTS,
  );
  const patch = useAdjustmentsStore((s) => s.patch);
  const undo = useAdjustmentsStore((s) => s.undo);
  const reset = useAdjustmentsStore((s) => s.reset);
  const canUndo = useAdjustmentsStore((s) =>
    selectionId ? (s.entries[selectionId]?.history.length ?? 0) > 0 : false,
  );

  const [cropOpen, setCropOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // The crop modal needs the pristine source; the preview needs the baked
  // result so crop / rotate / flip / colour all show together (WYSIWYG).
  const sourceUrl = usePhotoUrl(selectionId);
  const previewUrl = useBakedPhotoUrl(selectionId, adj);

  if (selectionId === null || !photos.some((p) => p.id === selectionId)) {
    return (
      <div className="mx-auto max-w-readable p-lg">
        <div
          className={`${card} flex flex-col items-center gap-xs p-2xl text-center`}
        >
          <p className="text-body font-medium">No photo selected</p>
          <p className="text-label text-fg-muted">
            Pick a photo in the Photos view to start editing.
          </p>
        </div>
      </div>
    );
  }

  const photoId = selectionId;
  const preset =
    passportPresets.find((p) => p.id === activePresetId) ?? passportPresets[0]!;
  const aspect = preset.outer.widthMm / preset.outer.heightMm;

  /**
   * Store the applied crop as a non-destructive adjustment. The crop rect goes
   * through the same `patch` history as the colour sliders, so Undo / Reset
   * cover it automatically. The imported original bitmap is never modified.
   */
  const applyCrop = (crop: CropRect): void => {
    setCropOpen(false);
    patch(photoId, { crop });
  };

  /** Bake the current edits (crop + geometry + filters) and download a PNG. */
  const saveImage = async (): Promise<void> => {
    setSaving(true);
    try {
      const src = await resolveSourceBitmap(photoId);
      if (!src) return;
      const baked = await bakeBitmap(src, adj);
      const asset = await assetRepo.getBlob(photoId);
      downloadBlob(baked.blob, deriveExportName(asset?.fileName, 'edited', 'png'));
    } finally {
      setSaving(false);
    }
  };

  const rotate = (delta: number): void => {
    patch(photoId, { rotateDeg: (((adj.rotateDeg + delta) % 360) + 360) % 360 });
  };

  return (
    <div className="mx-auto flex max-w-readable flex-col gap-lg p-lg lg:flex-row">
      {/* Preview */}
      <div className="flex min-h-[320px] flex-1 items-center justify-center rounded-xl border border-chrome bg-canvas-editor p-lg">
        {previewUrl ? (
          <img
            data-testid="edit-preview"
            src={previewUrl}
            alt="Editing preview"
            className="max-h-[60vh] max-w-full rounded-md object-contain shadow-pop"
          />
        ) : (
          <span className="text-label text-fg-muted">Loading…</span>
        )}
      </div>

      {/* Controls */}
      <div className="flex w-full flex-col gap-md lg:max-w-prose">
        <label className="flex flex-col gap-xs">
          <span className="text-label font-medium">Crop ratio</span>
          <span className="text-label text-fg-muted">
            Sets the aspect ratio the Crop tool locks to.
          </span>
          <select
            value={activePresetId}
            onChange={(e) => setActivePreset(e.target.value)}
            className={field}
          >
            {passportPresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-sm">
          <span className="text-label font-medium">Transform</span>
          <div className="flex flex-wrap gap-sm">
            <button type="button" onClick={() => rotate(-90)} className={btnSecondary}>
              ⟲ Rotate L
            </button>
            <button type="button" onClick={() => rotate(90)} className={btnSecondary}>
              ⟳ Rotate R
            </button>
            <button
              type="button"
              onClick={() => patch(photoId, { flipH: !adj.flipH })}
              className={btnSecondary}
              aria-pressed={adj.flipH}
            >
              Flip H
            </button>
            <button
              type="button"
              onClick={() => patch(photoId, { flipV: !adj.flipV })}
              className={btnSecondary}
              aria-pressed={adj.flipV}
            >
              Flip V
            </button>
            <button
              type="button"
              onClick={() => setCropOpen(true)}
              className={btnPrimary}
            >
              Crop
            </button>
          </div>
        </div>

        <div className={`${card} flex flex-col gap-sm p-md`}>
          <span className="text-label font-medium">Adjustments</span>
          <AdjustSlider label="Brightness" value={adj.brightness} min={-100} max={100}
            onChange={(v) => patch(photoId, { brightness: v })} />
          <AdjustSlider label="Contrast" value={adj.contrast} min={-100} max={100}
            onChange={(v) => patch(photoId, { contrast: v })} />
          <AdjustSlider label="Saturation" value={adj.saturation} min={-100} max={100}
            onChange={(v) => patch(photoId, { saturation: v })} />
          <AdjustSlider label="Exposure" value={adj.exposure} min={-100} max={100}
            onChange={(v) => patch(photoId, { exposure: v })} />
          <AdjustSlider label="Temperature" value={adj.temperature} min={-100} max={100}
            onChange={(v) => patch(photoId, { temperature: v })} />
          <AdjustSlider label="Tint" value={adj.tint} min={-100} max={100}
            onChange={(v) => patch(photoId, { tint: v })} />
          <AdjustSlider label="Blur" value={adj.blur} min={0} max={10} step={0.1}
            onChange={(v) => patch(photoId, { blur: v })} />
          <AdjustSlider label="Whiten background" value={adj.whiten} min={0} max={100}
            onChange={(v) => patch(photoId, { whiten: v })} />
        </div>

        <div className="flex flex-wrap gap-sm">
          <button
            type="button"
            disabled={!canUndo}
            onClick={() => undo(photoId)}
            className={btnSecondary}
          >
            Undo
          </button>
          <button type="button" onClick={() => reset(photoId)} className={btnSecondary}>
            Reset
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveImage()}
            className={btnSecondary}
          >
            {saving ? 'Saving…' : 'Save image'}
          </button>
          <button
            type="button"
            onClick={() => setMode('layout')}
            className={`${btnPrimary} flex-1`}
          >
            Go to layout →
          </button>
        </div>
      </div>

      {cropOpen && sourceUrl && (
        <CropModal
          imageUrl={sourceUrl}
          aspectRatio={aspect}
          initialCrop={adj.crop}
          onApply={applyCrop}
          onCancel={() => setCropOpen(false)}
        />
      )}
    </div>
  );
}
