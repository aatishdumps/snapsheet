/**
 * bakePhoto.ts — render one photo's adjustments into a flat bitmap/Blob.
 *
 * Applies geometry (rotate / flip / crop) and the CSS-filter adjustments to a
 * photo's working bitmap, producing a fresh upright RGBA result. The filter is
 * applied with `ctx.filter = buildFilterString(...)` — the SAME string the
 * `<img>` preview uses — so a baked photo matches what the user saw (WYSIWYG).
 *
 * Used by the Edit view's "Apply crop" (bakes a new working bitmap + asset) and
 * by the export path (bakes every photo before handing them to `runExport`).
 *
 * SCOPE: DOM canvas work — lives in `/ui` (canvas/DOM permitted here).
 */
import { getBitmap, putBitmap } from '../../state';
import { assetRepo } from '../../storage';
import { buildFilterString } from '../state/buildFilterString';
import type { PhotoAdjustments } from '../state/photoAdjustments';

/** A baked photo result — the flat bitmap plus its PNG blob. */
export interface BakedPhoto {
  /** The flattened, upright, filtered bitmap. */
  bitmap: ImageBitmap;
  /** A lossless PNG blob of the same pixels — persist this as the new asset. */
  blob: Blob;
}

/**
 * Resolve a photo's source bitmap: prefer the in-memory `bitmapCache`, else
 * decode the original asset Blob from IndexedDB (e.g. after a page reload).
 */
export async function resolveSourceBitmap(
  assetId: string,
): Promise<ImageBitmap | null> {
  const cached = getBitmap(assetId);
  if (cached) return cached;
  const asset = await assetRepo.getBlob(assetId);
  if (!asset) return null;
  const bmp = await createImageBitmap(asset.blob);
  putBitmap(assetId, bmp);
  return bmp;
}

/**
 * Bake `adj` onto `src`, returning a flattened bitmap + PNG blob.
 *
 * Pipeline: build a canvas at the post-rotation size, apply flip/rotate via the
 * canvas transform, draw the (optionally cropped) source, then re-draw through
 * `ctx.filter` so the color stack lands on flat pixels.
 *
 * @param src the source working bitmap
 * @param adj the photo's adjustments — geometry + CSS-filter values
 */
export async function bakeBitmap(
  src: ImageBitmap,
  adj: PhotoAdjustments,
): Promise<BakedPhoto> {
  // 1. Resolve the crop region in source pixels.
  const crop = adj.crop;
  const sx = crop ? Math.round(crop.x * src.width) : 0;
  const sy = crop ? Math.round(crop.y * src.height) : 0;
  const sw = crop ? Math.max(1, Math.round(crop.w * src.width)) : src.width;
  const sh = crop ? Math.max(1, Math.round(crop.h * src.height)) : src.height;

  // 2. Geometry stage — draw the crop into a canvas with rotate/flip applied.
  const rot = ((adj.rotateDeg % 360) + 360) % 360;
  const swapped = rot === 90 || rot === 270;
  const gW = swapped ? sh : sw;
  const gH = swapped ? sw : sh;

  const geo = document.createElement('canvas');
  geo.width = gW;
  geo.height = gH;
  const gctx = geo.getContext('2d');
  if (!gctx) throw new Error('bakePhoto: 2D context unavailable');
  gctx.save();
  gctx.translate(gW / 2, gH / 2);
  gctx.rotate((rot * Math.PI) / 180);
  gctx.scale(adj.flipH ? -1 : 1, adj.flipV ? -1 : 1);
  gctx.drawImage(src, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
  gctx.restore();

  // 3. Color stage — re-draw through ctx.filter (same string as the preview).
  const out = document.createElement('canvas');
  out.width = gW;
  out.height = gH;
  const octx = out.getContext('2d');
  if (!octx) throw new Error('bakePhoto: 2D context unavailable');
  const filter = buildFilterString({
    ...adj,
    // geometry already applied — only the color stack must remain.
    rotateDeg: 0,
    flipH: false,
    flipV: false,
    crop: null,
  });
  octx.filter = filter;
  octx.drawImage(geo, 0, 0);
  octx.filter = 'none';

  const blob = await new Promise<Blob>((resolve, reject) => {
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('bakePhoto: toBlob failed'))),
      'image/png',
    );
  });
  const bitmap = await createImageBitmap(out);
  return { bitmap, blob };
}

/**
 * Bake a photo identified by `assetId` with `adj`, resolving its source bitmap
 * automatically. Returns `null` if the asset cannot be found.
 */
export async function bakePhoto(
  assetId: string,
  adj: PhotoAdjustments,
): Promise<BakedPhoto | null> {
  const src = await resolveSourceBitmap(assetId);
  if (!src) return null;
  return bakeBitmap(src, adj);
}

/**
 * Draw a solid border frame around a baked photo, insetting the image so the
 * outer dimensions (and therefore the cell's aspect ratio) are unchanged.
 *
 * The border thickness is given in mm relative to the printed cell size, so it
 * prints at a true physical width regardless of the baked bitmap's resolution.
 *
 * @param baked        the photo already baked (crop + geometry + filters)
 * @param cellWidthMm  the printed cell width, mm
 * @param cellHeightMm the printed cell height, mm
 * @param borderMm     border thickness, mm — `<= 0` returns `baked` unchanged
 * @param borderColor  any CSS color string
 */
export async function addBorder(
  baked: BakedPhoto,
  cellWidthMm: number,
  cellHeightMm: number,
  borderMm: number,
  borderColor: string,
): Promise<BakedPhoto> {
  if (borderMm <= 0 || cellWidthMm <= 0 || cellHeightMm <= 0) return baked;
  const w = baked.bitmap.width;
  const h = baked.bitmap.height;
  const insetX = Math.min(
    Math.round((borderMm / cellWidthMm) * w),
    Math.floor(w / 2) - 1,
  );
  const insetY = Math.min(
    Math.round((borderMm / cellHeightMm) * h),
    Math.floor(h / 2) - 1,
  );
  if (insetX <= 0 && insetY <= 0) return baked;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('addBorder: 2D context unavailable');
  ctx.fillStyle = borderColor;
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(
    baked.bitmap,
    Math.max(0, insetX),
    Math.max(0, insetY),
    w - 2 * Math.max(0, insetX),
    h - 2 * Math.max(0, insetY),
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('addBorder: toBlob failed'))),
      'image/png',
    );
  });
  const bitmap = await createImageBitmap(canvas);
  return { bitmap, blob };
}
