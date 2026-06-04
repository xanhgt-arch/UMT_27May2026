import { chromium } from 'playwright';

const routes = [
  { path: '/', file: 'home.png' },
  { path: '/reports', file: 'reports.png' },
  { path: '/sessions', file: 'sessions.png' },
];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

for (const r of routes) {
  await page.goto(`http://localhost:5173${r.path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `__shots/${r.file}`, fullPage: false });
  console.log(`captured ${r.path}`);
}

await browser.close();
