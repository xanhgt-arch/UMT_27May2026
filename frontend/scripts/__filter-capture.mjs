import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:4181';
mkdirSync('__shots', { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// 1) Closed state — same as the standard capture.
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.screenshot({ path: '__shots/filter-closed.png', fullPage: false });

// 2) Open the "App" multi-select popover.
await page.getByRole('button', { name: /App:/ }).click();
await page.waitForTimeout(250);
await page.screenshot({ path: '__shots/filter-open-empty.png', fullPage: false });

// 3) Tick a couple of options to demonstrate multi-select.
const optionList = page.locator('[role="dialog"] button[aria-pressed]');
const first  = optionList.first();
const second = optionList.nth(1);
const third  = optionList.nth(2);
await first.click();
await page.waitForTimeout(120);
await second.click();
await page.waitForTimeout(120);
await third.click();
await page.waitForTimeout(200);
await page.screenshot({ path: '__shots/filter-open-3picked.png', fullPage: false });

// 4) Close the popover and show the chip in its "N selected" state.
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
await page.screenshot({ path: '__shots/filter-closed-3picked.png', fullPage: false });

await browser.close();
console.log('captured filter states');
