/**
 * InstallButton.tsx — a header button to install SnapSheet as a PWA.
 *
 * Browsers that support PWA install (Chromium desktop / Android) fire a
 * `beforeinstallprompt` event when the app is installable. We capture it,
 * suppress the default mini-infobar, and surface our own button — clicking it
 * replays the saved event's native install prompt. The button is hidden when
 * the app is not installable (already installed, unsupported browser such as
 * iOS Safari, or criteria unmet).
 *
 * SCOPE: a thin shell component. Lives in `/ui`. Named exports only.
 */
import { useEffect, useState } from 'react';

/**
 * The non-standard `beforeinstallprompt` event — not in the DOM lib types.
 * Carries the deferred install prompt for the current page.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Header button that triggers the browser's PWA install prompt. */
export function InstallButton(): React.ReactElement | null {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    const onPrompt = (e: Event): void => {
      // Suppress the default mini-infobar; we drive install from our button.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    // Once installed, the prompt can never fire again — drop the button.
    const onInstalled = (): void => {
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!deferred) return null;

  const install = async (): Promise<void> => {
    await deferred.prompt();
    await deferred.userChoice;
    // A deferred prompt is single-use — discard it regardless of the choice.
    setDeferred(null);
  };

  return (
    <button
      type="button"
      onClick={() => void install()}
      className="inline-flex min-h-11 items-center gap-sm rounded-lg border border-chrome bg-card px-md text-label font-medium text-fg transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
      </svg>
      <span className="hidden sm:inline">Install app</span>
      <span className="sm:hidden">Install</span>
    </button>
  );
}
