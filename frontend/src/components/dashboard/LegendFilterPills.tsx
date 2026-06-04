import { cn } from "@/lib/utils";

export type LegendPillItem = {
  /** Filter value passed back through `onToggle`. */
  value: string;
  /** Display label. Defaults to `value` when not provided. */
  label?: string;
  /** Colour used for the round indicator dot. */
  color: string;
};

type Props = {
  items: ReadonlyArray<LegendPillItem>;
  /** Currently selected filter values. `[]` means "no filter" (all selected). */
  selected: readonly string[];
  /**
   * Invoked when the user clicks a pill. Behaviour expected by callers:
   *   - no filter → set `[value]`
   *   - lone `value` selected → clear (`[]`)
   *   - other selection → replace with `[value]`
   * Callers usually implement this with a tiny `toggle` helper.
   */
  onToggle: (value: string) => void;
  /** Optional className passthrough on the wrapper (positioning, gap, …). */
  className?: string;
  /** Localised noun for the screen-reader title on each pill ("CAD", "region", …). */
  noun?: string;
};

/**
 * Cooper-themed clickable legend. Each pill doubles as a filter shortcut:
 * click to isolate that series, click the lone selection again to clear.
 * Selection state must be lifted into the parent (typically the chart's
 * `useChartFilters` override slot) so the chart and the pills stay in sync.
 */
export function LegendFilterPills({
  items,
  selected,
  onToggle,
  className,
  noun = "series",
}: Props) {
  const hasFilter = selected.length > 0;
  return (
    <div
      className={cn(
        "flex flex-wrap justify-center gap-2 text-[13px]",
        className,
      )}
    >
      {items.map((item) => {
        const isOn = selected.includes(item.value);
        const isMuted = hasFilter && !isOn;
        const label = item.label ?? item.value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onToggle(item.value)}
            aria-pressed={hasFilter ? isOn : false}
            title={
              isOn
                ? `Clear ${label} filter`
                : hasFilter
                  ? `Switch ${noun} to ${label}`
                  : `Show only ${label}`
            }
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium transition-colors",
              "hover:bg-[oklch(0.83_0.16_88_/_0.22)] hover:text-foreground",
              isOn
                ? "bg-primary/10 text-foreground ring-1 ring-primary/30"
                : isMuted
                  ? "text-muted-foreground/70 opacity-70"
                  : "text-foreground",
            )}
          >
            <span
              aria-hidden
              className="block size-2 rounded-full"
              style={{ background: item.color }}
            />
            {label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Common toggle behaviour callers want. Returns the next selection array
 * given the current one and the value the user clicked. Pure → easy to test.
 */
export function toggleLegendSelection(
  selected: readonly string[],
  value: string,
): string[] {
  const isOnly = selected.length === 1 && selected[0] === value;
  return isOnly ? [] : [value];
}
