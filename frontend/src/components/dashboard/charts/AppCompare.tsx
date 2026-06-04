import { useEffect, useMemo, useState } from "react";
import { BarChart3, LineChart as LineChartIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartFilters } from "@/lib/filter-context";
import { filterRawSessions } from "@/lib/filtering";
import { APPLICATIONS } from "@/lib/mock-data";
import type { FilterDim } from "@/lib/types";
import { num } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChartShapeToggle } from "@/components/dashboard/ChartShapeToggle";
import {
  LegendFilterPills,
  toggleLegendSelection,
} from "@/components/dashboard/LegendFilterPills";

type ChartShape = "line" | "bar";

export const APP_COMPARE_FILTER: {
  id: string;
  applicable: readonly FilterDim[];
} = {
  id: "appCompare",
  // `application` is owned by the in-chart picker, so we don't expose it
  // to the chips bar — everything else is honoured.
  applicable: ["range", "cad", "productLine", "region", "domain", "hardware", "status"],
};

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const APP_NAMES: readonly string[] = APPLICATIONS.map((a) => a.name);

export function AppCompare() {
  const { effective } = useChartFilters(
    APP_COMPARE_FILTER.id,
    APP_COMPARE_FILTER.applicable,
  );

  // Per-app session counts across the filtered window, used both to pick
  // sensible defaults and to drive the per-month series for each pick.
  const { perAppMonthly, appTotals, monthsWithData } = useMemo(() => {
    const sessions = filterRawSessions(effective);
    const perAppMonthly = new Map<string, number[]>();
    const appTotals = new Map<string, number>();
    const monthSeen = new Set<number>();

    for (const name of APP_NAMES) perAppMonthly.set(name, new Array(12).fill(0));

    for (const s of sessions) {
      const m = s.monthIndex;
      if (m < 0 || m > 11) continue;
      monthSeen.add(m);
      const arr = perAppMonthly.get(s.application);
      if (!arr) continue;
      arr[m]! += 1;
      appTotals.set(s.application, (appTotals.get(s.application) ?? 0) + 1);
    }

    const monthsWithData = [...monthSeen].sort((a, b) => a - b);
    return { perAppMonthly, appTotals, monthsWithData };
  }, [effective]);

  // Default picks: top two apps by session count in the filtered window.
  const defaults = useMemo(() => {
    const ranked = [...appTotals.entries()].sort((a, b) => b[1] - a[1]);
    const first = ranked[0]?.[0] ?? APP_NAMES[0] ?? "";
    const second = ranked.find(([n]) => n !== first)?.[0]
      ?? APP_NAMES.find((n) => n !== first)
      ?? first;
    return { first, second };
  }, [appTotals]);

  const [appA, setAppA] = useState<string>(defaults.first);
  const [appB, setAppB] = useState<string>(defaults.second);
  const [shape, setShape] = useState<ChartShape>("line");
  const [visibleApps, setVisibleApps] = useState<string[]>([]);

  // Re-seed picks when the filter changes the candidate set (e.g. the user
  // narrows CAD and the previously-selected app is now empty).
  useEffect(() => {
    setAppA((prev) =>
      appTotals.has(prev) && (appTotals.get(prev) ?? 0) > 0 ? prev : defaults.first,
    );
    setAppB((prev) =>
      prev !== appA && appTotals.has(prev) && (appTotals.get(prev) ?? 0) > 0
        ? prev
        : defaults.second,
    );
    // appA intentionally excluded — we only want this when filter results shift.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaults.first, defaults.second]);

  useEffect(() => {
    setVisibleApps((prev) => prev.filter((name) => name === appA || name === appB));
  }, [appA, appB]);

  // Chart series — one row per month in the active window.
  const data = useMemo(() => {
    const seriesA = perAppMonthly.get(appA) ?? new Array(12).fill(0);
    const seriesB = perAppMonthly.get(appB) ?? new Array(12).fill(0);
    const months = monthsWithData.length > 0 ? monthsWithData : Array.from({ length: 12 }, (_, i) => i);
    return months.map((m) => ({
      month: MONTH_LABELS[m],
      [appA]: seriesA[m] ?? 0,
      [appB]: seriesB[m] ?? 0,
    }));
  }, [perAppMonthly, appA, appB, monthsWithData]);

  const totalsA = appTotals.get(appA) ?? 0;
  const totalsB = appTotals.get(appB) ?? 0;
  const showAppA = visibleApps.length === 0 || visibleApps.includes(appA);
  const showAppB = visibleApps.length === 0 || visibleApps.includes(appB);
  const noData = (!showAppA || totalsA === 0) && (!showAppB || totalsB === 0);

  const legendItems = useMemo(
    () => [
      { value: appA, color: "var(--chart-1)" },
      { value: appB, color: "var(--chart-2)" },
    ],
    [appA, appB],
  );

  // Sort app names for the picker — busiest first, then alpha for the long tail.
  const sortedApps = useMemo(() => {
    const ranked = [...appTotals.entries()].sort((a, b) => b[1] - a[1]);
    const seen = new Set(ranked.map(([n]) => n));
    const tail = APP_NAMES.filter((n) => !seen.has(n) || (appTotals.get(n) ?? 0) === 0)
      .sort((a, b) => a.localeCompare(b));
    const head = ranked.filter(([, v]) => v > 0).map(([n]) => n);
    return [...head, ...tail];
  }, [appTotals]);

  return (
    <div className="space-y-3">
      {/* Picker row */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <PickerField
          label="KBE tool A"
          value={appA}
          onChange={(v) => {
            if (v === appB) setAppB(appA);
            setAppA(v);
          }}
          dotColor="var(--chart-1)"
          options={sortedApps}
          counts={appTotals}
        />
        <PickerField
          label="KBE tool B"
          value={appB}
          onChange={(v) => {
            if (v === appA) setAppA(appB);
            setAppB(v);
          }}
          dotColor="var(--chart-2)"
          options={sortedApps}
          counts={appTotals}
        />
        <div className="ml-auto text-muted-foreground">
          <span className="font-medium text-foreground">{num(totalsA)}</span> vs{" "}
          <span className="font-medium text-foreground">{num(totalsB)}</span> runs in window
        </div>
      </div>

      <div className="flex justify-end">
        <ChartShapeToggle
          value={shape}
          onChange={setShape}
          ariaLabel="Chart type"
          options={[
            { value: "line", label: "Line", icon: LineChartIcon },
            { value: "bar", label: "Grouped bar", icon: BarChart3 },
          ]}
        />
      </div>

      {noData ? (
        <div className="grid h-[280px] place-items-center text-sm text-muted-foreground">
          Neither KBE tool has runs in the current window.
        </div>
      ) : (
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {shape === "line" ? (
            <LineChart data={data} margin={{ top: 24, right: 12, left: -8, bottom: 0 }}>
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
                    items={legendItems}
                    selected={visibleApps}
                    onToggle={(value) => setVisibleApps((prev) => toggleLegendSelection(prev, value))}
                    noun="KBE tool"
                  />
                )}
              />
              {showAppA ? (
                <Line
                  type="monotone"
                  dataKey={appA}
                  name={appA}
                  stroke="var(--chart-1)"
                  strokeWidth={2.6}
                  dot={{ r: 3, fill: "var(--chart-1)", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                >
                  <LabelList
                    dataKey={appA}
                    position="top"
                    offset={8}
                    formatter={(v) => (Number(v) > 0 ? num(Number(v)) : "")}
                    style={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }}
                  />
                </Line>
              ) : null}
              {showAppB ? (
                <Line
                  type="monotone"
                  dataKey={appB}
                  name={appB}
                  stroke="var(--chart-2)"
                  strokeWidth={2.6}
                  dot={{ r: 3, fill: "var(--chart-2)", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                >
                  <LabelList
                    dataKey={appB}
                    position="bottom"
                    offset={8}
                    formatter={(v) => (Number(v) > 0 ? num(Number(v)) : "")}
                    style={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }}
                  />
                </Line>
              ) : null}
            </LineChart>
            ) : (
            <BarChart data={data} margin={{ top: 24, right: 12, left: -8, bottom: 0 }} barCategoryGap="20%">
              <defs>
                <linearGradient id="appCompareGradA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.6} />
                </linearGradient>
                <linearGradient id="appCompareGradB" x1="0" y1="0" x2="0" y2="1">
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
                    items={legendItems}
                    selected={visibleApps}
                    onToggle={(value) => setVisibleApps((prev) => toggleLegendSelection(prev, value))}
                    noun="KBE tool"
                  />
                )}
              />
              {showAppA ? (
                <Bar
                  dataKey={appA}
                  name={appA}
                  fill="url(#appCompareGradA)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={28}
                >
                  <LabelList
                    dataKey={appA}
                    position="top"
                    formatter={(v) => (Number(v) > 0 ? num(Number(v)) : "")}
                    style={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }}
                  />
                </Bar>
              ) : null}
              {showAppB ? (
                <Bar
                  dataKey={appB}
                  name={appB}
                  fill="url(#appCompareGradB)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={28}
                >
                  <LabelList
                    dataKey={appB}
                    position="top"
                    formatter={(v) => (Number(v) > 0 ? num(Number(v)) : "")}
                    style={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }}
                  />
                </Bar>
              ) : null}
            </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

type PickerFieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  dotColor: string;
  options: readonly string[];
  counts: Map<string, number>;
};

function PickerField({ label, value, onChange, dotColor, options, counts }: PickerFieldProps) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="inline-block size-2.5 rounded-full"
        style={{ background: dotColor }}
      />
      <span className="text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 min-w-[180px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[280px]">
          {options.map((name) => {
            const c = counts.get(name) ?? 0;
            return (
              <SelectItem key={name} value={name}>
                <span className="inline-flex w-full items-center justify-between gap-3">
                  <span>{name}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {c > 0 ? num(c) : "0"}
                  </span>
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
