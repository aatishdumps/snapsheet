/**
 * AppShell.tsx — the responsive 3-view application shell.
 *
 * One SPA with three views — Photos / Edit / Layout — switched by the ephemeral
 * `uiStore.mode`. A segmented tab control on desktop, a fixed bottom toolbar on
 * mobile. The shell is intentionally plain DOM/CSS: no canvas scene graph.
 *
 * SCOPE: composition + navigation chrome only — no engine logic. Named exports.
 */
import { useEffect } from 'react';
import { useUiStore, useDocumentStore } from '../../state';
import { useAdjustmentsStore } from '../state/adjustmentsStore';
import { PhotosView } from '../photos/PhotosView';
import { EditView } from '../edit/EditView';
import { LayoutView } from '../layout/LayoutView';
import { ThemeToggle } from '../theme/ThemeToggle';
import { InstallButton } from '../pwa/InstallButton';

/** The three top-level views. */
const TABS: { id: 'import' | 'edit' | 'layout'; label: string }[] = [
  { id: 'import', label: 'Photos' },
  { id: 'edit', label: 'Edit' },
  { id: 'layout', label: 'Layout' },
];

/** The responsive shell — tab navigation plus the active view. */
export function AppShell(): React.ReactElement {
  const mode = useUiStore((s) => s.mode);
  const setMode = useUiStore((s) => s.setMode);
  const photoCount = useDocumentStore((s) => s.photos.length);

  // Rehydrate persisted per-photo adjustments once at boot.
  useEffect(() => {
    void useAdjustmentsStore.getState().hydrate();
  }, []);

  return (
    <div className="flex h-screen flex-col bg-surface text-fg">
      <header className="flex items-center justify-between gap-md border-b border-chrome bg-card px-lg py-sm">
        <div className="flex items-center gap-sm">
          <img
            src="/favicon.svg"
            alt=""
            aria-hidden="true"
            width="28"
            height="28"
            className="h-7 w-7 rounded-md shadow-card"
          />
          <h1 className="text-heading font-semibold tracking-tight">
            SnapSheet
          </h1>
        </div>

        {/* Desktop: a segmented tab control. */}
        <nav
          className="hidden rounded-xl bg-muted p-xs sm:flex"
          aria-label="Views"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              aria-current={mode === tab.id ? 'page' : undefined}
              className={[
                'min-h-[40px] rounded-lg px-lg text-label font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                mode === tab.id
                  ? 'bg-card text-fg shadow-card'
                  : 'text-fg-muted hover:text-fg',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-sm">
          <span className="hidden text-label text-fg-muted tabular-nums sm:inline">
            {photoCount} photo{photoCount === 1 ? '' : 's'}
          </span>
          <InstallButton />
          <ThemeToggle />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto pb-[80px] sm:pb-0">
        {mode === 'import' && <PhotosView />}
        {mode === 'edit' && <EditView />}
        {mode === 'layout' && <LayoutView />}
      </main>

      {/* Mobile bottom toolbar. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-chrome bg-card sm:hidden"
        aria-label="Views"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMode(tab.id)}
            aria-current={mode === tab.id ? 'page' : undefined}
            className={[
              'relative flex-1 py-md text-label font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
              mode === tab.id ? 'text-accent' : 'text-fg-muted',
            ].join(' ')}
          >
            {mode === tab.id && (
              <span
                aria-hidden="true"
                className="absolute inset-x-lg top-0 h-0.5 rounded-full bg-accent"
              />
            )}
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
