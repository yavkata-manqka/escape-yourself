// Capture frames: node scripts/frames.mjs <outDir> <from> <toExclusive> | <outDir> --list f1,f2,...
import { chromium } from 'playwright';
import fs from 'node:fs';
import { startServer } from './server.mjs';

const [out, a, b] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const { srv, port } = await startServer();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
await page.goto(`http://127.0.0.1:${port}/src/index.html`);
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 180000 });
const err = await page.evaluate(() => window.__error);
if (err) { console.error(err); process.exit(1); }
let list = [];
if (a === '--list') list = b.split(',').map(Number);
else for (let f = Number(a); f < Number(b); f++) list.push(f);
const ext = a === '--list' ? 'png' : 'jpg';
const t0 = Date.now();
for (const [i, f] of list.entries()) {
  const file = `${out}/f${String(f).padStart(5, '0')}.${ext}`;
  if (ext === 'jpg' && fs.existsSync(file)) continue;
  await page.evaluate((f) => window.__frame(f), f);
  await page.screenshot({ path: file, timeout: 600000, ...(ext === 'jpg' ? { type: 'jpeg', quality: 94 } : {}) });
  if (i % 30 === 0) console.log(`frame ${f} elapsed ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
console.log('done', list.length);
await browser.close(); srv.close();
