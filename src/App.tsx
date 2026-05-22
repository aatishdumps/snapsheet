/**
 * App.tsx — the application composition root.
 *
 * Renders the responsive `AppShell` plus the PWA `UpdatePrompt`. At boot it
 * runs the two side-effects the app needs exactly once: `startAutosave()`
 * (debounced persistence — STO-01) and `requestPersistence()` (eviction
 * defense — requested early, Pitfall 6: an iOS Home-Screen PWA grants
 * persistent storage far more reliably when asked at first interaction).
 *
 * SCOPE: composition + boot wiring only — no engine logic.
 */
import { useEffect } from 'react';
import { AppShell, UpdatePrompt } from './ui';
import { startAutosave, requestPersistence } from './storage';

/** Boot the app: start autosave and request persistent storage, once. */
function useBoot(): void {
  useEffect(() => {
    startAutosave();
    void requestPersistence();
  }, []);
}

function App() {
  useBoot();
  return (
    <>
      <AppShell />
      <UpdatePrompt />
    </>
  );
}

export default App;
