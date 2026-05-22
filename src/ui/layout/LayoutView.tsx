/**
 * LayoutView.tsx — the print-sheet layout + export view.
 *
 * Pick a paper size and passport preset, set a per-photo copy count, see a live
 * scaled sheet preview (packed by the real `shelfPack` engine), and export the
 * sheet to PNG / JPG / PDF via the export-engine. Multiple distinct photos with
 * mixed copy counts on one sheet is fully supported — each photo is one
 * `CellGroup`.
 *
 * SCOPE: a view component — DOM/React only. Named exports only.
 */
import { useEffect, useState } from 'react';
import { useDocumentStore, useLayoutStore } from '../../state';
import type { CellGroup } from '../../layout-engine/types';
import {
  passportPresets,
  paperSizes,
  validateCustomDimensions,
} from '../../templates';
import type { ExportFormat } from '../../export-engine';
import { downloadBlob, deriveExportName } from '../utils/downloadBlob';
import { assetRepo } from '../../storage';
import { exportSheet } from '../export/exportSheet';
import { btnPrimary, card, field } from '../theme/controls';
import { SheetPreview } from './SheetPreview';
import {
  type Orientation,
  getOrientation,
  withOrientation,
  suggestOrientation,
} from './orientation';

/** The Layout view. */
export function LayoutView(): React.ReactElement {
  const photos = useDocumentStore((s) => s.photos);
  const activePresetId = useDocumentStore((s) => s.activePresetId);
  const setActivePreset = useDocumentStore((s) => s.setActivePreset);
  const paper = useLayoutStore((s) => s.paper);
  const setPaper = useLayoutStore((s) => s.setPaper);
  const cellGroups = useLayoutStore((s) => s.cellGroups);
  const setCellGroups = useLayoutStore((s) => s.setCellGroups);
  const spacing = useLayoutStore((s) => s.spacing);

  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [borderMm, setBorderMm] = useState(0);
  const [borderColor, setBorderColor] = useState('#000000');
  const [customMode, setCustomMode] = useState(false);
  const [customW, setCustomW] = useState(35);
  const [customH, setCustomH] = useState(45);

  const preset =
    passportPresets.find((p) => p.id === activePresetId) ?? passportPresets[0]!;

  // The custom photo size is used only when "Custom size" is selected AND the
  // entered dimensions are valid (20–100 mm); otherwise the cell falls back to
  // the active preset so the sheet still packs.
  const customCheck = validateCustomDimensions(customW, customH);
  const customValid = customMode && customCheck.ok;
  const cellWidthMm = customValid ? customW : preset.outer.widthMm;
  const cellHeightMm = customValid ? customH : preset.outer.heightMm;

  // Derive cell groups from photos whenever photos or the cell size change.
  // Each photo becomes one CellGroup at the effective mm size; existing copy
  // counts are preserved.
  useEffect(() => {
    const size = { widthMm: cellWidthMm, heightMm: cellHeightMm };
    const next: CellGroup[] = photos.map((p) => {
      const existing = cellGroups.find((g) => g.photoId === p.id);
      return {
        id: `group-${p.id}`,
        photoId: p.id,
        size,
        count: existing?.count ?? 4,
      };
    });
    // Only write if something actually changed (avoids an update loop).
    const changed =
      next.length !== cellGroups.length ||
      next.some((g, i) => {
        const c = cellGroups[i];
        return (
          !c ||
          c.photoId !== g.photoId ||
          c.count !== g.count ||
          c.size.widthMm !== g.size.widthMm ||
          c.size.heightMm !== g.size.heightMm
        );
      });
    if (changed) setCellGroups(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, cellWidthMm, cellHeightMm]);

  // Orientation is derived from the paper's longer side, not stored separately.
  // The suggestion compares photo capacity in both orientations.
  const orientation = getOrientation(paper);
  const orientationSuggestion = suggestOrientation(paper, cellGroups, spacing);

  const setOrientation = (next: Orientation): void => {
    setPaper(withOrientation(paper, next));
  };

  const setCount = (photoId: string, count: number): void => {
    setCellGroups(
      cellGroups.map((g) =>
        g.photoId === photoId ? { ...g, count: Math.max(0, count) } : g,
      ),
    );
  };

  const handleExport = async (format: ExportFormat): Promise<void> => {
    setExporting(true);
    setStatus(null);
    try {
      const result = await exportSheet({
        format,
        cutMarks: true,
        borderMm,
        borderColor,
      });
      if (result.ok) {
        const ext = format === 'jpeg' ? 'jpg' : format;
        // Name the sheet after the first photo on it, tagged `_multi`.
        const first = photos[0];
        const asset = first ? await assetRepo.getBlob(first.assetId) : null;
        const name = deriveExportName(asset?.fileName, 'multi', ext);
        downloadBlob(result.blob, name);
        setStatus(`Exported ${name} (${formatBytes(result.blob.size)})`);
      } else {
        setStatus(`Export failed: ${result.reason}`);
      }
    } catch (err) {
      setStatus(`Export failed: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setExporting(false);
    }
  };

  if (photos.length === 0) {
    return (
      <div className="mx-auto max-w-readable p-lg">
        <div
          className={`${card} flex flex-col items-center gap-xs p-2xl text-center`}
        >
          <p className="text-body font-medium">Nothing to lay out yet</p>
          <p className="text-label text-fg-muted">
            Import a photo first, then come back to build your print sheet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-readable flex-col gap-lg p-lg lg:flex-row lg:items-start">
      {/* Preview */}
      <div className="flex flex-1 items-start justify-center rounded-xl border border-chrome bg-canvas-layout p-lg lg:sticky lg:top-lg">
        <SheetPreview
          paper={paper}
          cellGroups={cellGroups}
          spacing={spacing}
          borderMm={borderMm}
          borderColor={borderColor}
        />
      </div>

      {/* Controls */}
      <div className="flex w-full flex-col gap-md lg:max-w-prose">
        <div className={`${card} flex flex-col gap-md p-md`}>
          <label className="flex flex-col gap-xs">
            <span className="text-label font-medium">Paper size</span>
            <select
              value={
                paperSizes.find((p) => {
                  if (!p.dimensionsMm) return false;
                  // Match regardless of orientation — sides may be swapped.
                  const { widthMm: w, heightMm: h } = p.dimensionsMm;
                  return (
                    (w === paper.widthMm && h === paper.heightMm) ||
                    (w === paper.heightMm && h === paper.widthMm)
                  );
                })?.id ?? 'a4'
              }
              onChange={(e) => {
                const ps = paperSizes.find((p) => p.id === e.target.value);
                // Keep the current orientation when switching paper size.
                if (ps?.dimensionsMm) {
                  setPaper(withOrientation(ps.dimensionsMm, orientation));
                }
              }}
              className={field}
            >
              {paperSizes
                .filter((p) => p.dimensionsMm)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
            </select>
          </label>

          <div className="flex flex-col gap-xs">
            <span className="text-label font-medium">Orientation</span>
            <div className="flex gap-xs rounded-lg bg-muted p-xs">
              {(['portrait', 'landscape'] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  aria-pressed={orientation === o}
                  onClick={() => setOrientation(o)}
                  className={`min-h-[40px] flex-1 rounded-md px-md text-label font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    orientation === o
                      ? 'bg-card text-fg shadow-card'
                      : 'text-fg-muted hover:text-fg'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
            {orientationSuggestion && (
              <button
                type="button"
                onClick={() =>
                  setOrientation(orientationSuggestion.orientation)
                }
                className="flex items-start gap-sm rounded-lg border border-accent/30 bg-accent/10 px-md py-sm text-left text-label text-accent transition-colors hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span aria-hidden="true" className="mt-px shrink-0">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2v4M12 18v4M2 12h4M18 12h4M12 8a4 4 0 0 1 4 4M12 8a4 4 0 0 0-4 4" />
                  </svg>
                </span>
                <span>
                  Switch to {orientationSuggestion.orientation} to fit up to{' '}
                  <span className="font-semibold tabular-nums">
                    {orientationSuggestion.suggestedCapacity}
                  </span>{' '}
                  photos — currently{' '}
                  <span className="tabular-nums">
                    {orientationSuggestion.currentCapacity}
                  </span>
                  .
                </span>
              </button>
            )}
          </div>

          <label className="flex flex-col gap-xs">
            <span className="text-label font-medium">Photo size</span>
            <select
              value={customMode ? '__custom__' : activePresetId}
              onChange={(e) => {
                if (e.target.value === '__custom__') {
                  setCustomMode(true);
                } else {
                  setCustomMode(false);
                  setActivePreset(e.target.value);
                }
              }}
              className={field}
            >
              {passportPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
              <option value="__custom__">Custom size…</option>
            </select>
          </label>

          {customMode && (
            <div className="flex flex-col gap-sm rounded-lg bg-muted p-md">
              <p className="text-label font-medium">Custom photo size (mm)</p>
              <div className="flex items-center gap-sm">
                <label className="flex flex-1 items-center gap-sm text-label">
                  <span className="text-fg-muted">W</span>
                  <input
                    type="number"
                    min={20}
                    max={100}
                    step={0.5}
                    value={customW}
                    aria-label="Custom photo width in millimetres"
                    onChange={(e) => setCustomW(Number(e.target.value))}
                    className={field}
                  />
                </label>
                <span className="text-fg-muted">×</span>
                <label className="flex flex-1 items-center gap-sm text-label">
                  <span className="text-fg-muted">H</span>
                  <input
                    type="number"
                    min={20}
                    max={100}
                    step={0.5}
                    value={customH}
                    aria-label="Custom photo height in millimetres"
                    onChange={(e) => setCustomH(Number(e.target.value))}
                    className={field}
                  />
                </label>
              </div>
              {!customCheck.ok && (
                <p className="text-label text-destructive" role="alert">
                  {customCheck.errors.join('; ')}
                </p>
              )}
            </div>
          )}
        </div>

        <div className={`${card} flex flex-col gap-sm p-md`}>
          <p className="text-label font-medium">Copies per photo</p>
          {cellGroups.map((g, i) => (
            <label
              key={g.id}
              className="flex items-center justify-between gap-md text-label"
            >
              <span className="text-fg-muted">Photo {i + 1}</span>
              <input
                type="number"
                min={0}
                max={200}
                value={g.count}
                onChange={(e) => setCount(g.photoId, Number(e.target.value))}
                className={`${field} w-24`}
              />
            </label>
          ))}
        </div>

        <div className={`${card} flex flex-col gap-sm p-md`}>
          <div className="flex items-center justify-between">
            <p className="text-label font-medium">Photo border</p>
            <span className="text-label text-fg-muted tabular-nums">
              {borderMm === 0 ? 'Off' : `${borderMm.toFixed(1)} mm`}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={borderMm}
            aria-label="Border width in millimetres"
            onChange={(e) => setBorderMm(Number(e.target.value))}
            className="h-[44px] w-full cursor-pointer accent-accent focus-visible:outline-none"
          />
          <div className="flex flex-wrap items-center gap-sm">
            {['#000000', '#ffffff', '#3b82f6', '#dc2626', '#fbbf24'].map(
              (c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Border color ${c}`}
                  aria-pressed={borderColor.toLowerCase() === c}
                  onClick={() => setBorderColor(c)}
                  style={{ backgroundColor: c }}
                  className={`h-8 w-8 rounded-full border transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    borderColor.toLowerCase() === c
                      ? 'border-card ring-2 ring-accent'
                      : 'border-chrome'
                  }`}
                />
              ),
            )}
            <input
              type="color"
              value={borderColor}
              aria-label="Custom border color"
              onChange={(e) => setBorderColor(e.target.value)}
              className="h-8 w-10 cursor-pointer rounded-md border border-chrome bg-card"
            />
          </div>
        </div>

        <div className={`${card} flex flex-col gap-sm p-md`}>
          <p className="text-label font-medium">Export sheet</p>
          <div className="flex flex-wrap gap-sm">
            {(['pdf', 'png', 'jpeg'] as ExportFormat[]).map((fmt) => (
              <button
                key={fmt}
                type="button"
                disabled={exporting}
                onClick={() => void handleExport(fmt)}
                className={`${btnPrimary} flex-1`}
              >
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
          {exporting && (
            <p className="text-label font-medium text-accent" role="status">
              Exporting…
            </p>
          )}
          {status && (
            <p
              data-testid="export-status"
              className="text-label text-fg-muted"
              role="status"
            >
              {status}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Format a byte count compactly for the export status line. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
