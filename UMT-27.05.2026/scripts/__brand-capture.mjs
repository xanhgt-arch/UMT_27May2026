import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const routes = [
  { path: '/',         file: 'home.png' },
  { path: '/reports',  file: 'reports.png' },
  { path: '/sessions', file: 'sessions.png' },
  { path: '/vdi',      file: 'vdi.png' },
  { path: '/domains',  file: 'domains.png' },
];

const BASE = process.env.BASE || 'http://127.0.0.1:4173';
const outDir = '__shots';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

for (const r of routes) {
  await page.goto(`${BASE}${r.path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/${r.file}`, fullPage: false });
  console.log(`captured ${r.path}`);
}

await browser.close();
