/**
 * ui — the React UI surface (non-engine; React/Cropper.js are permitted here).
 *
 * The single barrel for the production app: the responsive `AppShell` (which
 * hosts the Photos / Edit / Layout views) and the PWA `UpdatePrompt`. The DOM
 * UI replaces the former react-konva canvas stack — see ui-rebuild-NOTES.md.
 * Named exports only.
 */
export { AppShell } from './shell/AppShell';
export { UpdatePrompt } from './pwa/UpdatePrompt';
