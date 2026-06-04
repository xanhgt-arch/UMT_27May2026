// Smoke test the rolling-12-month aggregation: print every bucket and
// the slice that "This year" / "Last year" would return.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sessions = JSON.parse(
  readFileSync(join(__dirname, "..", "src", "lib", "data", "raw-sessions.json"), "utf-8"),
);

const SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const today = new Date();
const buckets = [];
for (let i = 11; i >= 0; i--) {
  const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
  buckets.push({
    year: d.getFullYear(),
    month: d.getMonth(),
    label: `${SHORT[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`,
    CATIA: 0,
    NX: 0,
  });
}
const idx = new Map(buckets.map((b, i) => [`${b.year}-${b.month}`, i]));
for (const s of sessions) {
  const y = parseInt(s.startTime.slice(0, 4), 10);
  const m = parseInt(s.startTime.slice(5, 7), 10) - 1;
  const i = idx.get(`${y}-${m}`);
  if (i === undefined) continue;
  if (s.cad === "CATIA") buckets[i].CATIA++;
  else if (s.cad === "NX") buckets[i].NX++;
}

console.log("today:", today.toISOString().slice(0, 10), "month idx:", today.getMonth());
console.log();
console.log("Full rolling 12-month window:");
for (const b of buckets) {
  console.log(`  ${b.label.padEnd(8)} CATIA=${String(b.CATIA).padStart(5)}  NX=${String(b.NX).padStart(4)}  total=${b.CATIA + b.NX}`);
}
console.log();

const thisYearSlice = buckets.slice(-(today.getMonth() + 1));
console.log(`"This year" slice (last ${today.getMonth() + 1} buckets):`);
for (const b of thisYearSlice) {
  console.log(`  ${b.label.padEnd(8)} total=${b.CATIA + b.NX}`);
}
console.log();

const currentMonth = buckets.slice(-1);
console.log("\"This month\" slice:");
for (const b of currentMonth) console.log(`  ${b.label} total=${b.CATIA + b.NX}`);

const lastMonth = buckets.slice(-2, -1);
console.log("\"Last month\" slice:");
for (const b of lastMonth) console.log(`  ${b.label} total=${b.CATIA + b.NX}`);
