import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChartFilterPopover } from "./ChartFilterPopover";
import { ChartFilterChips } from "./ChartFilterChips";
import { cn } from "@/lib/utils";
import type { FilterDim } from "@/lib/types";

export type ChartCardProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /**
   * If provided, ChartCard renders per-chart filters wired to this chart id.
   * The same `id` and `applicable` should be used by the chart's
   * `useChartFilters(id, applicable)` call.
   */
  filter?: { id: string; applicable: readonly FilterDim[] };
  /**
   * How filters are rendered:
   * - "popover" (default): a single "Filter" button in the header corner.
   * - "chips":   a chip row underneath the description, matching the page-level
   *              filter-chip design — useful when there is no global filter bar.
   */
  filterStyle?: "popover" | "chips";
  /** Extra chip(s) rendered before the standard filter chips (only used when filterStyle="chips"). */
  filterPrefixSlot?: React.ReactNode;
};

/**
 * One question, one card. The title is phrased as a plain-English question,
 * the description gives the user a one-line guide for what the chart shows.
 */
export function ChartCard({
  title,
  description,
  action,
  children,
  className,
  filter,
  filterStyle = "popover",
  filterPrefixSlot,
}: ChartCardProps) {
  const useChips = filter && filterStyle === "chips";

  const right =
    action ??
    (filter && !useChips ? (
      <ChartFilterPopover chartId={filter.id} applicable={filter.applicable} />
    ) : null);

  return (
    <Card className={cn("card-brand-shadow overflow-hidden", className)}>
      <CardHeader className="gap-1.5 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[#0E4DA1] transition-colors group-hover/card:text-[color:oklch(0.55_0.13_82)] dark:text-primary dark:group-hover/card:text-[color:oklch(0.83_0.16_88)]">
              <span aria-hidden className="inline-flex items-center gap-0.5">
                <span className="size-1.5 rounded-full bg-[oklch(0.43_0.17_256)]" />
                <span className="size-1.5 rounded-full bg-[oklch(0.83_0.16_88)]" />
              </span>
              {title}
            </h3>
            {description ? (
              <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {right}
        </div>
        {useChips ? (
          <div className="pt-2">
            <ChartFilterChips
              chartId={filter!.id}
              applicable={filter!.applicable}
              prefixSlot={filterPrefixSlot}
            />
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}
