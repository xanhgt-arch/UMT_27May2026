import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartFilters } from "@/lib/filter-context";
import { filterMonthly } from "@/lib/filtering";
import type { FilterDim } from "@/lib/types";
import { num } from "@/lib/format";

export const TREND_FILTER: { id: string; applicable: readonly FilterDim[] } = {
  id: "trend",
  applicable: ["range", "application", "cad", "productLine", "region", "domain", "hardware"],
};

export function TrendChart() {
  const { effective } = useChartFilters(TREND_FILTER.id, TREND_FILTER.applicable);
  const data = useMemo(() => filterMonthly(effective), [effective]);

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="prodFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="testFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v: number) => num(v)} width={56} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12, boxShadow: "0 8px 24px -12px rgba(0,0,0,0.15)" }}
            cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }}
            formatter={(v) => num(Number(v))}
          />
          <Area type="monotone" dataKey="production" name="Production" stroke="var(--chart-1)" strokeWidth={2.4} fill="url(#prodFill)" />
          <Area type="monotone" dataKey="test"       name="Test"       stroke="var(--chart-2)" strokeWidth={2}   fill="url(#testFill)" />
        </AreaChart>
      </ResponsiveContainer>

      <div className="mt-2 flex items-center justify-center gap-5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="block size-2.5 rounded-full" style={{ background: "var(--chart-1)" }} />
          Production
        </div>
        <div className="flex items-center gap-2">
          <span className="block size-2.5 rounded-full" style={{ background: "var(--chart-2)" }} />
          Test
        </div>
      </div>
    </div>
  );
}
