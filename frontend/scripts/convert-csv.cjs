/* CSV → dashboard JSON conversion.
   Reads MyReport_UsageData_2026-05-06.csv and writes:
   - src/lib/data/raw-sessions.json
   - src/lib/data/vdi.json
   - src/lib/data/domains.json
   Random fills for missing values: srNo, userId, machine, domain, fullName,
   email, hostname, status, lastSeen, technicalDomain, corporateGroup, users, active. */

const fs = require("fs");
const path = require("path");

// Deterministic PRNG so output is stable across runs.
function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260506);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (min, max) => Math.floor(min + rand() * (max - min + 1));

// ── Pools ──────────────────────────────────────────────────────────────
const TECH_DOMAINS_BY_REGION = {
  NA: ["MTC", "NORTHVILLE", "AUBURN", "TATA", "MYCORP", "CSAID"],
  EU: ["MERGON", "CSAID", "LINDAU"],
  ASIA: ["CSAID", "ASIA"],
  SA: ["CSAID"],
};
const CORP_GROUPS_BY_DOMAIN = {
  MTC: "Auburn Hills R&D",
  NORTHVILLE: "Northville Tech Center",
  AUBURN: "Auburn Hills R&D",
  TATA: "Tata Consultancy Services",
  MYCORP: "Mycorp Engineering",
  CSAID: "CSAID Corporate IT",
  MERGON: "Mergon Group",
  LINDAU: "Lindau Sealing Tech",
  ASIA: "Asia Pacific Engineering",
};
const FIRST_NAMES = [
  "Alex", "Sam", "Jordan", "Morgan", "Taylor", "Casey", "Pat", "Quinn",
  "Riley", "Avery", "Drew", "Jamie", "Reese", "Robin", "Sage", "Skylar",
  "Andre", "Maria", "Tina", "Carlos", "Yuki", "Hiro", "Priya", "Ravi",
  "Anna", "Mark", "Ethan", "Sophia", "Liam", "Olivia", "Noah", "Emma",
  "Lucas", "Mia", "Daniel", "Isabel", "Ben", "Amelia", "Ivan", "Lea",
];
const LAST_NAMES = [
  "Patel", "Smith", "Johnson", "Brown", "Garcia", "Martinez", "Lopez", "Lee",
  "Walker", "Hall", "Allen", "Young", "King", "Wright", "Scott", "Green",
  "Adams", "Baker", "Nelson", "Carter", "Mitchell", "Perez", "Roberts", "Turner",
  "Phillips", "Campbell", "Parker", "Evans", "Edwards", "Collins", "Stewart", "Sanchez",
  "Morris", "Rogers", "Reed", "Cook", "Morgan", "Bell", "Murphy", "Bailey",
];
const USER_PREFIXES = [
  "adi", "tag", "jhu", "cci", "ear", "uka", "cdo", "tca", "aec", "jva",
  "cst", "jsa", "cni", "aca", "gnp", "ata", "dpr", "ygo", "vaz", "kmo",
  "apa", "gfl", "vyu", "vkh", "ssi", "dba", "vgh", "mka", "ske", "ala",
  "ahu", "kau", "ume", "psu", "bbo", "scr", "esa", "ies", "cpa", "jar",
];
const MACHINE_PREFIXES = {
  NA: ["VR2EFORD", "VR2ECAD", "VR2ESTLA", "VR2E11FORD", "VR2E11STLA", "VR2EGM", "VR2E11GM", "VR2E11CAD"],
  EU: ["FR2ECAD", "FR2E11CAD", "BAR-CADPOOL", "DZIN", "LINN", "SMTN", "BAR-NOTEBOOK", "LOGD"],
  ASIA: ["SHQN", "STCN", "STCD", "KUNN", "INBR2LPT-", "INHNJLPT-"],
  SA: ["SAEC"],
};
const STATUSES = ["Active", "Active", "Active", "Active", "Inactive", "Pending", "Disabled"];
const EMAIL_DOMAIN = "engineering.acme.com";

