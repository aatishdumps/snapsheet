/**
 * AdjustSlider.tsx — one labelled range slider for an adjustment value.
 *
 * SCOPE: a presentational UI control. Lives in `/ui`. Named exports only.
 */

/** Props for {@link AdjustSlider}. */
export interface AdjustSliderProps {
  /** Visible label. */
  label: string;
  /** Current value. */
  value: number;
  /** Minimum value. */
  min: number;
  /** Maximum value. */
  max: number;
  /** Step granularity; defaults to 1. */
  step?: number;
  /** Called with the new value as the slider moves. */
  onChange: (value: number) => void;
}

/** A labelled range slider with a live numeric readout. */
export function AdjustSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: AdjustSliderProps): React.ReactElement {
  return (
    <label className="flex flex-col gap-xs">
      <span className="flex items-center justify-between text-label">
        <span className="font-medium text-fg">{label}</span>
        <span className="min-w-9 rounded-md bg-muted px-sm py-xs text-center text-fg-muted tabular-nums">
          {value}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-[44px] w-full cursor-pointer accent-accent focus-visible:outline-none"
      />
    </label>
  );
}
