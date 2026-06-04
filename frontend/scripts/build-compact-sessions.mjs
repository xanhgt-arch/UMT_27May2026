import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "src", "lib", "data", "raw-sessions.json");
const targetPath = path.join(root, "src", "lib", "data", "raw-sessions-compact.json");
const publicTargetPath = path.join(root, "public", "static", "raw-sessions-compact.json");
const vdiUsersPath = path.join(root, "src", "lib", "data", "vdi.json");
const domainRecordsPath = path.join(root, "src", "lib", "data", "domains.json");
const publicVdiUsersPath = path.join(root, "public", "static", "vdi.json");
const publicDomainRecordsPath = path.join(root, "public", "static", "domains.json");

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function mapStatus(status) {
  const normalized = String(status ?? "").toUpperCase();
  if (normalized === "SUCCESS") return "Completed";
  if (normalized === "FAILED") return "Failed";
  if (normalized === "STOPPED") return "Stopped";
  if (normalized === "ACTIVE") return "Active";
  return "Completed";
}

function normalizeRow(row, index) {
  const start = new Date(row.StartTime);
  const stop = row.StopTime ? new Date(row.StopTime) : null;
  const year = start.getFullYear();
  const monthIndex = start.getMonth();

  return [
    `sess-${String(index + 1).padStart(4, "0")}`,
    row.SrNo,
    row.ApplicationName || "",
    row.Functionality || "",
    row.CadTool,
    row.UserID || "",
    row.MachineID || "",
    row.Domain || "",
    row.Region,
    row.ProductLine || "",
    String(row.StartTime).replace("T", " ").replace("Z", ""),
    row.StopTime ? String(row.StopTime).replace("T", " ").replace("Z", "") : null,
    start.getTime(),
    stop ? stop.getTime() : null,
    year,
    monthIndex,
    start.getDate() - 1,
    `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
    `${MONTH_LABELS[monthIndex] ?? ""} '${String(year).slice(2)}`,
    mapStatus(row.Status),
    row.IsVDI ? "VDI" : "Non-VDI",
    row.IsProd ?? false,
  ];
}

function toTitleCase(value) {
  return String(value ?? "")
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function toDisplayName(userId) {
  return toTitleCase(String(userId).split("@")[0]) || "Unknown User";
}

function toEmail(userId) {
  const value = String(userId ?? "").trim();
  if (value.includes("@")) return value;
  return value ? `${value.toLowerCase()}@engineering.acme.com` : "unknown@engineering.acme.com";
}

function toVdiStatus(status) {
  if (status === "Active") return "Active";
  if (status === "Failed") return "Disabled";
  return "Inactive";
}

function mostCommon(values) {
  const counts = new Map();
  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "NA";
}

function buildVdiUsers(compactRows) {
  return [...new Map(
    compactRows
      .filter((row) => row[20] === "VDI" && row[5])
      .sort((a, b) => b[12] - a[12])
      .map((row) => [String(row[5]).toLowerCase(), row]),
  ).values()].map((row, index) => ({
    id: `vdi-${String(index + 1).padStart(3, "0")}`,
    fullName: toDisplayName(row[5]),
    email: toEmail(row[5]),
    domain: row[7],
    region: row[8] || "NA",
    hostname: row[6],
    status: toVdiStatus(row[19]),
    lastSeen: new Date(row[12]).toISOString(),
  }));
}

function buildDomainRecords(compactRows) {
  return [...new Map(
    compactRows
      .filter((row) => row[7])
      .map((row) => [String(row[7]).toLowerCase(), row[7]]),
  ).values()]
    .sort((a, b) => String(a).localeCompare(String(b)))
    .map((domain, index) => {
      const rows = compactRows.filter(
        (row) => String(row[7]).toLowerCase() === String(domain).toLowerCase(),
      );

      return {
        id: `dom-${String(index + 1).padStart(3, "0")}`,
        technicalDomain: domain,
        corporateGroup: toTitleCase(domain),
        region: mostCommon(rows.map((row) => row[8])),
        users: new Set(rows.map((row) => row[5]).filter(Boolean).map((user) => String(user).toLowerCase())).size,
        active: rows.some((row) => row[12] > 0),
      };
    });
}

const raw = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const compact = raw.map(normalizeRow);
const vdiUsers = buildVdiUsers(compact);
const domainRecords = buildDomainRecords(compact);

fs.writeFileSync(targetPath, JSON.stringify(compact));
fs.mkdirSync(path.dirname(publicTargetPath), { recursive: true });
fs.writeFileSync(publicTargetPath, JSON.stringify(compact));
fs.writeFileSync(vdiUsersPath, JSON.stringify(vdiUsers));
fs.writeFileSync(domainRecordsPath, JSON.stringify(domainRecords));
fs.writeFileSync(publicVdiUsersPath, JSON.stringify(vdiUsers));
fs.writeFileSync(publicDomainRecordsPath, JSON.stringify(domainRecords));

const sourceBytes = fs.statSync(sourcePath).size;
const targetBytes = fs.statSync(targetPath).size;
const reduction = Math.round((1 - targetBytes / sourceBytes) * 1000) / 10;

console.log(
  `Generated ${path.relative(root, targetPath)} from ${path.relative(root, sourcePath)} ` +
    `and refreshed ${path.relative(root, publicTargetPath)} ` +
    `${path.relative(root, publicVdiUsersPath)}, ${path.relative(root, publicDomainRecordsPath)} ` +
    `(${compact.length} rows, ${reduction}% smaller).`,
);