function makeUserId() {
  const prefix = USER_PREFIXES[Math.floor(rand() * USER_PREFIXES.length)];
  return `${prefix}${between(1, 99)}`;
}
function makeMachineId(region) {
  const pool = MACHINE_PREFIXES[region] || MACHINE_PREFIXES.NA;
  const prefix = pool[Math.floor(rand() * pool.length)];
  if (prefix.endsWith("-")) return `${prefix}${between(900000, 999999)}`;
  return `${prefix}${String(between(1, 99)).padStart(3, "0")}`;
}
function makeTechDomain(region) {
  const pool = TECH_DOMAINS_BY_REGION[region] || TECH_DOMAINS_BY_REGION.NA;
  return pool[Math.floor(rand() * pool.length)];
}
function makeFullName() {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}
function emailFor(fullName) {
  const [first, last] = fullName.toLowerCase().split(" ");
  return `${first}.${last}@${EMAIL_DOMAIN}`;
}
function hostnameFor(region) {
  const prefix = pick(["VDI-", "WS-", "DESK-", "CAD-"]);
  return `${prefix}${region}-${String(between(1000, 9999))}`;
}

// ── Date helpers ───────────────────────────────────────────────────────
function parseMDY(s) {
  const [m, d, y] = s.split("/").map((x) => parseInt(x, 10));
  return new Date(y, m - 1, d);
}
function fmtIsoLocal(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
function fmtIso(date) {
  return date.toISOString();
}

// ── CSV parser (file has no quoted/escaped commas) ─────────────────────
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const headerIdx = lines.findIndex((l) => l.startsWith("ApplicationName"));
  const headers = lines[headerIdx].split(",").map((h) => h.trim());
  return lines.slice(headerIdx + 1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

// ── Normalization ──────────────────────────────────────────────────────
function normCad(s) {
  const u = (s || "").toUpperCase();
  return u === "NX" ? "NX" : "CATIA";
}
function normPL(s) { return (s || "GENERAL").toUpperCase(); }
function normRegion(s) {
  const u = (s || "").toUpperCase();
  return ["NA", "EU", "ASIA", "SA"].includes(u) ? u : "NA";
}
function normHardware(isVDI) {
  return String(isVDI).toUpperCase() === "TRUE" ? "VDI" : "Non-VDI";
}
function normStatus(s) {
  const u = (s || "").toUpperCase();
  if (u === "FAILED" || u === "FAIL") return "Failed";
  if (u === "STOPPED") return "Stopped";
  if (u === "ACTIVE") return "Active";
  if (u === "SUCCESS") return "Completed";
  return "Completed";
}

// ── Main ───────────────────────────────────────────────────────────────
const CSV_PATH = path.resolve(__dirname, "..", "..", "MyReport_UsageData_2026-05-06.csv");
const OUT_DIR = path.resolve(__dirname, "..", "src", "lib", "data");

const csvText = fs.readFileSync(CSV_PATH, "utf8");
const rows = parseCsv(csvText);
console.log(`Parsed ${rows.length} CSV rows.`);

// Build a stable user pool. Each user gets a region, a tech domain and a machine.
const USER_COUNT = 110;
const userPool = Array.from({ length: USER_COUNT }, () => {
  const region = pick(["NA", "NA", "NA", "EU", "EU", "ASIA", "ASIA"]);
  const fullName = makeFullName();
  return {
    userId: makeUserId(),
    fullName,
    email: emailFor(fullName),
    hostname: hostnameFor(region),
    region,
    domain: makeTechDomain(region),
    machine: makeMachineId(region),
    isVDI: rand() < 0.7,
    status: pick(STATUSES),
  };
});

// ── Build raw sessions ─────────────────────────────────────────────────
const baseSrNo = 120000;
const sessions = rows.map((row, idx) => {
  const region = normRegion(row.Region);
  const wantVDI = String(row.isVDI).toUpperCase() === "TRUE";
  const candidates = userPool.filter((u) => u.region === region && u.isVDI === wantVDI);
  const fallback = userPool.filter((u) => u.region === region);
  const user = candidates.length ? pick(candidates) : (fallback.length ? pick(fallback) : pick(userPool));

  const start = parseMDY(row.StartDate);
  const stop = parseMDY(row.StopDate);
  start.setHours(between(7, 18), between(0, 59), between(0, 59), 0);
  const durationSec = between(1, 600);
  stop.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), 0);
  stop.setSeconds(stop.getSeconds() + durationSec);

  return {
    id: `sess-${String(idx + 1).padStart(4, "0")}`,
    srNo: baseSrNo + idx,
    application: row.ApplicationName,
    functionality: row.Functionality,
    cad: normCad(row.cadTool),
    user: user.userId,
    machine: user.machine,
    domain: user.domain,
    region,
    productLine: normPL(row.ProductLine),
    startTime: fmtIsoLocal(start),
    stopTime: fmtIsoLocal(stop),
    status: normStatus(row.Status),
    hardware: normHardware(row.isVDI),
    isProd: String(row.isProd).toUpperCase() === "TRUE",
  };
});

