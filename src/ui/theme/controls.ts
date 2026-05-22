/**
 * controls.ts — shared control className strings for the UI surface.
 *
 * The redesign uses one consistent button / field / card vocabulary across
 * every view. Keeping the Tailwind class strings here (rather than copy-pasted
 * inline) is what guarantees a primary button looks identical in Photos, Edit,
 * and Layout. Compose with a template literal when a caller needs extras.
 *
 * SCOPE: presentation constants only — no logic. Named exports only.
 */

/** Card / panel surface — hairline border, soft elevation. */
export const card = 'rounded-xl border border-chrome bg-card shadow-card';

/** Text input / select field. */
export const field =
  'min-h-[44px] w-full rounded-lg border border-chrome bg-card px-md text-label ' +
  'text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-accent focus-visible:border-accent';

/** Shared button geometry + focus ring; never used directly. */
const btnBase =
  'inline-flex min-h-[44px] items-center justify-center gap-sm rounded-lg ' +
  'px-lg text-label font-medium transition-colors focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none ' +
  'disabled:opacity-40';

/** Primary action — solid accent. */
export const btnPrimary = `${btnBase} bg-accent text-white hover:bg-accent-hover`;

/** Secondary action — outlined, neutral. */
export const btnSecondary = `${btnBase} border border-chrome bg-card text-fg hover:bg-muted`;

/** A square 44×44 icon button, outlined like a secondary button. */
export const iconButton =
  'inline-flex h-11 w-11 items-center justify-center rounded-lg border ' +
  'border-chrome bg-card text-fg transition-colors hover:bg-muted ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
