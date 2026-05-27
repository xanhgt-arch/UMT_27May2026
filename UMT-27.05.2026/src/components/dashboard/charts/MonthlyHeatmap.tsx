import { useMemo } from "react";
import { useChartFilters } from "@/lib/filter-context";
import { filterRawSessions } from "@/lib/filtering";
import type { FilterDim } from "@/lib/types";
import { num } from "@/lib/format";

export const MONTHLY_HEATMAP_FILTER: {
  id: string;
  applicable: readonly FilterDim[];
} = {
  id: "monthlyHeatmap",
  applicable: [
    "range",
    "application",
    "cad",
    "productLine",
    "region",
    "domain",
    "hardware",
    "status",
  ],
};

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

// 31-day rows × 12-month columns. Each cell holds the session count for that
// (day-of-month, month) pair within the filtered window. Days that don't exist
// in a given month (e.g. Feb 30/31) stay null so they can render as muted.
type Grid = (number | null)[][];

function daysInMonth(year: number, monthZeroBased: number): number {
  return new Date(year, monthZeroBased + 1, 0).getDate();
}

function cellStyle(value: number | null, max: number): React.CSSProperties {
  if (value === null) {
    // Out-of-range day for that month — keep a faint, distinct surface so it
    // reads as "not applicable" rather than "zero sessions".
    return {
      background:
        "repeating-linear-gradient(45deg, var(--muted) 0 2px, transparent 2px 4px)",
      opacity: 0.35,
    };
  }
  if (value === 0 || max === 0) {
    return { background: "var(--muted)" };
  }
  const intensity = Math.min(1, value / max);
  // Brand blue (oklch) scaled by intensity, with a guaranteed visible floor so
  // even one-session days stay readable.
  const alpha = 0.18 + intensity * 0.82;
  return { background: `oklch(0.43 0.17 256 / ${alpha})` };
}

function legendStops(): number[] {
  return [0, 0.2, 0.4, 0.6, 0.8, 1];
}

export function MonthlyHeatmap() {
  const { effective } = useChartFilters(
    MONTHLY_HEATMAP_FILTER.id,
    MONTHLY_HEATMAP_FILTER.applicable,
  );

  const { grid, monthTotals, maxCell, maxMonth, totalSessions, year } = useMemo(() => {
    const sessions = filterRawSessions(effective);
    const grid: Grid = Array.from({ length: 31 }, () =>
      new Array<number | null>(12).fill(0),
    );
    const monthTotals = new Array<number>(12).fill(0);

    // Use the year of the most recent session in the filtered window so day-
    // count masking (Feb 28 vs 29 etc.) tracks the data, not "today".
    let year = new Date().getFullYear();
    if (sessions.length > 0) {
      year = sessions.reduce((max, s) => (s.startMs > max.startMs ? s : max), sessions[0]!).year;
    }

    // Mask non-existent days (e.g. Feb 30/31) so they render as "n/a".
    for (let m = 0; m < 12; m++) {
      const dim = daysInMonth(year, m);
      for (let d = dim; d < 31; d++) grid[d]![m] = null;
    }

    for (const s of sessions) {
      const m = s.monthIndex;
      const d = s.dayIndex;
      if (m < 0 || m > 11 || d < 0 || d > 30) continue;
      const cell = grid[d]![m];
      if (cell === null) continue;
      grid[d]![m] = cell + 1;
      monthTotals[m]! += 1;
    }

    let maxCell = 0;
    for (const row of grid) {
      for (const v of row) {
        if (v !== null && v > maxCell) maxCell = v;
      }
    }
    const maxMonth = Math.max(0, ...monthTotals);
    const totalSessions = monthTotals.reduce((s, v) => s + v, 0);
    return { grid, monthTotals, maxCell, maxMonth, totalSessions, year };
  }, [effective]);

  if (totalSessions === 0) {
    return (
      <div className="grid h-[300px] place-items-center text-sm text-muted-foreground">
        No usage data matches the current filter.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Compact summary line */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div>
          <span className="font-medium text-foreground">{num(totalSessions)}</span>{" "}
          sessions across {year} · peak day{" "}
          <span className="font-medium text-foreground">{num(maxCell)}</span> · busiest month{" "}
          <span className="font-medium text-foreground">{num(maxMonth)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Less</span>
          <div className="flex gap-0.5">
            {legendStops().map((stop) => (
              <div
                key={stop}
                className="size-3 rounded-[3px] ring-1 ring-inset ring-black/5"
                style={cellStyle(stop === 0 ? 0 : Math.max(1, Math.round(stop * maxCell)), maxCell)}
              />
            ))}
          </div>
          <span>More</span>
        </div>
      </div>

      {/* Horizontal scroll wrapper for narrow viewports — keeps cells square */}
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[640px]">
          {/* Header: empty cell + 12 month labels */}
          <div className="grid grid-cols-[28px_repeat(12,minmax(0,1fr))] gap-x-1.5 pb-1">
            <div />
            {MONTH_LABELS.map((m) => (
              <div
                key={m}
                className="text-center text-[11px] font-medium text-muted-foreground"
              >
                {m}
              </div>
            ))}
          </div>

          {/* 31 day rows */}
          <div className="space-y-[3px]">
            {Array.from({ length: 31 }).map((_, dayIdx) => {
              const dayNumber = dayIdx + 1;
              const showLabel = dayNumber === 1 || dayNumber % 5 === 0;
              return (
                <div
                  key={dayIdx}
                  className="grid grid-cols-[28px_repeat(12,minmax(0,1fr))] items-center gap-x-1.5"
                >
                  <div className="text-right text-[10px] tabular-nums text-muted-foreground">
                    {showLabel ? dayNumber : ""}
                  </div>
                  {MONTH_LABELS.map((m, monthIdx) => {
                    const v = grid[dayIdx]![monthIdx]!;
                    const title =
                      v === null
                        ? `${m} ${dayNumber}: n/a`
                        : v === 0
                          ? `${m} ${dayNumber}: 0 runs`
                          : `${m} ${dayNumber}: ${num(v)} run${v === 1 ? "" : "s"}`;
                    return (
                      <div
                        key={monthIdx}
                        title={title}
                        className="h-[14px] rounded-[3px] ring-1 ring-inset ring-black/5 transition-transform hover:scale-110 hover:ring-foreground/30"
                        style={cellStyle(v, maxCell)}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Footer: month totals */}
          <div className="mt-3 grid grid-cols-[28px_repeat(12,minmax(0,1fr))] gap-x-1.5 border-t border-border pt-2">
            <div className="text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Σ
            </div>
            {monthTotals.map((total, mi) => (
              <div
                key={mi}
                className="text-center text-[11px] font-semibold tabular-nums text-foreground"
              >
                {total > 0 ? num(total) : "—"}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
