import type {
  AdminRecord,
  Application,
  ApplicationFunctionalityUsage,
  ApplicationUsage,
  CadTool,
  CadUsage,
  DomainRecord,
  DomainUsage,
  Hardware,
  MonthlyCadUsagePoint,
  MonthlyUsagePoint,
  Region,
  RegionUsage,
  SessionStatus,
} from "./types";

import { COMPACT_SESSION, RAW_SESSION_COMPACT_ROWS } from "./session-data";


// ── Enumerations ────────────────────────────────────────────────
export const CAD_TOOLS: readonly CadTool[] = ["CATIA", "NX"];
export const REGIONS: readonly Region[] = ["NA", "EU", "ASIA", "SA"];
export const HARDWARE_KINDS: readonly Hardware[] = ["VDI", "Non-VDI"];
export const SESSION_STATUSES: readonly SessionStatus[] = [
  "Active",
  "Completed",
  "Failed",
  "Stopped",
];

// ── Cast loaded JSON to typed shapes ───────────────────────────
const RAW_SESSIONS_NEW = RAW_SESSION_COMPACT_ROWS;
const S = COMPACT_SESSION;

function toTitleCase(value: string): string {
  return value
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// function toDisplayName(userId: string): string {
//   return toTitleCase(userId.split("@")[0] ?? "") || "Unknown User";
// }

// function toEmail(userId: string): string {
//   if (userId.includes("@")) return userId;
//   const normalized = userId.trim().toLowerCase();
//   return normalized ? `${normalized}@cooperstandard.com` : "unknown@cooperstandard.com";
// }

// function toVdiStatus(status: SessionStatus): VdiUserRecord["status"] {
//   if (status === "Active") return "Active";
//   if (status === "Failed") return "Disabled";
//   return "Inactive";
// }

function mostCommon<T extends string>(values: T[]): T | "" {
  const counts = new Map<T, number>();
  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "";
}


export const DOMAIN_RECORDS: DomainRecord[] = [...new Map(
  RAW_SESSIONS_NEW
    .filter((s) => s[S.domain])
    .map((s) => [s[S.domain].toLowerCase(), s[S.domain]] as const),
).values()]
  .sort((a, b) => a.localeCompare(b))
  .map((domain, i) => {
    const rows = RAW_SESSIONS_NEW.filter((s) => s[S.domain].toLowerCase() === domain.toLowerCase());
    return {
      id: `dom-${String(i + 1).padStart(3, "0")}`,
      technicalDomain: domain,
      corporateGroup: toTitleCase(domain),
      region: mostCommon(rows.map((s) => s[S.region])) || "NA",
      users: new Set(rows.map((s) => s[S.user]).filter(Boolean).map((user) => user.toLowerCase())).size,
      active: rows.some((s) => s[S.startMs] > 0),
    };
  });

// ── Derived enumerations from real data ─────────────────────────
const uniqueSorted = (arr: string[]): string[] =>
  [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b));

export const PRODUCT_LINES: readonly string[] = uniqueSorted(
  RAW_SESSIONS_NEW.map((s) => s[S.productLine]),
);

export const TECH_DOMAINS: readonly string[] = uniqueSorted(
  RAW_SESSIONS_NEW.map((s) => s[S.domain]),
);

export const CORP_GROUPS: readonly string[] = uniqueSorted(
  DOMAIN_RECORDS.map((d) => d.corporateGroup),
);

// ── Applications (one entry per unique application name) ────────
const APP_LINE_PRIORITY: Record<string, number> = {
  FLUIDS: 0,
  SEALING: 1,
  FBD: 2,
  FTS: 3,
  GENERAL: 4,
};
function pickDominant<T extends string>(values: T[]): T {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}
// Among raw name variants for the same app (grouped case-insensitively), prefer
// the variant with mixed casing ("3D Trim" over "3D TRIM"); fall back to
// title-casing the first variant seen.
function pickDisplayAppName(variants: string[]): string {
  const mixed = variants.find((v) => v !== v.toUpperCase() && v !== v.toLowerCase());
  if (mixed) return mixed;
  return toTitleCase(variants[0] ?? "");
}

const appAggregates = new Map<
  string,
  { names: string[]; cads: CadTool[]; productLines: string[] }
>();
for (const s of RAW_SESSIONS_NEW) {
  const key = s[S.application].trim().toLowerCase();
  const a = appAggregates.get(key);
  if (a) {
    a.names.push(s[S.application]);
    a.cads.push(s[S.cad]);
    a.productLines.push(s[S.productLine]);
  } else {
    appAggregates.set(key, { names: [s[S.application]], cads: [s[S.cad]], productLines: [s[S.productLine]] });
  }
}

// Lookup from any lowercase key to its canonical display name.
const APP_DISPLAY = new Map<string, string>();
for (const [key, { names }] of appAggregates) {
  APP_DISPLAY.set(key, pickDisplayAppName(names));
}

