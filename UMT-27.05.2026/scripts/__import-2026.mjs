// One-off importer: append 2026 rows from the CSV report to raw-sessions.json.
// The CSV (MyReport_UsageData_2026-05-12) carries only the public columns:
//   ApplicationName, Functionality, cadTool, ProductLine, Status,
//   Region, StartDate, StopDate, isProd, isVDI
// We synthesize the other RawSessionRow fields (id, srNo, user, machine,
// domain, startTime time-of-day) using a seeded PRNG so the import is
// deterministic and re-running produces an identical file.

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "src", "lib", "data");
const SESSIONS_PATH = join(DATA_DIR, "raw-sessions.json");
const CSV_PATH = "C:/Users/vinay/Downloads/MyReport_UsageData_2026-05-12.csv";

const STATUS_MAP = { Success: "Completed", Failed: "Failed", Stopped: "Stopped", Active: "Active" };

// Seeded mulberry32 PRNG so output is reproducible.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260512);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const pad = (n, w = 2) => String(n).padStart(w, "0");

// Read existing sessions, drop any previously-imported 2026 rows so the
// script is idempotent, then learn the pools and the next available ids.
const all = JSON.parse(readFileSync(SESSIONS_PATH, "utf-8"));
const existing = all.filter((s) => !s.startTime.startsWith("2026"));
const userPool    = [...new Set(existing.map((s) => s.user))];
const machinePool = [...new Set(existing.map((s) => s.machine))];
const domainPool  = [...new Set(existing.map((s) => s.domain))];
let nextSrNo = Math.max(...existing.map((s) => s.srNo)) + 1;
let nextIdNum = existing.length + 1;

// Parse CSV (skip 2 preamble lines + header line) and keep only 2026 rows.
const csvRaw = readFileSync(CSV_PATH, "utf-8");
const lines = csvRaw.split(/\r?\n/);
const dataLines = lines.slice(3).filter((l) => l.trim().length > 0);

function toIsoDateTime(mdy, hh, mm, ss) {
  // mdy like "1/2/2026" -> "2026-01-02"
  const [m, d, y] = mdy.split("/").map((x) => parseInt(x, 10));
  return `${y}-${pad(m)}-${pad(d)} ${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

const appended = [];
for (const line of dataLines) {
  // Naive CSV split — the report has no quoted/escaped commas in these columns.
  const cols = line.split(",");
  if (cols.length < 10) continue;
  const [appRaw, fnRaw, cad, productLineRaw, status, region, startDate, stopDate, isProd, isVDI] = cols.map((c) => c.trim());

  if (!startDate.endsWith("/2026")) continue;

  // Normalise the bookkeeping strings so chart aggregations don't split
  // on casing or whitespace inconsistencies that the report introduced.
  const productLine = productLineRaw.toUpperCase();
  const app = appRaw.toUpperCase();
  const fn  = fnRaw.toUpperCase();

  // Synthesize a plausible same-day session window: 7am–6pm start,
  // duration 2–35 minutes, clamped within the day.
  const startHour = 7 + Math.floor(rand() * 11);          // 7..17
  const startMin  = Math.floor(rand() * 60);
  const startSec  = Math.floor(rand() * 60);
  const durMin    = 2 + Math.floor(rand() * 34);
  const startTotalSec = startHour * 3600 + startMin * 60 + startSec;
  const stopTotalSec  = Math.min(startTotalSec + durMin * 60, 23 * 3600 + 59 * 60 + 59);
  const sH = Math.floor(stopTotalSec / 3600);
  const sM = Math.floor((stopTotalSec % 3600) / 60);
  const sS = stopTotalSec % 60;

  appended.push({
    id: `sess-${pad(nextIdNum, 4)}`,
    srNo: nextSrNo,
    application: app,
    functionality: fn,
    cad,
    user: pick(userPool),
    machine: pick(machinePool),
    domain: pick(domainPool),
    region,
    productLine,
    startTime: toIsoDateTime(startDate, startHour, startMin, startSec),
    stopTime:  toIsoDateTime(stopDate || startDate, sH, sM, sS),
    status: STATUS_MAP[status] ?? "Completed",
    hardware: isVDI.toUpperCase() === "TRUE" ? "VDI" : "Non-VDI",
    isProd: isProd.toUpperCase() === "TRUE",
  });
  nextIdNum++;
  nextSrNo++;
}

const merged = [...existing, ...appended];
writeFileSync(SESSIONS_PATH, JSON.stringify(merged));
console.log(`Existing: ${existing.length}`);
console.log(`Appended 2026 rows: ${appended.length}`);
console.log(`New total: ${merged.length}`);
