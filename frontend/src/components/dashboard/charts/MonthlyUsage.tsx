import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  LabelList,
  Legend,
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

export const MONTHLY_USAGE_FILTER: { id: string; applicable: readonly FilterDim[] } = {
  id: "monthlyUsage",
  applicable: ["range", "application", "cad", "productLine", "region", "domain", "hardware"],
};

export function MonthlyUsage() {
  const { effective } = useChartFilters(
    MONTHLY_USAGE_FILTER.id,
    MONTHLY_USAGE_FILTER.applicable,
  );
  const data = useMemo(() => filterMonthlyCad(effective), [effective]);

  const showCatia = effective.cad.length === 0 || effective.cad.includes("CATIA");
  const showNx    = effective.cad.length === 0 || effective.cad.includes("NX");

  const average = useMemo(() => {
    if (data.length === 0) return 0;
    const total = data.reduce((s, d) => s + d.total, 0);
    return total / data.length;
  }, [data]);

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="catiaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="nxFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
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
            formatter={(v, name) => [`${num(Number(v))} runs`, name as string]}
            labelFormatter={(label) => `Month: ${label}`}
          />
          <Legend
            verticalAlign="top"
            iconType="circle"
            wrapperStyle={{ paddingBottom: 8, fontSize: 13 }}
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
          {showCatia ? (
            <Area
              type="monotone"
              dataKey="CATIA"
              name="CATIA"
              stroke="var(--chart-1)"
              strokeWidth={2.6}
              fill="url(#catiaFill)"
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
            </Area>
          ) : null}
          {showNx ? (
            <Area
              type="monotone"
              dataKey="NX"
              name="NX"
              stroke="var(--chart-2)"
              strokeWidth={2.2}
              fill="url(#nxFill)"
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
            </Area>
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
