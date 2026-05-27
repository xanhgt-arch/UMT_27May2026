import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useChartFilters } from "@/lib/filter-context";
import { filterApplicationUsage } from "@/lib/filtering";
import type { FilterDim } from "@/lib/types";
import { num, pct } from "@/lib/format";
import { isLightFill, pickTextOnFill, usePaletteVersion } from "./segment-label";

export const APP_DONUT_FILTER: { id: string; applicable: readonly FilterDim[] } = {
  id: "appDonut",
  applicable: ["range", "cad", "productLine", "region", "hardware"],
};

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

type PieLabelProps = {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  value?: number;
  percent?: number;
  index?: number;
};

// Beyond the brand palette, stay on-brand by alternating between
// Cooper Standard blue (~250°) and gold (~80°) hues and stepping
// lightness so every slice past index 5 remains visually distinct
// without leaving the company colour story.
function colorAt(i: number, total: number): string {
  if (i < PALETTE.length) return PALETTE[i];
  const k = i - PALETTE.length;
  const extras = Math.max(total - PALETTE.length, 1);
  const hue = k % 2 === 0 ? 250 : 80;
  const steps = Math.max(Math.ceil(extras / 2), 1);
  const t = steps === 1 ? 0 : Math.floor(k / 2) / (steps - 1);
  const L = 0.50 + t * 0.32;
  const C = k % 2 === 0 ? 0.15 : 0.16;
  return `oklch(${L.toFixed(2)} ${C} ${hue})`;
}

export function ApplicationDonut() {
  usePaletteVersion();
  const { effective } = useChartFilters(APP_DONUT_FILTER.id, APP_DONUT_FILTER.applicable);
  const apps = useMemo(
    () => filterApplicationUsage(effective),
    [effective],
  );

  const grand = apps.reduce((s, a) => s + a.total, 0) || 0;
  const data = apps.map((a) => ({ name: a.application, value: a.total }));

  if (apps.length === 0) {
    return (
      <div className="grid h-[240px] place-items-center text-sm text-muted-foreground">
        No KBE tools match the current filter.
      </div>
    );
  }

  // Split the legend into two side-by-side columns so we don't need a
  // scrollbar — first column holds the busier half, second column the rest.
  const half = Math.ceil(apps.length / 2);
  const legendColumns = [apps.slice(0, half), apps.slice(half)];

  return (
    <div className="flex flex-col items-center justify-evenly gap-6 md:flex-row md:gap-0">
      <div className="relative aspect-square w-full max-w-[440px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              formatter={(v, name) => [`${num(Number(v))} runs`, name as string]}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--card)",
                fontSize: 13,
                padding: "10px 12px",
              }}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="50%"
              outerRadius="92%"
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={3}
              labelLine={false}
              label={(props: unknown) => {
                const RADIAN = Math.PI / 180;
                const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, value = 0, percent = 0, index = 0 } =
                  props as PieLabelProps;
                if (percent < 0.04) return null;
                const r = (innerRadius + outerRadius) / 2;
                const x = cx + r * Math.cos(-midAngle * RADIAN);
                const y = cy + r * Math.sin(-midAngle * RADIAN);
                const sliceColor = colorAt(index ?? 0, data.length);
                const fill = pickTextOnFill(sliceColor);
                // SVG attribute `fill=` does NOT resolve CSS var() — only the
                // `style` property does. Setting fill through style ensures
                // var(--foreground) actually paints black in light mode.
                const isLight = isLightFill(sliceColor);
                const textStyle = isLight
                  ? { fill }
                  : {
                      fill,
                      paintOrder: "stroke" as const,
                      stroke: "rgba(0,0,0,0.25)",
                      strokeWidth: 2,
                    };
                return (
                  <g>
                    <text
                      x={x}
                      y={y - 8}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={13}
                      fontWeight={700}
                      style={textStyle}
                    >
                      {num(value)}
                    </text>
                    <text
                      x={x}
                      y={y + 8}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={11}
                      fontWeight={600}
                      style={textStyle}
                    >
                      {`${Math.round(percent * 100)}%`}
                    </text>
                  </g>
                );
              }}
              isAnimationActive={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colorAt(i, data.length)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total runs</div>
          <div className="num mt-0.5 text-3xl font-semibold">{num(grand)}</div>
        </div>
      </div>

      {/* Two side-by-side legend columns instead of one long scrollable
          list. Each inner <ul> is its own 3-column grid (name | count |
          percent) where `display:contents` on the <li> lets the row's
          three cells participate in the parent grid so columns stay
          aligned across every row in that column. */}
      <div className="flex shrink-0 gap-6">
        {legendColumns.map((col, colIdx) => {
          const offset = colIdx === 0 ? 0 : half;
          return (
            <ul
              key={colIdx}
              className="grid w-fit grid-cols-[auto_auto_auto] items-center gap-x-3 gap-y-1 self-start"
            >
              {col.map((a, j) => {
                const i = offset + j; // absolute index → matches pie slice colour
                return (
                  <li
                    key={a.application}
                    className="contents [&>*]:rounded-md [&>*]:py-1 hover:[&>*]:bg-muted/40"
                  >
                    <div className="flex min-w-0 items-center gap-2 pl-1.5">
                      <span
                        className="block size-2.5 shrink-0 rounded-full"
                        style={{ background: colorAt(i, apps.length) }}
                      />
                      <div className="min-w-0">
                        <div
                          className="truncate text-[13px] font-medium leading-tight"
                          title={a.application}
                        >
                          {a.application}
                        </div>
                        <div className="truncate text-[10px] leading-tight text-muted-foreground">
                          {a.cad} · {a.productLine}
                        </div>
                      </div>
                    </div>
                    <span className="num text-right text-[13px] font-semibold tabular-nums">
                      {num(a.total)}
                    </span>
                    <span className="num pr-1.5 text-right text-[10px] tabular-nums text-muted-foreground">
                      {pct(a.total / grand)}
                    </span>
                  </li>
                );
              })}
            </ul>
          );
        })}
      </div>
    </div>
  );
}
