// Quick smoke test: print the headline aggregates and a few breakdowns so
// we can eyeball whether the 2026 import lands cleanly.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sessions = JSON.parse(
  readFileSync(join(__dirname, "..", "src", "lib", "data", "raw-sessions.json"), "utf-8"),
);

const total = sessions.length;
const users = new Set(sessions.map((s) => s.user)).size;
const apps  = new Set(sessions.map((s) => s.application)).size;

const monthly = Array(12).fill(0);
for (const s of sessions) monthly[parseInt(s.startTime.slice(5, 7), 10) - 1]++;

const productCounts = {};
for (const s of sessions) productCounts[s.productLine] = (productCounts[s.productLine] ?? 0) + 1;

const regionCounts = {};
for (const s of sessions) regionCounts[s.region] = (regionCounts[s.region] ?? 0) + 1;

console.log("─── HEADLINE ─────────────────");
console.log("Total sessions:", total);
console.log("Unique users  :", users);
console.log("Applications  :", apps);
console.log("");
console.log("─── MONTHLY (aggregated across both years) ───");
const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
labels.forEach((l, i) => console.log(`  ${l}: ${monthly[i]}`));
console.log("");
console.log("─── PRODUCT LINE ───");
for (const [k, v] of Object.entries(productCounts)) console.log(`  ${k.padEnd(15)}: ${v}`);
console.log("");
console.log("─── REGION ───");
for (const [k, v] of Object.entries(regionCounts)) console.log(`  ${k}: ${v}`);