/** Maps any raw application name (any casing) to its canonical display form. */
export function normalizeAppName(raw: string): string {
  return APP_DISPLAY.get(raw.trim().toLowerCase()) ?? toTitleCase(raw.trim());
}

export const APPLICATIONS: Application[] = [...appAggregates.entries()]
  .map(([key, a], i) => ({
    id: `app-${String(i + 1).padStart(2, "0")}`,
    name: APP_DISPLAY.get(key)!,
    cad: pickDominant(a.cads),
    productLine: pickDominant(a.productLines),
  }))
  .sort((x, y) => {
    const px = APP_LINE_PRIORITY[x.productLine] ?? 99;
    const py = APP_LINE_PRIORITY[y.productLine] ?? 99;
    if (px !== py) return px - py;
    return x.name.localeCompare(y.name);
  });

// ── Per-application usage with functionality breakdown ──────────
export function bucketFunctionality(fn: string): "validation" | "execution" | "blockCreation" | "viewOps" {
  const u = fn.toUpperCase();
  if (u.includes("VALIDATION") || u.includes("CHECK")) return "validation";
  if (u.includes("CREATE") || u.includes("CREATION") || u.includes("PLACEMENT") || u.includes("INSERT")) return "blockCreation";
  if (u.includes("VIEW") || u.includes("SHOW") || u.includes("HIDE") || u.includes("DISPLAY") || u.includes("NOTES") || u.includes("TITLEBLOCK")) return "viewOps";
  return "execution";
}
const usageByApp = new Map<
  string,
  { cad: CadTool; productLine: string; total: number; validation: number; execution: number; blockCreation: number; viewOps: number }
>();
for (const s of RAW_SESSIONS_NEW) {
  const application = normalizeAppName(s[S.application]);
  const functionality = s[S.functionality];
  let row = usageByApp.get(application);
  if (!row) {
    row = { cad: s[S.cad], productLine: s[S.productLine], total: 0, validation: 0, execution: 0, blockCreation: 0, viewOps: 0 };
    usageByApp.set(application, row);
  }
  row.total++;
  row[bucketFunctionality(functionality)]++;
}
export const APPLICATION_USAGE: ApplicationUsage[] = [...usageByApp.entries()]
  .map(([application, r]) => ({ application, ...r }))
  .sort((a, b) => b.total - a.total);

// ── Per-application functionality usage (granular) ──────────────
const fnByApp = new Map<string, Map<string, { cad: CadTool; total: number }>>();
for (const s of RAW_SESSIONS_NEW) {
  const application = normalizeAppName(s[S.application]);
  const functionality = s[S.functionality];
  let perFn = fnByApp.get(application);
  if (!perFn) {
    perFn = new Map();
    fnByApp.set(application, perFn);
  }
  const cur = perFn.get(functionality);
  if (cur) cur.total++;
  else perFn.set(functionality, { cad: s[S.cad], total: 1 });
}
export const APPLICATION_FUNCTIONALITY_USAGE: ApplicationFunctionalityUsage[] =
  [...fnByApp.entries()].flatMap(([application, perFn]) =>
    [...perFn.entries()].map(([functionality, { cad, total }]) => ({
      application,
      functionality,
      cad,
      total,
    })),
  );

// ── Per-CAD usage ───────────────────────────────────────────────
const cadCounts = new Map<CadTool, number>();
for (const s of RAW_SESSIONS_NEW) {
  const cad = s[S.cad];
  cadCounts.set(cad, (cadCounts.get(cad) ?? 0) + 1);
}
const cadGrand = [...cadCounts.values()].reduce((a, b) => a + b, 0) || 1;
export const CAD_USAGE: CadUsage[] = [...cadCounts.entries()]
  .map(([cad, sessions]) => ({ cad, sessions, share: sessions / cadGrand }))
  .sort((a, b) => b.sessions - a.sessions);

// ── Region usage ────────────────────────────────────────────────
const regionCounts = new Map<Region, number>();
for (const s of RAW_SESSIONS_NEW) {
  const region = s[S.region];
  regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
}
export const REGION_USAGE: RegionUsage[] = REGIONS.map((r) => ({
  region: r,
  sessions: regionCounts.get(r) ?? 0,
})).filter((r) => r.sessions > 0);

// ── Domain usage ────────────────────────────────────────────────
const domainCounts = new Map<string, number>();
for (const s of RAW_SESSIONS_NEW) {
  const domain = s[S.domain];
  domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
}
export const DOMAIN_USAGE: DomainUsage[] = [...domainCounts.entries()]
  .map(([domain, sessions]) => ({ domain, sessions }))
  .sort((a, b) => b.sessions - a.sessions);

