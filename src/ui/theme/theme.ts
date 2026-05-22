/**
 * theme.ts — light/dark theme state for the UI.
 *
 * The resolved theme is expressed as a single `dark` class on `<html>`; all
 * colour tokens re-theme off that class (see `src/index.css`). The user's
 * choice is persisted under `STORAGE_KEY`; an unset choice follows the OS
 * `prefers-color-scheme`. `index.html` runs the same resolution inline before
 * first paint to avoid a flash — keep the two in sync.
 *
 * SCOPE: theme resolution + a React hook. Lives in `/ui`. Named exports only.
 */
import { useEffect, useState } from 'react';

/** A user theme choice — an explicit theme, or "follow the OS". */
export type ThemeMode = 'light' | 'dark' | 'system';

/** The concrete theme actually rendered. */
export type ResolvedTheme = 'light' | 'dark';

/** localStorage key holding the persisted {@link ThemeMode}. */
export const STORAGE_KEY = 'phototool-theme';

/** Read the persisted mode; `'system'` when unset or storage is unavailable. */
export function readThemeMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    /* storage blocked (private mode / SSR) — fall through */
  }
  return 'system';
}

/** Persist the chosen mode. A no-op when storage is unavailable. */
export function storeThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* storage blocked — the in-memory state still applies for this session */
  }
}

/** Whether the OS currently prefers a dark colour scheme. */
export function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

/** Resolve a mode to the concrete theme to render. */
export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return mode;
}

/** Reflect the resolved theme onto `<html>` as the `dark` class. */
export function applyTheme(resolved: ResolvedTheme): void {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

/**
 * Theme hook — returns the persisted mode, the resolved theme, and a
 * `toggle` that flips between light and dark (storing an explicit choice).
 * Keeps `<html>` in sync, and tracks the OS preference while mode is
 * `'system'`.
 */
export function useTheme(): {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
} {
  const [mode, setModeState] = useState<ThemeMode>(readThemeMode);
  const resolved = resolveTheme(mode);

  // Apply on every resolved-theme change.
  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  // While following the OS, re-apply when the OS preference flips.
  useEffect(() => {
    if (mode !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (): void => {
      applyTheme(systemPrefersDark() ? 'dark' : 'light');
    };
    mql.addEventListener('change', onChange);
    return () => {
      mql.removeEventListener('change', onChange);
    };
  }, [mode]);

  const setMode = (next: ThemeMode): void => {
    storeThemeMode(next);
    setModeState(next);
  };

  return {
    mode,
    resolved,
    setMode,
    toggle: () => {
      setMode(resolved === 'dark' ? 'light' : 'dark');
    },
  };
}
