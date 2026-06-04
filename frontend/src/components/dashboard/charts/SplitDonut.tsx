import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { num, pct } from "@/lib/format";
import { isLightFill, pickTextOnFill, usePaletteVersion } from "./segment-label";

export type SplitItem = { name: string; value: number };

type SliceLabelProps = {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  value?: number;
  percent?: number;
  index?: number;
};

// Two-line slice label: bold number on top, % underneath. Sits in the
// thickest part of the donut ring so it reads at a glance without hovering.
// `colors` is closed over so the label can pick a dark text colour when the
// slice happens to land on a light/yellow fill.
function makeRenderSliceLabel(colors: readonly string[]) {
  return function renderSliceLabel(props: SliceLabelProps) {
    const {
      cx = 0,
      cy = 0,
      midAngle = 0,
      innerRadius = 0,
      outerRadius = 0,
      value = 0,
      percent = 0,
      index = 0,
    } = props;
    if (percent < 0.04) return null;
    const RADIAN = Math.PI / 180;
    const r = (innerRadius + outerRadius) / 2;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    const sliceColor = colors[index % colors.length] ?? "var(--chart-1)";
    const fill = pickTextOnFill(sliceColor);
    // SVG attribute `fill=` does NOT resolve CSS var() — only the `style`
    // property does. Setting fill through style ensures var(--foreground)
    // actually paints black in light mode.
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
  };
}

export function SplitDonut({
  data,
  colors = ["var(--chart-1)", "var(--chart-3)"],
  primaryLabel = "Total",
}: {
  data: SplitItem[];
  colors?: [string, string];
  primaryLabel?: string;
}) {
  usePaletteVersion();
  const total = data.reduce((s, d) => s + d.value, 0);

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
              label={makeRenderSliceLabel(colors)}
              isAnimationActive={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {primaryLabel}
          </div>
          <div className="num mt-0.5 text-2xl font-semibold">{num(total)}</div>
        </div>
      </div>

      {/* 3-column grid → columns hug their widest cell so name and count
          sit close together, while rows stay perfectly aligned across the
          column boundaries. `display:contents` lets each <li> drop its
          children straight into the parent grid. */}
      <ul className="grid w-fit grid-cols-[auto_auto_auto] items-center gap-x-4 gap-y-3 text-base">
        {data.map((d, i) => (
          <li key={d.name} className="contents">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="block size-3 shrink-0 rounded-full"
                style={{ background: colors[i % colors.length] }}
              />
              <span className="truncate font-medium">{d.name}</span>
            </div>
            <span className="num text-right font-semibold tabular-nums">
              {num(d.value)}
            </span>
            <span className="num text-right text-sm tabular-nums text-muted-foreground">
              {pct(d.value / total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
