// Capture frames: node scripts/frames.mjs <outDir> <from> <toExclusive> | <outDir> --list 0,157,...
import { chromium } from 'playwright';
import fs from 'node:fs';
import { startServer } from './server.mjs';

const [out, a, b] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
let list = [];
if (a === '--list') list = b.split(',').map(Number);
else for (let f = Number(a); f < Number(b); f++) list.push(f);
const { srv, port } = await startServer();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/src/index.html`);
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 120000 });
const err = await page.evaluate(() => window.__error);
if (err) { console.error(err); process.exit(1); }
const ext = a === '--list' ? 'png' : 'jpg';
for (const f of list) {
  await page.evaluate((f) => window.__frame(f), f);
  const file = `${out}/f${String(f).padStart(5, '0')}.${ext}`;
  await page.screenshot({ path: file, ...(ext === 'jpg' ? { type: 'jpeg', quality: 95 } : {}) });
}
console.log('done', list.length);
await browser.close(); srv.close();
