import {
  filterApplicationUsage,
  filterCadUsage,
  filterDomainUsage,
  filterFluidsSealingsSplit,
  filterMonthlyCad,
  filterRawSessions,
} from "./filtering";
import { APPLICATIONS, CAD_TOOLS, REGIONS } from "./mock-data";
import type { FilterState, Region } from "./types";

export type CsvValue = string | number | boolean | null | undefined;
export type CsvRow = Record<string, CsvValue>;

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const REGION_FULL: Record<Region, string> = {
  NA: "North America",
  EU: "Europe",
  ASIA: "Asia",
  SA: "South America",
};

function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(rows: CsvRow[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ];
  return lines.join("\r\n");
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function downloadCsv(filename: string, rows: CsvRow[]): void {
  const csv = toCsv(rows.length > 0 ? rows : [{ message: "No data matches the current filters" }]);
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function chartCsvFilename(title: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${slugify(title) || "chart-data"}-${stamp}.csv`;
}

export function buildChartCsvRows(chartId: string, filters: FilterState): CsvRow[] {
  switch (chartId) {
    case "monthlyTotal":
      return filterMonthlyCad(filters).map((row) => ({
        month: row.month,
        CATIA: row.CATIA,
        NX: row.NX,
        total: row.total,
      }));

    case "yearHeatmap": {
      const totals = monthTotals(filters);
      return totals.map((sessions, monthIndex) => ({
        month: MONTH_LABELS[monthIndex],
        sessions,
      }));
    }

    case "monthlyHeatmap":
      return dailyMonthTotals(filters);

    case "appCompare":
      return appCompareRows(filters);

    case "appDonut":
      return filterApplicationUsage(filters).map((app) => ({
        application: app.application,
        cad: app.cad,
        productLine: app.productLine,
        total: app.total,
      }));

    case "appBars":
      return filterApplicationUsage(filters)
        .slice(0, 8)
        .map((app) => ({
          application: app.application,
          cad: app.cad,
          productLine: app.productLine,
          validation: app.validation,
          execution: app.execution,
          blockCreation: app.blockCreation,
          viewing: app.viewOps,
          total: app.total,
        }));

    case "appFunctionality":
      return appFunctionalityRows(filters);

    case "cadBars":
      return filterCadUsage(filters).map((cad) => ({
        cad: cad.cad,
        sessions: cad.sessions,
        sharePercent: Math.round(cad.share * 10000) / 100,
      }));

    case "cadMatrix":
      return cadMatrixRows(filters);

    case "regionBars":
      return regionBarRows(filters);

    case "domainList": {
      const rows = filterDomainUsage(filters);
      const total = rows.reduce((sum, row) => sum + row.sessions, 0) || 1;
      return rows.map((row, index) => ({
        rank: index + 1,
        domain: row.domain,
        sessions: row.sessions,
        sharePercent: Math.round((row.sessions / total) * 10000) / 100,
      }));
    }

    case "regionMonthly":
      return regionMonthlyRows(filters);

    case "fluidsSealingsSplit": {
      const rows = filterFluidsSealingsSplit(filters);
      const total = rows.reduce((sum, row) => sum + row.value, 0) || 1;
      return rows.map((row) => ({
        productLine: row.name,
        sessions: row.value,
        sharePercent: Math.round((row.value / total) * 10000) / 100,
      }));
    }

    default:
      return rawSessionRows(filters);
  }
}

function rawSessionRows(filters: FilterState): CsvRow[] {
  return filterRawSessions(filters).map((row) => ({
    id: row.id,
    application: row.application,
    functionality: row.functionality,
    cad: row.cad,
    user: row.user,
    machine: row.machine,
    domain: row.domain,
    region: row.region,
    productLine: row.productLine,
    startTime: row.startTime,
    stopTime: row.stopTime,
    status: row.status,
    hardware: row.hardware,
  }));
}

function monthTotals(filters: FilterState): number[] {
  const totals = new Array<number>(12).fill(0);
  for (const row of filterRawSessions(filters)) {
    if (row.monthIndex >= 0 && row.monthIndex < 12) totals[row.monthIndex]! += 1;
  }
  return totals;
}

function dailyMonthTotals(filters: FilterState): CsvRow[] {
  const grid = Array.from({ length: 31 }, () => new Array<number>(12).fill(0));
  for (const row of filterRawSessions(filters)) {
    if (row.monthIndex < 0 || row.monthIndex > 11) continue;
    if (row.dayIndex < 0 || row.dayIndex > 30) continue;
    grid[row.dayIndex]![row.monthIndex]! += 1;
  }

  return grid.map((days, index) => {
    const row: CsvRow = { day: index + 1 };
    MONTH_LABELS.forEach((month, monthIndex) => {
      row[month] = days[monthIndex];
    });
    return row;
  });
}

function appCompareRows(filters: FilterState): CsvRow[] {
  const sessions = filterRawSessions(filters);
  const totals = new Map<string, number>();
  const perAppMonthly = new Map<string, number[]>();

  for (const app of APPLICATIONS) {
    perAppMonthly.set(app.name, new Array<number>(12).fill(0));
  }

  for (const row of sessions) {
    if (row.monthIndex < 0 || row.monthIndex > 11) continue;
    if (!perAppMonthly.has(row.application)) {
      perAppMonthly.set(row.application, new Array<number>(12).fill(0));
    }
    perAppMonthly.get(row.application)![row.monthIndex]! += 1;
    totals.set(row.application, (totals.get(row.application) ?? 0) + 1);
  }

  const apps = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name]) => name);

  return MONTH_LABELS.map((month, monthIndex) => {
    const row: CsvRow = { month };
    for (const app of apps) row[app] = perAppMonthly.get(app)?.[monthIndex] ?? 0;
    return row;
  });
}

function appFunctionalityRows(filters: FilterState): CsvRow[] {
  const sessions = filterRawSessions(filters);
  const appCounts = new Map<string, number>();
  for (const row of sessions) {
    appCounts.set(row.application, (appCounts.get(row.application) ?? 0) + 1);
  }
  const activeApp = [...appCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!activeApp) return [];

  const functionalityCounts = new Map<string, number>();
  for (const row of sessions) {
    if (row.application !== activeApp) continue;
    functionalityCounts.set(
      row.functionality,
      (functionalityCounts.get(row.functionality) ?? 0) + 1,
    );
  }

  const total = appCounts.get(activeApp) ?? 0;
  return [...functionalityCounts.entries()]
    .map(([functionality, sessions]) => ({
      application: activeApp,
      functionality,
      sessions,
      applicationTotal: total,
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 8);
}

function cadMatrixRows(filters: FilterState): CsvRow[] {
  const apps = filterApplicationUsage(filters);
  const topApps = apps.slice(0, 5).map((app) => app.application);
  return CAD_TOOLS.map((cad) => {
    const row: CsvRow = { cad };
    for (const appName of topApps) {
      row[appName] = apps.find((app) => app.application === appName && app.cad === cad)?.total ?? 0;
    }
    return row;
  });
}

function regionBarRows(filters: FilterState): CsvRow[] {
  const byRegion = new Map<Region, { CATIA: number; NX: number; Other: number }>();
  for (const row of filterRawSessions(filters)) {
    const bucket = byRegion.get(row.region) ?? { CATIA: 0, NX: 0, Other: 0 };
    if (row.cad === "CATIA") bucket.CATIA += 1;
    else if (row.cad === "NX") bucket.NX += 1;
    else bucket.Other += 1;
    byRegion.set(row.region, bucket);
  }

  return [...byRegion.entries()]
    .map(([region, bucket]) => ({
      region,
      regionLabel: REGION_FULL[region],
      CATIA: bucket.CATIA,
      NX: bucket.NX,
      Other: bucket.Other,
      total: bucket.CATIA + bucket.NX + bucket.Other,
    }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);
}

function regionMonthlyRows(filters: FilterState): CsvRow[] {
  const buckets = MONTH_LABELS.map(() => new Map<Region, number>());
  const seenMonths = new Set<number>();

  for (const row of filterRawSessions(filters)) {
    if (row.monthIndex < 0 || row.monthIndex > 11) continue;
    seenMonths.add(row.monthIndex);
    const bucket = buckets[row.monthIndex]!;
    bucket.set(row.region, (bucket.get(row.region) ?? 0) + 1);
  }

  const months = seenMonths.size > 0
    ? [...seenMonths].sort((a, b) => a - b)
    : MONTH_LABELS.map((_, index) => index);

  return months.map((monthIndex) => {
    const row: CsvRow = { month: MONTH_LABELS[monthIndex] };
    let total = 0;
    for (const region of REGIONS) {
      const value = buckets[monthIndex]!.get(region) ?? 0;
      row[REGION_FULL[region]] = value;
      total += value;
    }
    row.total = total;
    return row;
  });
}