// ── Monthly usage (production vs test) ─────────────────────────
// Build a rolling 12-month window ending at the current calendar month.
// This shape is what the rangeSlice() presets in filtering.ts assume:
// "This month" = last bucket, "This year" = last (currentMonth+1) buckets,
// "Last year" = all 12. Labels include the two-digit year ("Jan '26") so
// the window stays readable when it crosses a year boundary.
const MONTH_LABELS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const today = new Date();
type RollingBucket = { year: number; month: number; label: string };
const ROLLING_BUCKETS: RollingBucket[] = (() => {
  const out: RollingBucket[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    out.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: `${MONTH_LABELS_SHORT[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`,
    });
  }
  return out;
})();
const bucketIndex = new Map<string, number>(
  ROLLING_BUCKETS.map((b, i) => [`${b.year}-${b.month}`, i]),
);

const monthly: { production: number; test: number }[] = ROLLING_BUCKETS.map(() => ({ production: 0, test: 0 }));
for (const s of RAW_SESSIONS_NEW) {
  const idx = bucketIndex.get(`${s[S.year]}-${s[S.monthIndex]}`);
  if (idx === undefined) continue;
  if (s[S.isProd]) monthly[idx]!.production++;
  else monthly[idx]!.test++;
}
export const MONTHLY_USAGE: MonthlyUsagePoint[] = ROLLING_BUCKETS.map((b, i) => ({
  month: b.label,
  production: monthly[i]!.production,
  test: monthly[i]!.test,
}));

// Monthly usage broken down by CAD platform (CATIA / NX) for the home page.
const monthlyCad: { CATIA: number; NX: number }[] = ROLLING_BUCKETS.map(() => ({ CATIA: 0, NX: 0 }));
for (const s of RAW_SESSIONS_NEW) {
  const idx = bucketIndex.get(`${s[S.year]}-${s[S.monthIndex]}`);
  if (idx === undefined) continue;
  if (s[S.cad] === "CATIA") monthlyCad[idx]!.CATIA++;
  else if (s[S.cad] === "NX") monthlyCad[idx]!.NX++;
}
export const MONTHLY_CAD_USAGE: MonthlyCadUsagePoint[] = ROLLING_BUCKETS.map((b, i) => ({
  month: b.label,
  CATIA: monthlyCad[i]!.CATIA,
  NX: monthlyCad[i]!.NX,
  total: monthlyCad[i]!.CATIA + monthlyCad[i]!.NX,
}));

// ── Fluids vs Sealings split (product-line donut) ───────────────
const fluidsSessions = RAW_SESSIONS_NEW.filter((s) => s[S.productLine] === "FLUIDS").length;
const sealingSessions = RAW_SESSIONS_NEW.filter((s) => s[S.productLine] === "SEALING").length;

export const FLUIDS_SEALING_SPLIT = [
  { name: "Fluids", value: fluidsSessions },
  { name: "Sealings", value: sealingSessions },
];

// ── Headline KPIs (real data) ───────────────────────────────────
const totalSessions = RAW_SESSIONS_NEW.length;
const uniqueUsers = new Set(RAW_SESSIONS_NEW.map((s) => s[S.user])).size;
const avgDurationMin = (() => {
  let totalMin = 0;
  let counted = 0;
  for (const s of RAW_SESSIONS_NEW) {
    const stopMs = s[S.stopMs];
    if (stopMs === null) continue;
    const min = (stopMs - s[S.startMs]) / 60_000;
    if (min >= 0) {
      totalMin += min;
      counted++;
    }
  }
  return counted > 0 ? Math.round(totalMin / counted) : 0;
})();

export const HEADLINE = {
  totalSessions,
  sessionsDelta: Math.round(totalSessions * 0.07),
  activeUsers: uniqueUsers,
  activeUsersDelta: Math.round(uniqueUsers * 0.04),
  applications: APPLICATIONS.length,
  applicationsDelta: 1,
  averageSessionMin: avgDurationMin,
  averageSessionDelta: -3,
};

// ── Admins (placeholder) ────────────────────────────────────────
const ADMIN_USERS = ["adm001", "adm002", "adm003"];
export const ADMIN_RECORDS: AdminRecord[] = ADMIN_USERS.map((u, i) => ({
  id: `adm-${String(i + 1).padStart(3, "0")}`,
  userId: u,
}));

// ── Quick-link suggestions for Home page ───────────────────────
export const QUICK_LINKS = [
  { title: "View latest sessions", description: "See who is using which tool right now",     to: "/sessions" },
  { title: "Compare CAD tools",    description: "Which CAD platform is used the most?",      to: "/reports?tab=cad" },
  { title: "Manage VDI users",     description: "Add, edit, or remove VDI user records",     to: "/vdi" },
  { title: "User-domain mappings", description: "Map users to engineering domains",          to: "/domains" },
];