fs.writeFileSync(path.join(OUT_DIR, "raw-sessions.json"), JSON.stringify(sessions));
console.log(`Wrote ${sessions.length} sessions.`);

// ── Build VDI users (one per unique user that ran at least one VDI session) ───
const vdiSeen = new Map();
for (const s of sessions) {
  if (s.hardware !== "VDI") continue;
  if (!vdiSeen.has(s.user)) vdiSeen.set(s.user, s);
}
const vdiUsers = [...vdiSeen.entries()].map(([userId, sess], i) => {
  const profile = userPool.find((u) => u.userId === userId);
  const lastSeen = new Date(sess.startTime.replace(" ", "T"));
  return {
    id: `vdi-${String(i + 1).padStart(3, "0")}`,
    fullName: profile?.fullName ?? makeFullName(),
    email: profile?.email ?? emailFor(profile?.fullName ?? makeFullName()),
    domain: sess.domain,
    region: sess.region,
    hostname: profile?.hostname ?? hostnameFor(sess.region),
    status: profile?.status ?? "Active",
    lastSeen: fmtIso(lastSeen),
  };
});
fs.writeFileSync(path.join(OUT_DIR, "vdi.json"), JSON.stringify(vdiUsers));
console.log(`Wrote ${vdiUsers.length} VDI users.`);

// ── Build domain records (technicalDomain → corporateGroup mapping) ────
const domainStats = new Map();
for (const s of sessions) {
  const key = s.domain;
  if (!domainStats.has(key)) {
    domainStats.set(key, { region: s.region, users: new Set() });
  }
  const v = domainStats.get(key);
  v.users.add(s.user);
}
const domainRecords = [...domainStats.entries()].map(([techDomain, stats], i) => ({
  id: `dom-${String(i + 1).padStart(3, "0")}`,
  technicalDomain: techDomain,
  corporateGroup: CORP_GROUPS_BY_DOMAIN[techDomain] || `${techDomain} Corporate`,
  region: stats.region,
  users: stats.users.size,
  active: rand() < 0.92,
}));
fs.writeFileSync(path.join(OUT_DIR, "domains.json"), JSON.stringify(domainRecords));
console.log(`Wrote ${domainRecords.length} domain records.`);

// ── Quick stats ────────────────────────────────────────────────────────
const byApp = new Map();
const byCad = new Map();
const byRegion = new Map();
const byDomain = new Map();
const byFunctionality = new Map();
let prodCount = 0;
let vdiCount = 0;
for (const s of sessions) {
  byApp.set(s.application, (byApp.get(s.application) || 0) + 1);
  byCad.set(s.cad, (byCad.get(s.cad) || 0) + 1);
  byRegion.set(s.region, (byRegion.get(s.region) || 0) + 1);
  byDomain.set(s.domain, (byDomain.get(s.domain) || 0) + 1);
  const k = `${s.application} / ${s.functionality}`;
  byFunctionality.set(k, (byFunctionality.get(k) || 0) + 1);
  if (s.isProd) prodCount++;
  if (s.hardware === "VDI") vdiCount++;
}
console.log("Apps:", byApp.size, "Functionality combos:", byFunctionality.size);
console.log("CAD:", [...byCad], "Regions:", [...byRegion]);
console.log("Domains:", [...byDomain.entries()].sort((a, b) => b[1] - a[1]));
console.log("Prod:", prodCount, "VDI:", vdiCount);
