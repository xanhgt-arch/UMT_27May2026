import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChartFilters } from "@/lib/filter-context";
import { filterRawSessions } from "@/lib/filtering";
import { APPLICATIONS } from "@/lib/mock-data";
import type { FilterDim } from "@/lib/types";
import { num, pct } from "@/lib/format";

export const APP_FUNCTIONALITY_FILTER: { id: string; applicable: readonly FilterDim[] } = {
  id: "appFunctionality",
  applicable: ["range", "cad", "productLine", "region", "domain", "hardware"],
};

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];
const TOP_N = 8;

export function ApplicationFunctionality() {
  const { effective } = useChartFilters(
    APP_FUNCTIONALITY_FILTER.id,
    APP_FUNCTIONALITY_FILTER.applicable,
  );

  // Compute the list of applications that actually appear in filtered sessions,
  // and pick a sensible default (the busiest app).
  const { rows, appNames, totalForApp } = useMemo(() => {
    const sessions = filterRawSessions(effective);
    const appCounts = new Map<string, number>();
    for (const s of sessions) appCounts.set(s.application, (appCounts.get(s.application) ?? 0) + 1);
    const sortedApps = [...appCounts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    return { rows: sessions, appNames: sortedApps, totalForApp: appCounts };
  }, [effective]);

  const allKnownApps = useMemo(
    () => [...new Set([...appNames, ...APPLICATIONS.map((a) => a.name)])],
    [appNames],
  );

  const [selectedApp, setSelectedApp] = useState<string>("__auto__");
  const activeApp =
    selectedApp === "__auto__"
      ? appNames[0] ?? APPLICATIONS[0]?.name ?? ""
      : selectedApp;

  const data = useMemo(() => {
    if (!activeApp) return [];
    const fnCounts = new Map<string, number>();
    for (const s of rows) {
      if (s.application !== activeApp) continue;
      fnCounts.set(s.functionality, (fnCounts.get(s.functionality) ?? 0) + 1);
    }
    return [...fnCounts.entries()]
      .map(([functionality, total]) => ({ functionality, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, TOP_N);
  }, [rows, activeApp]);

  const grand = data.reduce((s, d) => s + d.total, 0);
  const appTotal = totalForApp.get(activeApp) ?? grand;

  if (allKnownApps.length === 0) {
    return (
      <div className="grid h-[340px] place-items-center text-sm text-muted-foreground">
        No KBE tools match the current filter.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Pick a KBE tool to see how its functionality is distributed.
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedApp} onValueChange={setSelectedApp}>
            <SelectTrigger className="h-9 w-[240px] rounded-lg">
              <SelectValue placeholder="Choose a KBE tool" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__auto__">
                Top KBE tool{appNames[0] ? ` · ${appNames[0]}` : ""}
              </SelectItem>
              {allKnownApps.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{activeApp}</span>
        <span className="mx-2">·</span>
        {num(appTotal)} sessions
        <span className="mx-2">·</span>
        {data.length} {data.length === 1 ? "functionality" : "functionalities"}{appTotal > grand ? ` · top ${TOP_N}` : ""}
      </div>

      {data.length === 0 ? (
        <div className="grid h-[280px] place-items-center text-sm text-muted-foreground">
          No functionality data for {activeApp} matches the current filter.
        </div>
      ) : (
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 8, right: 64, left: 0, bottom: 0 }}
            >
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
                dataKey="functionality"
                stroke="var(--muted-foreground)"
                fontSize={13}
                tickLine={false}
                axisLine={false}
                width={180}
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
                formatter={(v) => {
                  const n = Number(v);
                  return [
                    `${num(n)} runs${grand ? ` · ${pct(n / grand)}` : ""}`,
                    "Usage",
                  ];
                }}
              />
              <Bar dataKey="total" name="Sessions" radius={[0, 8, 8, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
                <LabelList
                  dataKey="total"
                  position="right"
                  formatter={(v) => num(Number(v))}
                  style={{ fill: "var(--foreground)", fontSize: 13, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
