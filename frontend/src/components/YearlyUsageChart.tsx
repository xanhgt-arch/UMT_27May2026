import { useMemo, useState } from "react";
import { BarChart3, LineChart as LineChartIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { num } from "@/lib/format";
import { usePaletteVersion } from "@/components/dashboard/charts/segment-label";
import { ChartShapeToggle } from "@/components/dashboard/ChartShapeToggle";
import { LegendFilterPills } from "@/components/dashboard/LegendFilterPills";
import type { YearlyMonthlyUsagePoint } from "@/lib/types";

interface YearlyUsageChartProps {
  data: YearlyMonthlyUsagePoint[];
  availableYears: string[];
  selectedYears: string[];
  onToggleYear: (year: string) => void;
}

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--brand-gold)",
];

type ChartShape = "line" | "bar";

// type BarLabelProps = {
//   x?: number | string;
//   y?: number | string;
//   width?: number | string;
//   value?: number | string;
// };

function renderBarLabel(props: any) {
  const { x, y, width, value } = props;

  if (value === undefined || value === null || Number(value) === 0) return <g />;

  const cx = Number(x ?? 0) + Number(width ?? 0) / 2;
  const cy = Number(y ?? 0) - 8;

  return (
    <text
      x={cx}
      y={cy}
      fill="var(--foreground)"
      fontSize={10}
      fontWeight={600}
      textAnchor="start"
      dominantBaseline="middle"
      transform={`rotate(-90, ${cx}, ${cy})`}
    >
      {num(Number(value))}
    </text>
  );
}

export function YearlyUsageChart({ data, availableYears, selectedYears, onToggleYear }: YearlyUsageChartProps) {
  usePaletteVersion();
  const [shape, setShape] = useState<ChartShape>("bar");

  const legendItems = availableYears.map((year, index) => ({
    value: year,
    color: COLORS[index % COLORS.length],
  }));

  // Empty selection falls back to show all years.
  const visibleYears = selectedYears.length > 0 ? selectedYears : availableYears;

  // Grow bars as fewer years are selected so the chart stays readable.
  const maxBarSize = Math.max(10, Math.min(48, Math.round(96 / Math.max(1, visibleYears.length))));

  // For the line chart: find the index of each year's peak month so we can
  // render exactly one label per year (avoids congestion when lines are bunched).
  const peakIndexByYear = useMemo(() => {
    const result: Record<string, number> = {};
    for (const year of visibleYears) {
      let maxVal = -Infinity;
      let maxIdx = 0;
      data.forEach((point, i) => {
        const v = Number((point as Record<string, unknown>)[year] ?? 0);
        if (v > maxVal) { maxVal = v; maxIdx = i; }
      });
      result[year] = maxIdx;
    }
    return result;
  }, [data, visibleYears]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <LegendFilterPills
          items={legendItems}
          selected={selectedYears}
          onToggle={onToggleYear}
          noun="year"
        />
        <ChartShapeToggle
          value={shape}
          onChange={setShape}
          ariaLabel="Chart type"
          options={[
            { value: "line", label: "Line", icon: LineChartIcon },
            { value: "bar", label: "Bar", icon: BarChart3 },
          ]}
        />
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {shape === "bar" ? (
            <BarChart
              data={data}
              margin={{ top: 64, right: 12, left: -8, bottom: 0 }}
              barCategoryGap="16%"
              barGap={2}
            >
              <defs>
                {availableYears.map((year, index) => {
                  const color = COLORS[index % COLORS.length];
                  return (
                    <linearGradient
                      key={year}
                      id={`yearlyUsageGrad${year}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.6} />
                    </linearGradient>
                  );
                })}
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
              {visibleYears.map((year) => (
                <Bar
                  key={year}
                  dataKey={year}
                  name={year}
                  fill={`url(#yearlyUsageGrad${year})`}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={maxBarSize}
                >
                  <LabelList dataKey={year} content={renderBarLabel} />
                </Bar>
              ))}
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
              {visibleYears.map((year) => {
                const yearIdx = availableYears.indexOf(year);
                const color = COLORS[yearIdx % COLORS.length];
                const peakIdx = peakIndexByYear[year] ?? -1;
                return (
                  <Line
                    key={year}
                    type="monotone"
                    dataKey={year}
                    name={year}
                    stroke={color}
                    strokeWidth={2.2}
                    dot={{ r: 3, fill: color, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  >
                    <LabelList
                      dataKey={year}
                      content={(props: any) => {
                        if (props.index !== peakIdx) return <g />;
                        return (
                          <text
                            x={Number(props.x ?? 0)}
                            y={Number(props.y ?? 0) - 10}
                            fill={color}
                            fontSize={10}
                            fontWeight={700}
                            textAnchor="middle"
                          >
                            {num(Number(props.value))}
                          </text>
                        );
                      }}
                    />
                  </Line>
                );
              })}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
