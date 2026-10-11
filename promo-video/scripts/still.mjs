// Render individual 3D frames to PNG for look-dev: node scripts/still.mjs out_dir t1 t2 ...
import { chromium } from 'playwright';
import { startServer } from './server.mjs';
const [out, ...ts] = process.argv.slice(2);
const { srv, port } = await startServer();
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
p.on('console', (m) => console.log('[page]', m.text()));
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto(`http://127.0.0.1:${port}/src/test3d.html`);
await p.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
for (const t of ts) {
  const ms = await p.evaluate((t) => window.__render(t), Number(t));
  const t1 = Date.now(); await p.screenshot({ path: `${out}/t${Number(t).toFixed(2)}.png`, timeout: 600000 }); console.log('shot ms', Date.now() - t1);
  console.log('t', t, 'render ms', Math.round(ms));
}
await b.close(); srv.close();
