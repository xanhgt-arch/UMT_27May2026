import type { CadTool, Hardware, RawSessionRow, Region, SessionStatus } from "./types";

export type CompactRawSession = [
  string,
  number,
  string,
  string,
  CadTool,
  string,
  string,
  string,
  Region,
  string,
  string,
  string | null,
  number,
  number | null,
  number,
  number,
  number,
  string,
  string,
  SessionStatus,
  Hardware,
  boolean,
];

export const COMPACT_SESSION = {
  id: 0,
  srNo: 1,
  application: 2,
  functionality: 3,
  cad: 4,
  user: 5,
  machine: 6,
  domain: 7,
  region: 8,
  productLine: 9,
  startTime: 10,
  stopTime: 11,
  startMs: 12,
  stopMs: 13,
  year: 14,
  monthIndex: 15,
  dayIndex: 16,
  monthKey: 17,
  monthLabel: 18,
  status: 19,
  hardware: 20,
  isProd: 21,
} as const;

async function loadCompactSessions(): Promise<CompactRawSession[]> {
  const configuredUrl = import.meta.env.VITE_SESSION_DATA_URL as string | undefined;
  const backendUrl = import.meta.env.VITE_BACKEND_URL as string | undefined;
  

  const dataUrls = [
    configuredUrl,
    backendUrl ? `${backendUrl.replace(/\/$/, "")}/api/export/raw-sessions-compact` : undefined,
  ].filter((url): url is string => Boolean(url));

  let lastError: unknown;

  for (const dataUrl of dataUrls) {
    try {
      const response = await fetch(dataUrl, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as CompactRawSession[];

      if (!Array.isArray(data)) {
        throw new Error("Response was not a compact session array");
      }

      return data;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Failed to load compact session data: ${
      lastError instanceof Error ? lastError.message : "Unknown error"
    }`,
  );
}

export const RAW_SESSION_COMPACT_ROWS = await loadCompactSessions();


const materializedRows: Array<RawSessionRow | undefined> = new Array(
  RAW_SESSION_COMPACT_ROWS.length,
);

export function compactToRawSession(s: CompactRawSession): RawSessionRow {
  return {
    id: s[COMPACT_SESSION.id],
    srNo: s[COMPACT_SESSION.srNo],
    application: s[COMPACT_SESSION.application],
    functionality: s[COMPACT_SESSION.functionality],
    cad: s[COMPACT_SESSION.cad],
    user: s[COMPACT_SESSION.user],
    machine: s[COMPACT_SESSION.machine],
    domain: s[COMPACT_SESSION.domain],
    region: s[COMPACT_SESSION.region],
    productLine: s[COMPACT_SESSION.productLine],
    startTime: s[COMPACT_SESSION.startTime],
    stopTime: s[COMPACT_SESSION.stopTime],
    startMs: s[COMPACT_SESSION.startMs],
    stopMs: s[COMPACT_SESSION.stopMs],
    year: s[COMPACT_SESSION.year],
    monthIndex: s[COMPACT_SESSION.monthIndex],
    dayIndex: s[COMPACT_SESSION.dayIndex],
    monthKey: s[COMPACT_SESSION.monthKey],
    monthLabel: s[COMPACT_SESSION.monthLabel],
    status: s[COMPACT_SESSION.status],
    hardware: s[COMPACT_SESSION.hardware],
    isProd: s[COMPACT_SESSION.isProd],
  };
}

export function getRawSessionAt(index: number): RawSessionRow {
  const cached = materializedRows[index];
  if (cached) return cached;

  const row = compactToRawSession(RAW_SESSION_COMPACT_ROWS[index]!);
  materializedRows[index] = row;
  return row;
}
