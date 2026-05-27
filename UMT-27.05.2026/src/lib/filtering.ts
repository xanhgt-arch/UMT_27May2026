import type {
  ApplicationUsage,
  CadUsage,
  DomainUsage,
  FilterState,
  Hardware,
  MonthlyCadUsagePoint,
  MonthlyUsagePoint,
  RawSessionRow,
  RegionUsage,
  SessionStatus,
} from "./types";
import { REGION_USAGE, bucketFunctionality, normalizeAppName } from "./mock-data";
import { COMPACT_SESSION, RAW_SESSION_COMPACT_ROWS, getRawSessionAt } from "./session-data";
import type { CadTool } from "./types";

export function rangeSlice(filters: FilterState): [number, number?] {
  switch (filters.range) {
    case "all": return [-12];
    case "currentMonth": return [-1];
    case "lastMonth": return [-2, -1];
    case "thisYear": return [-(new Date().getMonth() + 1)];
    case "lastYear": return [-12];
    case "custom": {
      if (!filters.customFrom || !filters.customTo) return [-12];
      const a = new Date(filters.customFrom);
      const b = new Date(filters.customTo);
      const months =
        (b.getFullYear() - a.getFullYear()) * 12 +
        b.getMonth() - a.getMonth() + 1;
      return [-Math.max(1, Math.min(12, months))];
    }
  }
}

function rangeWindow(filters: FilterState): { fromMs: number; toMs: number } {
  if (!filters.range || filters.range === "all") {
    return { fromMs: Number.NEGATIVE_INFINITY, toMs: Number.POSITIVE_INFINITY };
  }

  const now = new Date();
  switch (filters.range) {
    case "currentMonth":
      return {
        fromMs: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
        toMs: now.getTime(),
      };
    case "lastMonth":
      return {
        fromMs: new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(),
        toMs: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).getTime(),
      };
    case "thisYear":
      return {
        fromMs: new Date(now.getFullYear(), 0, 1).getTime(),
        toMs: now.getTime(),
      };
    case "lastYear":
      return {
        fromMs: new Date(now.getFullYear() - 1, 0, 1).getTime(),
        toMs: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59).getTime(),
      };
    case "custom":
      if (filters.customFrom && filters.customTo) {
        return {
          fromMs: new Date(`${filters.customFrom}T00:00:00`).getTime(),
          toMs: new Date(`${filters.customTo}T23:59:59.999`).getTime(),
        };
      }
      return {
        fromMs: new Date(now.getFullYear(), 0, 1).getTime(),
        toMs: now.getTime(),
      };
  }
}

function filterKey(filters: FilterState): string {
  return [
    filters.range,
    filters.customFrom ?? "",
    filters.customTo ?? "",
    filters.application.join("\u001f"),
    filters.cad.join("\u001f"),
    filters.productLine.join("\u001f"),
    filters.region.join("\u001f"),
    filters.domain.join("\u001f"),
    filters.hardware.join("\u001f"),
    filters.status.join("\u001f"),
  ].join("\u001e");
}

const FILTER_CACHE_LIMIT = 40;
const filteredCache = new Map<string, RawSessionRow[]>();

function cacheResult(key: string, rows: RawSessionRow[]): RawSessionRow[] {
  filteredCache.set(key, rows);
  if (filteredCache.size > FILTER_CACHE_LIMIT) {
    const oldest = filteredCache.keys().next().value;
    if (oldest) filteredCache.delete(oldest);
  }
  return rows;
}

function selectedSet<T extends string>(selected: readonly T[]): ReadonlySet<T> | null {
  return selected.length > 0 ? new Set(selected) : null;
}

