import { useMemo, useState } from "react";
import { BarChart3, Layers, LineChart as LineChartIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartFilters } from "@/lib/filter-context";
import { filterRawSessions } from "@/lib/filtering";
import { REGIONS } from "@/lib/mock-data";
import type { FilterDim, Region } from "@/lib/types";
import { num } from "@/lib/format";
import { ChartShapeToggle } from "@/components/dashboard/ChartShapeToggle";
import {
  LegendFilterPills,
  toggleLegendSelection,
} from "@/components/dashboard/LegendFilterPills";
import { segmentLabelVertical, usePaletteVersion } from "./segment-label";

export const REGION_MONTHLY_FILTER: {
  id: string;
  applicable: readonly FilterDim[];
} = {
  id: "regionMonthly",
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

const REGION_FULL: Record<Region, string> = {
  NA: "North America",
  EU: "Europe",
  ASIA: "Asia",
  SA: "South America",
};

// Stable color per region — matches the chart palette used elsewhere.
const REGION_COLOR: Record<Region, string> = {
  NA:   "var(--chart-1)",
  EU:   "var(--chart-2)",
  ASIA: "var(--chart-3)",
  SA:   "var(--chart-4)",
};

type Shape = "stacked" | "grouped" | "line";

// Per-segment labels use the shared `segmentLabelVertical` so tiny
// values pop out to the right of the bar with a leader — see
// segment-label.tsx for the rendering details.

type Row = { month: string } & Partial<Record<Region, number>> & { total: number };

export function RegionMonthly() {
  usePaletteVersion();
  const { effective, setOverride } = useChartFilters(
    REGION_MONTHLY_FILTER.id,
    REGION_MONTHLY_FILTER.applicable,
  );
  const [shape, setShape] = useState<Shape>("stacked");

  const { rows, presentRegions, totalSessions } = useMemo(() => {
    const sessions = filterRawSessions(effective);

    // For each month index, a per-region tally.
    const buckets = MONTH_LABELS.map(() => new Map<Region, number>());
    const monthSeen = new Set<number>();
    const regionSeen = new Set<Region>();

    for (const s of sessions) {
      const m = s.monthIndex;
      if (m < 0 || m > 11) continue;
      monthSeen.add(m);
      regionSeen.add(s.region);
      const bucket = buckets[m]!;
      bucket.set(s.region, (bucket.get(s.region) ?? 0) + 1);
    }

    // Keep the canonical region order from REGIONS so colors and legend
    // ordering stay stable across filter changes.
    const presentRegions: Region[] = REGIONS.filter((r) => regionSeen.has(r));

    const months = monthSeen.size > 0
      ? [...monthSeen].sort((a, b) => a - b)
      : MONTH_LABELS.map((_, i) => i);

    const rows: Row[] = months.map((m) => {
      const b = buckets[m]!;
      const row: Row = { month: MONTH_LABELS[m]!, total: 0 };
      for (const r of presentRegions) {
        const v = b.get(r) ?? 0;
        row[r] = v;
        row.total += v;
      }
      return row;
    });

    const totalSessions = rows.reduce((s, r) => s + r.total, 0);
    return { rows, presentRegions, totalSessions };
  }, [effective]);

  // Legend pill click → isolate that region via the chart's own override
  // (click again on the lone selection to clear).
  const toggleRegion = (region: string) => {
    setOverride({ region: toggleLegendSelection(effective.region, region) });
  };

  // Static legend items — always show all four regions even when one is
  // filtered out of the data, so the user can switch between them with a
  // single click instead of clearing the filter first.
  const legendItems = (["NA", "EU", "ASIA", "SA"] as const).map((r) => ({
    value: r,
    label: REGION_FULL[r],
    color: REGION_COLOR[r],
  }));

  if (totalSessions === 0) {
    return (
      <div className="grid h-[300px] place-items-center text-sm text-muted-foreground">
        No usage data matches the current filter.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <ChartShapeToggle
          value={shape}
          onChange={setShape}
          ariaLabel="Chart type"
          options={[
            { value: "stacked", label: "Stacked", icon: Layers },
            { value: "grouped", label: "Grouped", icon: BarChart3 },
            { value: "line", label: "Line", icon: LineChartIcon },
          ]}
        />
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {shape === "line" ? (
            <LineChart data={rows} margin={{ top: 48, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="month"
                stroke="var(--muted-foreground)"
                fontSize={13}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={13}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => num(v)}
                width={56}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  fontSize: 13,
                  padding: "10px 12px",
                  boxShadow: "0 8px 24px -12px rgba(0,0,0,0.15)",
                }}
                cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }}
                formatter={(v, name) => [`${num(Number(v))} runs`, REGION_FULL[name as Region] ?? (name as string)]}
                labelFormatter={(label) => `Month: ${label}`}
              />
              <Legend
                verticalAlign="top"
                wrapperStyle={{ paddingBottom: 24 }}
                content={() => (
                  <LegendFilterPills
                    items={legendItems}
                    selected={effective.region}
                    onToggle={toggleRegion}
                    noun="region"
                  />
                )}
              />
              {presentRegions.map((r) => (
                <Line
                  key={r}
                  type="monotone"
                  dataKey={r}
                  name={r}
                  stroke={REGION_COLOR[r]}
                  strokeWidth={2.4}
                  dot={{ r: 3, fill: REGION_COLOR[r], strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                >
                  <LabelList
                    dataKey={r}
                    position="top"
                    formatter={(v) => (Number(v) > 0 ? num(Number(v)) : "")}
                    style={{
                      fill: "var(--foreground)",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  />
                </Line>
              ))}
            </LineChart>
          ) : (
            <BarChart data={rows} margin={{ top: 48, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="month"
                stroke="var(--muted-foreground)"
                fontSize={13}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={13}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => num(v)}
                width={56}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  fontSize: 13,
                  padding: "10px 12px",
                  boxShadow: "0 8px 24px -12px rgba(0,0,0,0.15)",
                }}
                cursor={{ fill: "var(--muted)" }}
                formatter={(v, name) => [`${num(Number(v))} runs`, REGION_FULL[name as Region] ?? (name as string)]}
                labelFormatter={(label) => `Month: ${label}`}
              />
              <Legend
                verticalAlign="top"
                wrapperStyle={{ paddingBottom: 24 }}
                content={() => (
                  <LegendFilterPills
                    items={legendItems}
                    selected={effective.region}
                    onToggle={toggleRegion}
                    noun="region"
                  />
                )}
              />
              {presentRegions.map((r, i) => {
                const isLast = i === presentRegions.length - 1;
                return (
                  <Bar
                    key={r}
                    dataKey={r}
                    name={r}
                    fill={REGION_COLOR[r]}
                    stackId={shape === "stacked" ? "region" : undefined}
                    radius={
                      shape === "stacked"
                        ? isLast
                          ? [6, 6, 0, 0]
                          : [0, 0, 0, 0]
                        : [4, 4, 0, 0]
                    }
                    maxBarSize={shape === "stacked" ? 48 : 22}
                  >
                    {shape === "stacked" ? (
                      <LabelList dataKey={r} content={segmentLabelVertical(REGION_COLOR[r])} />
                    ) : (
                      <LabelList
                        dataKey={r}
                        position="top"
                        formatter={(v) => (Number(v) > 0 ? num(Number(v)) : "")}
                        style={{
                          fill: "var(--foreground)",
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      />
                    )}
                    {shape === "stacked" && isLast ? (
                      <LabelList
                        dataKey="total"
                        position="top"
                        formatter={(v) => num(Number(v))}
                        style={{
                          fill: "var(--foreground)",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      />
                    ) : null}
                  </Bar>
                );
              })}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
