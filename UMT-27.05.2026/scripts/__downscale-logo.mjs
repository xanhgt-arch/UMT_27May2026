// One-shot script: take the original cooper_logo.png in the project root,
// auto-trim its transparent margin, downscale to 256px on the long edge,
// and write the result to public/cooper-mark.png. Re-runnable.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('cooper_logo.png');
const dataUrl = `data:image/png;base64,${src.toString('base64')}`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(
  `<!doctype html><html><body><img id="src" src="${dataUrl}"/></body></html>`,
  { waitUntil: 'load' },
);
await page.waitForFunction('document.getElementById("src").complete');

const b64 = await page.evaluate(() => {
  const img = document.getElementById('src');
  const { naturalWidth: W, naturalHeight: H } = img;

  // Paint to canvas, read pixels, find bounding box of non-transparent pixels.
  const probe = document.createElement('canvas');
  probe.width = W;
  probe.height = H;
  const pctx = probe.getContext('2d');
  pctx.drawImage(img, 0, 0);
  const data = pctx.getImageData(0, 0, W, H).data;

  let minX = W, minY = H, maxX = -1, maxY = -1;
  const ALPHA_THRESHOLD = 8;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = data[(y * W + x) * 4 + 3];
      if (a > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) {
    // Fully transparent — fall back to the full image.
    minX = 0; minY = 0; maxX = W - 1; maxY = H - 1;
  }

  // Add a tiny breathing-room margin so anti-aliased edges don't clip.
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.04);
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(W - 1, maxX + pad);
  maxY = Math.min(H - 1, maxY + pad);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  // Downscale so the longer edge is 256px. Browsers will sample down further
  // at smaller call-sites without ringing — Geist anti-aliasing handles it.
  const TARGET = 256;
  const scale = TARGET / Math.max(cropW, cropH);
  const outW = Math.round(cropW * scale);
  const outH = Math.round(cropH * scale);

  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(img, minX, minY, cropW, cropH, 0, 0, outW, outH);

  return {
    b64: out.toDataURL('image/png').split(',')[1],
    cropW, cropH, outW, outH,
  };
});

writeFileSync('public/cooper-mark.png', Buffer.from(b64.b64, 'base64'));

await browser.close();
console.log('cropped to swoosh bounds; output', b64.outW, 'x', b64.outH);
