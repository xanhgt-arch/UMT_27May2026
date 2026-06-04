import { useMemo, useState } from "react";
import { BarChart3, LineChart as LineChartIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartFilters } from "@/lib/filter-context";
import { filterMonthlyCad } from "@/lib/filtering";
import type { FilterDim } from "@/lib/types";
import { num } from "@/lib/format";
import { ChartShapeToggle } from "@/components/dashboard/ChartShapeToggle";
import {
  LegendFilterPills,
  toggleLegendSelection,
} from "@/components/dashboard/LegendFilterPills";
import { segmentLabelVertical, usePaletteVersion } from "./segment-label";

const CAD_LEGEND_ITEMS = [
  { value: "CATIA", color: "var(--chart-1)" },
  { value: "NX", color: "var(--chart-2)" },
] as const;

// Per-segment labels use the shared `segmentLabelVertical` so tiny
// values pop out to the right of the bar with a leader instead of
// being clipped inside the stack. See segment-label.tsx for details.

export const MONTHLY_TOTAL_FILTER: {
  id: string;
  applicable: readonly FilterDim[];
} = {
  id: "monthlyTotal",
  applicable: [
    "range",
    "application",
    "cad",
    "productLine",
    "region",
    "domain",
    "hardware",
  ],
};

type ChartShape = "bar" | "line";

type RoundedBarShapeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: { NX?: number };
};

export function MonthlyUsageTotal() {
  usePaletteVersion();
  const { effective, setOverride } = useChartFilters(
    MONTHLY_TOTAL_FILTER.id,
    MONTHLY_TOTAL_FILTER.applicable,
  );

  const data = useMemo(() => filterMonthlyCad(effective), [effective]);
  const [shape, setShape] = useState<ChartShape>("bar");

  const showCatia = effective.cad.length === 0 || effective.cad.includes("CATIA");
  const showNx    = effective.cad.length === 0 || effective.cad.includes("NX");

  // Legend pill click → isolate that CAD via the chart's own filter override.
  // Clicking the lone selection again clears the filter (restores both CADs).
  const toggleCad = (cad: string) => {
    setOverride({ cad: toggleLegendSelection(effective.cad, cad) });
  };

  const average = useMemo(() => {
    if (data.length === 0) return 0;
    const total = data.reduce((s, d) => s + d.total, 0);
    return total / data.length;
  }, [data]);

  if (data.length === 0) {
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
            { value: "bar", label: "Bar", icon: BarChart3 },
            { value: "line", label: "Line", icon: LineChartIcon },
          ]}
        />
      </div>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {shape === "bar" ? (
            <BarChart
              data={data}
              margin={{ top: 24, right: 12, left: -8, bottom: 0 }}
            >
              <defs>
                <linearGradient id="catiaBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.6} />
                </linearGradient>
                <linearGradient id="nxBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
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
                formatter={(v, name) => [`${num(Number(v))} runs`, name as string]}
                labelFormatter={(label) => `Month: ${label}`}
              />
              <Legend
                verticalAlign="top"
                wrapperStyle={{ paddingBottom: 8 }}
                content={() => (
                  <LegendFilterPills
                    items={CAD_LEGEND_ITEMS}
                    selected={effective.cad}
                    onToggle={toggleCad}
                    noun="CAD"
                  />
                )}
              />
              {average > 0 ? (
                <ReferenceLine
                  y={average}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                  label={{
                    value: `Avg ${num(Math.round(average))}`,
                    position: "insideTopRight",
                    fill: "var(--muted-foreground)",
                    fontSize: 11,
                  }}
                />
              ) : null}
              {showCatia && (
                <Bar
                  dataKey="CATIA"
                  name="CATIA"
                  stackId="usage"
                  fill="url(#catiaBarGrad)"
                  maxBarSize={48}
                  shape={(props: unknown) => {
                    const { x = 0, y = 0, width = 0, height = 0, payload = {} } =
                      props as RoundedBarShapeProps;
                    const shouldRoundTop = !showNx || payload.NX === 0;
                    const radius = shouldRoundTop ? 8 : 0;
                    return (
                      <path
                        d={`
                M${x},${y + radius}
                Q${x},${y} ${x + radius},${y}
                H${x + width - radius}
                Q${x + width},${y} ${x + width},${y + radius}
                V${y + height}
                H${x}
                Z
              `}
                        fill="url(#catiaBarGrad)"
                      />
                    );
                  }}
                >
                  <LabelList
                    dataKey="CATIA"
                    content={segmentLabelVertical({ color: "var(--chart-1)" })}
                  />
                </Bar>
              )}
              {showNx && (
                <Bar
                  dataKey="NX"
                  name="NX"
                  stackId="usage"
                  fill="url(#nxBarGrad)"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={48}
                >
                  <LabelList
                    dataKey="NX"
                    content={segmentLabelVertical({
                      color: "var(--chart-2)",
                      insideFill: "var(--foreground)",
                    })}
                  />
                  <LabelList
                    dataKey="total"
                    position="top"
                    formatter={(v) => num(Number(v))}
                    style={{
                      fill: "var(--foreground)",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  />
                </Bar>
              )}
              {showCatia && !showNx && (
                <Bar
                  dataKey="_hidden"
                  name=""
                  stackId="usage"
                  fill="transparent"
                  maxBarSize={48}
                >
                  <LabelList
                    dataKey="total"
                    position="top"
                    formatter={(v) => num(Number(v))}
                    style={{
                      fill: "var(--foreground)",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  />
                </Bar>
              )}
            </BarChart>
          ) : (
            <LineChart
              data={data}
              margin={{ top: 24, right: 12, left: -8, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
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
                formatter={(v, name) => [`${num(Number(v))} runs`, name as string]}
                labelFormatter={(label) => `Month: ${label}`}
              />
              <Legend
                verticalAlign="top"
                wrapperStyle={{ paddingBottom: 8 }}
                content={() => (
                  <LegendFilterPills
                    items={CAD_LEGEND_ITEMS}
                    selected={effective.cad}
                    onToggle={toggleCad}
                    noun="CAD"
                  />
                )}
              />
              {average > 0 ? (
                <ReferenceLine
                  y={average}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                  label={{
                    value: `Avg ${num(Math.round(average))}`,
                    position: "insideTopRight",
                    fill: "var(--muted-foreground)",
                    fontSize: 11,
                  }}
                />
              ) : null}
              {showCatia && (
                <Line
                  type="monotone"
                  dataKey="CATIA"
                  name="CATIA"
                  stroke="var(--chart-1)"
                  strokeWidth={2.6}
                  dot={{ r: 3, fill: "var(--chart-1)", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                >
                  <LabelList
                    dataKey="CATIA"
                    position="top"
                    offset={8}
                    formatter={(v) => num(Number(v))}
                style={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }}
                  />
                </Line>
              )}
              {showNx && (
                <Line
                  type="monotone"
                  dataKey="NX"
                  name="NX"
                  stroke="var(--chart-2)"
                  strokeWidth={2.2}
                  dot={{ r: 3, fill: "var(--chart-2)", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                >
                  <LabelList
                    dataKey="NX"
                    position="bottom"
                    offset={8}
                    formatter={(v) => num(Number(v))}
                style={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }}
                  />
                </Line>
              )}
              {showCatia && showNx && (
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Total"
                  stroke="var(--foreground)"
                  strokeWidth={1.6}
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              )}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
