// Capture frames of the promo page with Playwright.
//   node scripts/frames.mjs <outDir> <startFrame> <endFrameExclusive> [step]
//   node scripts/frames.mjs <outDir> --times 1.0,2.5,...   (single stills, named by time)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { startServer } from './server.mjs';

const [out, a, b, step = '1'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const FPS = 30;
let list;
if (a === '--times') list = b.split(',').map((x) => ({ t: Number(x), name: `t${Number(x).toFixed(3)}.png` }));
else { list = []; for (let f = Number(a); f < Number(b); f += Number(step)) list.push({ t: f / FPS, name: `f${String(f).padStart(5, "0")}.jpg` }); }

const { srv, port } = await startServer();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (!/GPU stall|GL Driver/.test(m.text())) console.log('[page]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/src/video.html`);
await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 300000 });
const err = await page.evaluate(() => window.__error);
if (err) { console.error(err); process.exit(1); }
const t0 = Date.now();
for (const [i, it] of list.entries()) {
  const file = `${out}/${it.name}`;
  if (a !== '--times' && fs.existsSync(file)) continue;
  await page.evaluate((t) => window.__frame(t), it.t);
  await page.screenshot({ path: file, timeout: 600000, ...(file.endsWith('.jpg') ? { type: 'jpeg', quality: 95 } : {}) });
  if (i % 10 === 0) console.log(`${it.name} t=${it.t.toFixed(3)} elapsed=${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
await browser.close();
srv.close();
