import { useMemo } from "react";
import { useChartFilters } from "@/lib/filter-context";
import { filterRawSessions } from "@/lib/filtering";
import type { FilterDim } from "@/lib/types";
import { num } from "@/lib/format";

export const YEAR_HEATMAP_FILTER: {
  id: string;
  applicable: readonly FilterDim[];
} = {
  id: "yearHeatmap",
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

function cellStyle(value: number, max: number): React.CSSProperties {
  if (max === 0) {
    return { background: "var(--muted)" };
  }
  if (value === 0) {
    return { background: "var(--muted)" };
  }
  const intensity = Math.min(1, value / max);
  // Brand blue (oklch) scaled by intensity. Floor keeps tiny values readable.
  const alpha = 0.18 + intensity * 0.82;
  return { background: `oklch(0.43 0.17 256 / ${alpha})` };
}

export function YearHeatmap() {
  const { effective } = useChartFilters(
    YEAR_HEATMAP_FILTER.id,
    YEAR_HEATMAP_FILTER.applicable,
  );

  const { monthTotals, year, maxMonth, totalSessions, busiestIdx, quietestIdx } =
    useMemo(() => {
      const sessions = filterRawSessions(effective);
      const monthTotals = new Array<number>(12).fill(0);

      let year = new Date().getFullYear();
      if (sessions.length > 0) {
        year = sessions.reduce((max, s) => (s.startMs > max.startMs ? s : max), sessions[0]!).year;
      }

      for (const s of sessions) {
        const m = s.monthIndex;
        if (m < 0 || m > 11) continue;
        monthTotals[m]! += 1;
      }

      const maxMonth = Math.max(0, ...monthTotals);
      const totalSessions = monthTotals.reduce((s, v) => s + v, 0);

      let busiestIdx = -1;
      let quietestIdx = -1;
      let bestSeen = -1;
      let lowestSeen = Number.POSITIVE_INFINITY;
      for (let i = 0; i < 12; i++) {
        const v = monthTotals[i]!;
        if (v > bestSeen) {
          bestSeen = v;
          busiestIdx = i;
        }
        if (v > 0 && v < lowestSeen) {
          lowestSeen = v;
          quietestIdx = i;
        }
      }
      return { monthTotals, year, maxMonth, totalSessions, busiestIdx, quietestIdx };
    }, [effective]);

  if (totalSessions === 0) {
    return (
      <div className="grid h-[180px] place-items-center text-sm text-muted-foreground">
        No usage data matches the current filter.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary line */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div>
          <span className="font-medium text-foreground">{num(totalSessions)}</span>{" "}
          sessions across {year}
          {busiestIdx >= 0 ? (
            <>
              {" · busiest "}
              <span className="font-medium text-foreground">
                {MONTH_LABELS[busiestIdx]} ({num(maxMonth)})
              </span>
            </>
          ) : null}
          {quietestIdx >= 0 && quietestIdx !== busiestIdx ? (
            <>
              {" · quietest "}
              <span className="font-medium text-foreground">
                {MONTH_LABELS[quietestIdx]} ({num(monthTotals[quietestIdx]!)})
              </span>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span>Less</span>
          <div className="flex gap-0.5">
            {[0, 0.2, 0.4, 0.6, 0.8, 1].map((stop) => (
              <div
                key={stop}
                className="size-3 rounded-[3px] ring-1 ring-inset ring-black/5"
                style={cellStyle(
                  stop === 0 ? 0 : Math.max(1, Math.round(stop * maxMonth)),
                  maxMonth,
                )}
              />
            ))}
          </div>
          <span>More</span>
        </div>
      </div>

      {/* 12-cell month grid: stacks 4 wide on phones, 6 on tablet, 12 on desktop */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
        {monthTotals.map((total, mi) => {
          const isMax = mi === busiestIdx && maxMonth > 0;
          const intensity = maxMonth === 0 ? 0 : total / maxMonth;
          const labelOnDark = intensity > 0.55;
          return (
            <div
              key={mi}
              title={`${MONTH_LABELS[mi]} ${year}: ${num(total)} session${total === 1 ? "" : "s"}`}
              className={
                "group relative flex aspect-square flex-col items-center justify-center rounded-xl ring-1 ring-inset ring-black/5 transition-transform hover:scale-[1.03] hover:ring-foreground/30 " +
                (isMax ? "ring-2 ring-[oklch(0.55_0.13_82)]/70" : "")
              }
              style={cellStyle(total, maxMonth)}
            >
              <div
                className={
                  "text-[11px] font-medium uppercase tracking-wide " +
                  (labelOnDark ? "text-white/85" : "text-muted-foreground")
                }
              >
                {MONTH_LABELS[mi]}
              </div>
              <div
                className={
                  "num text-lg font-semibold tabular-nums " +
                  (labelOnDark ? "text-white" : "text-foreground")
                }
              >
                {total > 0 ? num(total) : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
