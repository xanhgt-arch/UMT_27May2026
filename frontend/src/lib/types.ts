// Domain types for UMT — kept aligned with legacy MVC controller JSON shapes
// so swapping mock data for a real API is a one-file change.

export type CadTool = "CATIA" | "NX";

export type Region = "NA" | "EU" | "ASIA" | "SA";

export type SessionStatus = "Active" | "Completed" | "Failed" | "Stopped";

export type Hardware = "VDI" | "Non-VDI";

export type VdiStatus = "Active" | "Inactive" | "Pending" | "Disabled";

export interface Application {
  id: string;
  name: string;
  cad: CadTool;
  productLine: string;
}

export interface MonthlyUsagePoint {
  month: string;        // "Jan", "Feb", …
  production: number;
  test: number;
}

export interface MonthlyCadUsagePoint {
  month: string;        // "Jan", "Feb", …
  CATIA: number;
  NX: number;
  total: number;
}

export interface YearlyMonthlyUsagePoint {
  month: string;
  [year: string]: number | string;
}

export interface ApplicationUsage {
  application: string;
  cad: CadTool;
  productLine: string;
  total: number;
  validation: number;
  execution: number;
  blockCreation: number;
  viewOps: number;
}

export interface ApplicationFunctionalityUsage {
  application: string;
  functionality: string;
  cad: CadTool;
  total: number;
}

export interface CadUsage {
  cad: CadTool;
  sessions: number;
  share: number;        // 0..1
}

export interface RegionUsage {
  region: Region;
  sessions: number;
}

export interface DomainUsage {
  domain: string;
  sessions: number;
}

export interface RawSessionRow {
  id: string;
  srNo: number;
  application: string;
  functionality: string;
  cad: CadTool;
  user: string;
  machine: string;
  domain: string;
  region: Region;
  productLine: string;
  startTime: string;    // "YYYY-MM-DD HH:MM:SS"
  stopTime: string | null;
  startMs: number;
  stopMs: number | null;
  year: number;
  monthIndex: number;   // 0..11
  dayIndex: number;     // 0..30
  monthKey: string;     // "YYYY-MM"
  monthLabel: string;   // "Jan '26"
  status: SessionStatus;
  hardware: Hardware;
  isProd: boolean;
}

// VDI user — fields per the dashboard admin UI:
// fullName, email, domain, region, hostname, status, lastSeen
export interface VdiUserRecord {
  id: string;
  fullName: string;
  email: string;
  domain: string;
  region: Region;
  hostname: string;
  status: VdiStatus;
  lastSeen: string;     // ISO
  
  createdDate?: string
  createdBy?: string
  modifiedDate?: string
  modifiedBy?: string

}

// Domain mapping — technical domain → corporate group:
// technicalDomain, corporateGroup, region, users (count), active
export interface DomainRecord {
  id: string;
  technicalDomain: string;
  corporateGroup: string;
  region: Region;
  users: number;
  active: boolean;
}

// Admin — UMT.txt section 4: "userid, remove, (add admin)"
export interface AdminRecord {
  id: string;
  userId: string;
}

export interface KpiPoint {
  label: string;
  value: number;
}

// ── Filter system ────────────────────────────────────────────────

export type RangePreset =
  | "all"
  | "currentMonth"
  | "lastMonth"
  | "thisYear"
  | "lastYear"
  | "custom";

export type FilterDim =
  | "range"
  | "application"
  | "cad"
  | "productLine"
  | "region"
  | "domain"
  | "hardware"
  | "status";

/**
 * Filter state. Dimension fields are arrays — empty array means "no filter
 * applied" (i.e. show everything). A non-empty array is the explicit
 * selection; multi-select is therefore the default mode.
 *
 * `range` stays a single preset because the date window is, semantically,
 * one continuous interval.
 */
export interface FilterState {
  range: RangePreset;
  customFrom?: string;
  customTo?: string;
  application: string[];
  cad: string[];
  productLine: string[];
  region: string[];
  domain: string[];
  hardware: Hardware[];
  status: SessionStatus[];
}

export type ChartFilterOverride = Partial<FilterState>;

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  meta?: { total: number; page: number; limit: number };
};
