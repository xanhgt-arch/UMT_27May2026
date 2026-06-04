import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartFilters } from "@/lib/filter-context";
import { filterApplicationUsage } from "@/lib/filtering";
import { CAD_TOOLS } from "@/lib/mock-data";
import type { FilterDim } from "@/lib/types";
import { num } from "@/lib/format";
import {
  LegendFilterPills,
  toggleLegendSelection,
} from "@/components/dashboard/LegendFilterPills";

export const CAD_MATRIX_FILTER: { id: string; applicable: readonly FilterDim[] } = {
  id: "cadMatrix",
  // `application` is in the applicable list so the legend pills can act as
  // an app filter for this chart. The chip-bar's "Tool" chip stays in sync.
  applicable: ["range", "application", "productLine", "region", "hardware"],
};

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function CadVsAppMatrix() {
  const { effective, setOverride } = useChartFilters(CAD_MATRIX_FILTER.id, CAD_MATRIX_FILTER.applicable);

  // Legend pill click → isolate that KBE tool via the chart's own override.
  // Clicking the lone selection again clears the filter.
  const toggleApp = (app: string) => {
    setOverride({ application: toggleLegendSelection(effective.application, app) });
  };

  const { topApps, data } = useMemo(() => {
    const apps = filterApplicationUsage(effective);
    const top = [...apps].sort((a, b) => b.total - a.total).slice(0, 5);
    const topAppNames = top.map((a) => a.application);
    const matrix = CAD_TOOLS.map((cad) => {
      const row: Record<string, number | string> = { cad };
      for (const appName of topAppNames) {
        const u = apps.find((a) => a.application === appName && a.cad === cad);
        row[appName] = u?.total ?? 0;
      }
      return row;
    });
    return { topApps: topAppNames, data: matrix };
  }, [effective]);

  if (topApps.length === 0) {
    return (
      <div className="grid h-[340px] place-items-center text-sm text-muted-foreground">
        No applications to compare across CAD tools yet.
      </div>
    );
  }

  return (
    <div className="h-[340px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24, right: 16, left: -8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="cad"
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
            width={64}
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
            wrapperStyle={{ paddingBottom: 8 }}
            content={() => (
              <LegendFilterPills
                items={topApps.map((appName, i) => ({
                  value: appName,
                  color: PALETTE[i % PALETTE.length]!,
                }))}
                selected={effective.application}
                onToggle={toggleApp}
                noun="tool"
              />
            )}
          />
          {topApps.map((appName, i) => (
            <Bar key={appName} dataKey={appName} name={appName} fill={PALETTE[i % PALETTE.length]} radius={[6, 6, 0, 0]}>
              <LabelList
                dataKey={appName}
                position="top"
                formatter={(v) => {
                  const n = Number(v);
                  return n > 0 ? num(n) : "";
                }}
                style={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }}
              />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
