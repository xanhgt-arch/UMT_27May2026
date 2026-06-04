import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useChartFilters } from "@/lib/filter-context";
import { filterCadUsage } from "@/lib/filtering";
import type { FilterDim } from "@/lib/types";
import { num, pct } from "@/lib/format";
import { isLightFill, pickTextOnFill, usePaletteVersion } from "./segment-label";

export const CAD_BARS_FILTER: { id: string; applicable: readonly FilterDim[] } = {
  id: "cadBars",
  applicable: ["range", "application", "productLine", "region", "hardware"],
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

// Stay on-brand for any slices past the palette by alternating between
// Cooper Standard blue (~250°) and gold (~80°) hues with stepped lightness.
function colorAt(i: number, total: number): string {
  if (i < PALETTE.length) return PALETTE[i]!;
  const k = i - PALETTE.length;
  const extras = Math.max(total - PALETTE.length, 1);
  const hue = k % 2 === 0 ? 250 : 80;
  const steps = Math.max(Math.ceil(extras / 2), 1);
  const t = steps === 1 ? 0 : Math.floor(k / 2) / (steps - 1);
  const L = 0.5 + t * 0.32;
  const C = k % 2 === 0 ? 0.15 : 0.16;
  return `oklch(${L.toFixed(2)} ${C} ${hue})`;
}

export function CadBars() {
  usePaletteVersion();
  const { effective } = useChartFilters(CAD_BARS_FILTER.id, CAD_BARS_FILTER.applicable);
  const cads = useMemo(
    () => [...filterCadUsage(effective)].sort((a, b) => b.sessions - a.sessions),
    [effective],
  );

  const grand = cads.reduce((s, c) => s + c.sessions, 0) || 0;
  const data = cads.map((c) => ({ name: c.cad, value: c.sessions }));

  if (cads.length === 0) {
    return (
      <div className="grid h-[240px] place-items-center text-sm text-muted-foreground">
        No CAD usage matches the current filter.
      </div>
    );
  }

  return (
    <div className="grid items-center gap-4 md:grid-cols-[240px_1fr]">
      <div className="relative mx-auto h-[240px] w-[240px]">
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
              innerRadius={56}
              outerRadius={100}
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={3}
              labelLine={false}
              label={(props: unknown) => {
                const RADIAN = Math.PI / 180;
                const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, value = 0, percent = 0, index = 0 } =
                  props as PieLabelProps;
                if (percent < 0.05) return null;
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
                      y={y - 7}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={12}
                      fontWeight={700}
                      style={textStyle}
                    >
                      {num(value)}
                    </text>
                    <text
                      x={x}
                      y={y + 7}
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
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Tool runs</div>
          <div className="num mt-0.5 text-2xl font-semibold">{num(grand)}</div>
        </div>
      </div>

      {/* 3-column grid → columns hug their widest cell so name and count
          sit close together, while rows stay perfectly aligned across the
          column boundaries. `display:contents` lets each <li> drop its
          children straight into the parent grid. */}
      <ul className="grid w-fit grid-cols-[auto_auto_auto] items-center gap-x-4 gap-y-2 text-base">
        {cads.map((c, i) => (
          <li key={c.cad} className="contents">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="block size-3 shrink-0 rounded-full"
                style={{ background: colorAt(i, cads.length) }}
              />
              <span className="truncate font-medium" title={c.cad}>
                {c.cad}
              </span>
            </div>
            <span className="num text-right font-semibold tabular-nums">
              {num(c.sessions)}
            </span>
            <span className="num text-right text-sm tabular-nums text-muted-foreground">
              {pct(grand > 0 ? c.sessions / grand : 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
