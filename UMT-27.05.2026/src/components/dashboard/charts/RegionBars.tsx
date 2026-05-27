import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
} from "recharts";
import { useChartFilters } from "@/lib/filter-context";
import { filterRawSessions } from "@/lib/filtering";
import type { FilterDim } from "@/lib/types";
import { num } from "@/lib/format";
import { segmentLabelHorizontal, usePaletteVersion } from "./segment-label";
import {
  LegendFilterPills,
  toggleLegendSelection,
} from "@/components/dashboard/LegendFilterPills";

export const REGION_BARS_FILTER: { id: string; applicable: readonly FilterDim[] } = {
  id: "regionBars",
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

const REGION_LABEL: Record<string, string> = {
  NA: "North America",
  EU: "Europe",
  ASIA: "Asia",
  SA: "South America",
};

const CATIA_COLOR = "var(--chart-1)";
const NX_COLOR = "var(--chart-2)";
const OTHER_COLOR = "var(--chart-4)";

// Per-segment labels use the shared `segmentLabelHorizontal` so tiny
// values pop out above the bar with a leader — see segment-label.tsx
// for the rendering details.

type Row = {
  region: string;
  regionLabel: string;
  CATIA: number;
  NX: number;
  Other: number;
  total: number;
};

export function RegionBars() {
  usePaletteVersion();
  const { effective, setOverride } = useChartFilters(REGION_BARS_FILTER.id, REGION_BARS_FILTER.applicable);

  // Legend pill click → isolate that CAD (or "Other") via the chart's own
  // override. Clicking the lone selection again clears the filter.
  // "Other" maps to "everything that's not CATIA or NX" — we model it by
  // setting cad to ["__OTHER__"], which is just an empty match against the
  // real CAD values, effectively hiding CATIA & NX bars. To keep things
  // simple we only wire CATIA / NX here.
  const toggleCad = (cad: string) => {
    setOverride({ cad: toggleLegendSelection(effective.cad, cad) });
  };

  const legendItems = [
    { value: "CATIA", color: CATIA_COLOR },
    { value: "NX", color: NX_COLOR },
  ] as const;

  const data = useMemo<Row[]>(() => {
    const sessions = filterRawSessions(effective);
    const byRegion = new Map<string, { CATIA: number; NX: number; Other: number }>();
    for (const s of sessions) {
      const cad = String(s.cad ?? "").toUpperCase();
      const bucket = byRegion.get(s.region) ?? { CATIA: 0, NX: 0, Other: 0 };
      if (cad === "CATIA") bucket.CATIA++;
      else if (cad === "NX") bucket.NX++;
      else bucket.Other++;
      byRegion.set(s.region, bucket);
    }
    return [...byRegion.entries()]
      .map(([region, b]) => ({
        region,
        regionLabel: REGION_LABEL[region] ?? region,
        ...b,
        total: b.CATIA + b.NX + b.Other,
      }))
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [effective]);

  const hasOther = useMemo(() => data.some((d) => d.Other > 0), [data]);

  const average = useMemo(() => {
    if (data.length === 0) return 0;
    return data.reduce((s, d) => s + d.total, 0) / data.length;
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="grid h-[300px] place-items-center text-sm text-muted-foreground">
        No regions match the current filter.
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 24, right: 72, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            stroke="var(--muted-foreground)"
            fontSize={13}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => num(v)}
          />
          <YAxis
            type="category"
            dataKey="regionLabel"
            stroke="var(--muted-foreground)"
            fontSize={13}
            tickLine={false}
            axisLine={false}
            width={140}
            tick={{ fill: "var(--foreground)" }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--card)",
              fontSize: 13,
              padding: "10px 12px",
            }}
            cursor={{ fill: "var(--muted)" }}
            formatter={(v, name) => [`${num(Number(v))} runs`, name as string]}
          />
          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ paddingBottom: 6 }}
            content={() => (
              <LegendFilterPills
                items={legendItems}
                selected={effective.cad}
                onToggle={toggleCad}
                noun="CAD"
                className="justify-end pr-1"
              />
            )}
          />
          {average > 0 && data.length > 1 ? (
            <ReferenceLine
              x={average}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              label={{
                value: `Avg ${num(Math.round(average))}`,
                position: "top",
                fill: "var(--muted-foreground)",
                fontSize: 11,
              }}
            />
          ) : null}
          <Bar dataKey="CATIA" name="CATIA" stackId="cad" fill={CATIA_COLOR} radius={[0, 0, 0, 0]}>
            <LabelList dataKey="CATIA" content={segmentLabelHorizontal(CATIA_COLOR)} />
          </Bar>
          <Bar dataKey="NX" name="NX" stackId="cad" fill={NX_COLOR} radius={hasOther ? [0, 0, 0, 0] : [0, 8, 8, 0]}>
            <LabelList dataKey="NX" content={segmentLabelHorizontal(NX_COLOR)} />
          </Bar>
          {hasOther ? (
            <Bar dataKey="Other" name="Other" stackId="cad" fill={OTHER_COLOR} radius={[0, 8, 8, 0]}>
              <LabelList dataKey="Other" content={segmentLabelHorizontal(OTHER_COLOR)} />
              <LabelList
                dataKey="total"
                position="right"
                formatter={(v) => num(Number(v))}
                style={{ fill: "var(--foreground)", fontSize: 13, fontWeight: 600 }}
              />
            </Bar>
          ) : (
            <Bar dataKey="total" name="" stackId="totalLabel" fill="transparent" isAnimationActive={false}>
              <LabelList
                dataKey="total"
                position="right"
                formatter={(v) => num(Number(v))}
                style={{ fill: "var(--foreground)", fontSize: 13, fontWeight: 600 }}
              />
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
