/**
 * CropModal.tsx — the Cropper.js crop dialog.
 *
 * Opens a modal with a Cropper.js instance over the selected photo. The crop
 * box aspect ratio is LOCKED to the active passport preset's width/height, so
 * the user can only produce a compliant crop. On "Apply", the crop box is read
 * back as a normalized 0–1 rect and handed to the caller, which stores it on
 * the photo's adjustments (baked at export / on apply).
 *
 * SCOPE: a modal UI component — DOM/React + Cropper.js. Named exports only.
 */
import { useEffect, useRef } from 'react';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import type { CropRect } from '../state/photoAdjustments';
import { btnPrimary, btnSecondary } from '../theme/controls';

/** Props for {@link CropModal}. */
export interface CropModalProps {
  /** Object URL of the image to crop. */
  imageUrl: string;
  /** Locked aspect ratio (width / height) from the active preset. */
  aspectRatio: number;
  /** An existing crop to seed the cropper with, if any. */
  initialCrop: CropRect | null;
  /** Apply — receives the chosen crop as a normalized 0–1 rect. */
  onApply: (crop: CropRect) => void;
  /** Cancel — close without changing anything. */
  onCancel: () => void;
}

/** The Cropper.js crop dialog with a preset-locked aspect ratio. */
export function CropModal({
  imageUrl,
  aspectRatio,
  initialCrop,
  onApply,
  onCancel,
}: CropModalProps): React.ReactElement {
  const imgRef = useRef<HTMLImageElement>(null);
  const cropperRef = useRef<Cropper | null>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    // Cropper requires the <img> to be loaded; the `ready` event fires after.
    const cropper = new Cropper(img, {
      aspectRatio,
      viewMode: 1,
      autoCropArea: 1,
      background: false,
      ready() {
        if (initialCrop) {
          const data = cropper.getImageData();
          cropper.setData({
            x: initialCrop.x * data.naturalWidth,
            y: initialCrop.y * data.naturalHeight,
            width: initialCrop.w * data.naturalWidth,
            height: initialCrop.h * data.naturalHeight,
          });
        }
      },
    });
    cropperRef.current = cropper;
    return () => {
      cropper.destroy();
      cropperRef.current = null;
    };
  }, [imageUrl, aspectRatio, initialCrop]);

  const handleApply = (): void => {
    const cropper = cropperRef.current;
    if (!cropper) return;
    // getData() is in NATURAL image pixels; getImageData() gives natural size.
    const data = cropper.getData();
    const img = cropper.getImageData();
    const nw = img.naturalWidth || 1;
    const nh = img.naturalHeight || 1;
    const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
    onApply({
      x: clamp01(data.x / nw),
      y: clamp01(data.y / nh),
      w: clamp01(data.width / nw),
      h: clamp01(data.height / nh),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Crop photo"
      className="fixed inset-0 z-50 flex flex-col bg-black/70 p-lg backdrop-blur-sm"
    >
      <div className="mx-auto flex max-h-full w-full max-w-readable flex-col gap-md rounded-xl border border-chrome bg-card p-lg shadow-pop">
        <div className="flex flex-col gap-xs">
          <h2 className="text-heading font-semibold tracking-tight">
            Crop photo
          </h2>
          <p className="text-label text-fg-muted">
            The crop box is locked to the selected photo's aspect ratio.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg bg-canvas-editor">
          {/* Cropper replaces this <img> with its own canvas UI. */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Crop preview"
            className="block max-h-[60vh] max-w-full"
          />
        </div>
        <div className="flex justify-end gap-sm">
          <button type="button" onClick={onCancel} className={btnSecondary}>
            Cancel
          </button>
          <button type="button" onClick={handleApply} className={btnPrimary}>
            Apply crop
          </button>
        </div>
      </div>
    </div>
  );
}
