import { useMemo } from "react";
import { useChartFilters } from "@/lib/filter-context";
import { filterDomainUsage } from "@/lib/filtering";
import type { FilterDim } from "@/lib/types";
import { num, pct } from "@/lib/format";

export const DOMAIN_LIST_FILTER: { id: string; applicable: readonly FilterDim[] } = {
  id: "domainList",
  applicable: ["range", "application", "cad", "productLine", "region", "hardware"],
};

/**
 * Plain progress-bar list — much friendlier than another bar chart.
 */
export function DomainList() {
  const { effective } = useChartFilters(DOMAIN_LIST_FILTER.id, DOMAIN_LIST_FILTER.applicable);
  const list = useMemo(() => filterDomainUsage(effective), [effective]);

  if (list.length === 0) {
    return (
      <div className="grid h-[200px] place-items-center text-sm text-muted-foreground">
        No domains match the current filter.
      </div>
    );
  }

  const max = Math.max(...list.map((d) => d.sessions));
  const total = list.reduce((s, d) => s + d.sessions, 0);

  return (
    <ul className="space-y-3.5">
      {list.map((d, i) => {
        const widthPct = (d.sessions / max) * 100;
        return (
          <li key={d.domain}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 truncate">
                <span className="num w-5 text-right text-xs text-muted-foreground">{i + 1}</span>
                <span className="truncate font-medium">{d.domain}</span>
              </div>
              <div className="num flex shrink-0 items-baseline gap-3 tabular-nums">
                <span className="font-semibold">{num(d.sessions)}</span>
                <span className="w-12 text-right text-xs text-muted-foreground">
                  {pct(d.sessions / total)}
                </span>
              </div>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/80 transition-[width] duration-500"
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
