import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const staticDir = path.join(root, "dist", "static");
const files = [
  {
    source: "src/lib/data/raw-sessions-compact.json",
    target: "raw-sessions-compact.json",
    label: "compact data file",
  },
  {
    source: "src/lib/data/vdi.json",
    target: "vdi.json",
    label: "VDI users data file",
  },
  {
    source: "src/lib/data/domains.json",
    target: "domains.json",
    label: "domain records data file",
  },
];

fs.mkdirSync(staticDir, { recursive: true });

for (const { source, target, label } of files) {
  const sourcePath = path.join(root, source);
  const targetPath = path.join(staticDir, target);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing ${label}: ${source}`);
  }

  fs.copyFileSync(sourcePath, targetPath);
  console.log(`Copied ${label}: ${source} -> ${path.relative(root, targetPath)}`);
}
