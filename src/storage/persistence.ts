/**
 * persistence.ts — `navigator.storage` eviction-defense wrappers (OFF-03 / D-13).
 *
 * Browsers may evict IndexedDB under storage pressure, and iOS WebKit clears
 * unpersisted storage after ~7 days of inactivity (Pitfall 1). Calling
 * `navigator.storage.persist()` early upgrades the origin to persistent
 * storage, which is exempt from automatic eviction; `persisted()` reports the
 * current status so the Phase 6 UI can surface it and recommend a backup
 * export (D-12 — the backup file is the recovery path).
 *
 * SCOPE: headless storage — NO React/Konva imports, and NO network calls ever
 * (OFF-03). Every API touch is feature-detected so non-supporting environments
 * (older browsers, the Node test runner) degrade to `false` rather than throw.
 */

/**
 * Request persistent storage for this origin. Feature-detects the Storage API;
 * if already persisted, short-circuits to `true` without re-requesting.
 * Returns `true` when storage is (or becomes) persistent, `false` otherwise.
 */
export async function requestPersistence(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