export function filterMonthly(filters: FilterState): MonthlyUsagePoint[] {
  const buckets = new Map<string, { key: string; label: string; production: number; test: number }>();

  for (const s of filterRawSessions(filters)) {
    let b = buckets.get(s.monthKey);
    if (!b) {
      b = { key: s.monthKey, label: s.monthLabel, production: 0, test: 0 };
      buckets.set(s.monthKey, b);
    }
    if (s.isProd) b.production += 1;
    else b.test += 1;
  }

  return [...buckets.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((b) => ({ month: b.label, production: b.production, test: b.test }));
}

export function filterMonthlyCad(filters: FilterState): MonthlyCadUsagePoint[] {
  type Bucket = { key: string; label: string; CATIA: number; NX: number };
  const buckets = new Map<string, Bucket>();

  for (const s of filterRawSessions(filters)) {
    let b = buckets.get(s.monthKey);
    if (!b) {
      b = { key: s.monthKey, label: s.monthLabel, CATIA: 0, NX: 0 };
      buckets.set(s.monthKey, b);
    }
    if (s.cad === "CATIA") b.CATIA += 1;
    else if (s.cad === "NX") b.NX += 1;
  }

  return [...buckets.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((b) => ({ month: b.label, CATIA: b.CATIA, NX: b.NX, total: b.CATIA + b.NX }));
}

export function filterApplicationUsage(filters: FilterState): ApplicationUsage[] {
  type Row = {
    cad: CadTool;
    productLine: string;
    total: number;
    validation: number;
    execution: number;
    blockCreation: number;
    viewOps: number;
  };
  const byApp = new Map<string, Row>();

  for (const s of filterRawSessions(filters)) {
    const appName = normalizeAppName(s.application);
    let r = byApp.get(appName);
    if (!r) {
      r = {
        cad: s.cad,
        productLine: s.productLine,
        total: 0,
        validation: 0,
        execution: 0,
        blockCreation: 0,
        viewOps: 0,
      };
      byApp.set(appName, r);
    }
    r.total += 1;
    r[bucketFunctionality(s.functionality)] += 1;
  }

  return [...byApp.entries()]
    .map(([application, r]) => ({ application, ...r }))
    .sort((a, b) => b.total - a.total);
}

export function filterCadUsage(filters: FilterState): CadUsage[] {
  const totals = new Map<CadTool, number>();
  for (const s of filterRawSessions(filters)) {
    totals.set(s.cad, (totals.get(s.cad) ?? 0) + 1);
  }
  const grand = [...totals.values()].reduce((sum, value) => sum + value, 0) || 1;
  return [...totals.entries()]
    .map(([cad, sessions]) => ({ cad, sessions, share: sessions / grand }))
    .sort((a, b) => b.sessions - a.sessions);
}

export function filterRegionUsage(filters: FilterState): RegionUsage[] {
  const counts = new Map<string, number>();
  for (const s of filterRawSessions(filters)) {
    counts.set(s.region, (counts.get(s.region) ?? 0) + 1);
  }
  return REGION_USAGE
    .map((r) => ({ region: r.region, sessions: counts.get(r.region) ?? 0 }))
    .filter((r) => r.sessions > 0);
}

export function filterDomainUsage(filters: FilterState): DomainUsage[] {
  const counts = new Map<string, number>();
  for (const s of filterRawSessions(filters)) {
    counts.set(s.domain, (counts.get(s.domain) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([domain, sessions]) => ({ domain, sessions }))
    .filter((d) => d.sessions > 0)
    .sort((a, b) => b.sessions - a.sessions);
}

export function filterFluidsSealingsSplit(filters: FilterState) {
  let fluids = 0;
  let sealings = 0;
  for (const s of filterRawSessions(filters)) {
    if (s.productLine === "FLUIDS") fluids += 1;
    else if (s.productLine === "SEALING") sealings += 1;
  }
  return [
    { name: "Fluids", value: fluids },
    { name: "Sealings", value: sealings },
  ].filter((p) => p.value > 0);
}

export function filterRawSessions(filters: FilterState): RawSessionRow[] {
  const key = filterKey(filters);
  const cached = filteredCache.get(key);
  if (cached) return cached;

  const { fromMs, toMs } = rangeWindow(filters);
  const application = selectedSet(filters.application);
  const cad = selectedSet(filters.cad);
  const productLine = selectedSet(filters.productLine);
  const region = selectedSet(filters.region);
  const domain = selectedSet(filters.domain);
  const hardware = selectedSet<Hardware>(filters.hardware);
  const status = selectedSet<SessionStatus>(filters.status);
  const out: RawSessionRow[] = [];

  const S = COMPACT_SESSION;
  for (let i = 0; i < RAW_SESSION_COMPACT_ROWS.length; i++) {
    const s = RAW_SESSION_COMPACT_ROWS[i]!;
    const startMs = s[S.startMs];
    if (startMs < fromMs || startMs > toMs) continue;
    if (application && !application.has(normalizeAppName(s[S.application]))) continue;
    if (cad && !cad.has(s[S.cad])) continue;
    if (productLine && !productLine.has(s[S.productLine])) continue;
    if (region && !region.has(s[S.region])) continue;
    if (domain && !domain.has(s[S.domain])) continue;
    if (hardware && !hardware.has(s[S.hardware])) continue;
    if (status && !status.has(s[S.status])) continue;
    out.push(getRawSessionAt(i));
  }

  return cacheResult(key, out);
}
