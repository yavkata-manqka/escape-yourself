// "Видеото е стаята" — a 15 s Reel that is itself an escape-room puzzle.
// Code = 1 9 1 0 (the day the qualifications start). Each digit is visible for
// exactly ONE frame; the 4th digit lives in frame 0, so it is only found when
// the Reel loops. Everything is a pure function of the frame number.
import { Riso } from './riso.js';

const W = 1080, H = 1920, FPS = 30;
// timeline: a safe 1.5 s intro (often missed when a Reel starts), the 15 s puzzle,
// then a 3 s hold on the final card with all logos
export const INTRO = 45, MAIN = 450, OUTRO = 90, TOTAL = INTRO + MAIN + OUTRO;
const N = TOTAL;
const BEAT = 60 / 128 * FPS; // 14.0625 frames per beat (128 BPM, 32 beats = 15 s)
const DISPLAY = 'Unbounded', MONO = 'JetBrains Mono';

// the four hidden frames (in puzzle frames, i.e. global frame - INTRO): frame -> [slot (1-based), digit]
export const HIDDEN = { 0: [4, '0'], 157: [3, '1'], 236: [1, '1'], 301: [2, '9'] };

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const range = (x, a, b) => clamp((x - a) / (b - a));
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const backOut = (t, s = 2.2) => { t = clamp(t) - 1; return t * t * ((s + 1) * t + s) + 1; };
function hash(n) { let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; }

// ------------------------------------------------------------------ layers
const layers = {};
for (const k of ['blue', 'pink', 'yellow']) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  layers[k] = c;
}
// willReadFrequently keeps the canvases in CPU memory; their pixels are read back
// explicitly every frame, so WebGL can never see a stale GPU snapshot.
const ctx = (k) => layers[k].getContext('2d', { willReadFrequently: true });

function clearAll() {
  for (const k in layers) {
    const g = ctx(k);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
  }
}
const SOLID = '#ff0000';
const tone = (a) => `rgba(0,255,0,${a})`;

function withCtx(k, fn) { const g = ctx(k); g.save(); fn(g); g.restore(); }

function font(size, weight = 900, fam = DISPLAY) { return `${weight} ${size}px "${fam}"`; }

function fitSize(str, maxW, maxSize, weight = 900, fam = DISPLAY, ls = -0.02) {
  const g = ctx('blue');
  g.font = font(100, weight, fam);
  g.letterSpacing = `${ls * 100}px`;
  const w = g.measureText(str).width;
  return Math.min(maxSize, Math.floor(100 * maxW / w));
}

function text(k, str, x, y, size, { weight = 900, fam = DISPLAY, align = 'center', ls = -0.02, rot = 0, scale = 1, fill = SOLID, erase = false } = {}) {
  withCtx(k, (g) => {
    g.translate(x, y);
    g.rotate(rot);
    g.scale(scale, scale);
    g.font = font(size, weight, fam);
    g.letterSpacing = `${ls * size}px`;
    g.textAlign = align;
    g.textBaseline = 'middle';
    if (erase) g.globalCompositeOperation = 'destination-out';
    g.fillStyle = erase ? '#000' : fill;
    g.fillText(str, 0, 0);
  });
}

function rect(k, x, y, w, h, { rot = 0, fill = SOLID, erase = false, cx, cy } = {}) {
  withCtx(k, (g) => {
    if (rot) { g.translate(cx ?? x + w / 2, cy ?? y + h / 2); g.rotate(rot); g.translate(-(cx ?? x + w / 2), -(cy ?? y + h / 2)); }
    if (erase) g.globalCompositeOperation = 'destination-out';
    g.fillStyle = erase ? '#000' : fill;
    g.fillRect(x, y, w, h);
  });
}

// ------------------------------------------------------------------ recurring HUD
function frameCounter(f, onFlash) {
  const k = onFlash ? 'blue' : 'blue';
  text(k, `КАДЪР ${String(f + 1).padStart(3, '0')} / ${N}`, 64, 292, 34, { weight: 700, fam: MONO, align: 'left', ls: 0.04 });
  // blinking record dot + label on the right
  if (Math.floor(f / 15) % 2 === 0 || onFlash) withCtx('pink', (g) => { g.fillStyle = SOLID; g.beginPath(); g.arc(780, 292, 12, 0, Math.PI * 2); g.fill(); });
  text('blue', 'ЗАКЛЮЧЕНО', 1016, 292, 34, { weight: 700, fam: MONO, align: 'right', ls: 0.04 });
  rect('blue', 64, 330, 952, 4);
}

const SLOT = { w: 150, h: 176, gap: 34, y: 1330 };
function slotX(i) { const total = 4 * SLOT.w + 3 * SLOT.gap; return (W - total) / 2 + i * (SLOT.w + SLOT.gap); }

function slotBar(f, appear, { active = 0, digit = '', onFlash = false } = {}) {
  const k = onFlash ? 'blue' : 'blue';
  text(k, 'КОД ЗА ИЗХОД', W / 2, SLOT.y - 44, 30, { weight: 700, fam: MONO, ls: 0.18 });
  for (let i = 0; i < 4; i++) {
    const a = onFlash ? 1 : backOut(range(f, appear + i * 2, appear + i * 2 + 6));
    if (a <= 0) continue;
    const x = slotX(i), cx = x + SLOT.w / 2, cy = SLOT.y + SLOT.h / 2;
    withCtx(k, (g) => {
      g.translate(cx, cy); g.scale(a, a); g.translate(-cx, -cy);
      g.strokeStyle = SOLID; g.lineWidth = 9;
      g.strokeRect(x + 4.5, SLOT.y + 4.5, SLOT.w - 9, SLOT.h - 9);
    });
    if (active === i + 1) {
      rect('blue', x, SLOT.y, SLOT.w, SLOT.h);
      text('blue', digit, cx, cy + 6, 132, { erase: true });
    } else {
      // empty slot: a blinking underscore
      if (onFlash || Math.floor((f + i * 4) / 10) % 2 === 0) rect(k, cx - 34, SLOT.y + SLOT.h - 46, 68, 10);
    }
  }
}

// ------------------------------------------------------------------ text blocks
// lines: [{s, at, hl}] — each line slams in at frame `at`, fitted to the column width
function block(f, lines, yCenter, { maxSize = 200, width = 940, gap = 0.2, shadow = 'pink' } = {}) {
  const sizes = lines.map((l) => fitSize(l.s, width, l.max ?? maxSize));
  const heights = sizes.map((s) => s * (0.92 + gap));
  const total = heights.reduce((a, b) => a + b, 0);
  let y = yCenter - total / 2;
  lines.forEach((l, i) => {
    const s = sizes[i];
    const cy = y + heights[i] / 2;
    y += heights[i];
    if (f < l.at) return;
    const k = (f - l.at) / 5;
    const sc = k < 1 ? 1.35 - 0.35 * easeOut(k) : 1;
    const off = k < 1 ? 26 * (1 - k) + 7 : 7;
    if (l.hl) {
      const w = fitWidth(l.s, s);
      const grow = easeOut(range(f, l.at + 2, l.at + 7));
      rect('yellow', W / 2 - w / 2 - 22, cy - s * 0.52, (w + 44) * grow, s * 1.0, { rot: -0.02 });
    }
    if (shadow) text(shadow, l.s, W / 2 + off, cy + off, s, { scale: sc });
    text('blue', l.s, W / 2, cy, s, { scale: sc });
  });
}
function fitWidth(str, size) {
  const g = ctx('blue');
  g.font = font(size); g.letterSpacing = `${-0.02 * size}px`;
  return g.measureText(str).width;
}

// diagonal print-wipe between sections
function wipe(f, at) {
  const k = range(f, at - 3, at + 3);
  if (k <= 0 || k >= 1) return;
  const x = -1400 + k * 2800;
  withCtx('pink', (g) => {
    g.fillStyle = SOLID;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 520, 0); g.lineTo(x + 520 - 700, H); g.lineTo(x - 700, H); g.closePath(); g.fill();
  });
  withCtx('yellow', (g) => {
    g.fillStyle = SOLID;
    g.beginPath(); g.moveTo(x + 560, 0); g.lineTo(x + 640, 0); g.lineTo(x + 640 - 700, H); g.lineTo(x + 560 - 700, H); g.closePath(); g.fill();
  });
}

// ------------------------------------------------------------------ montage pieces
function dial(f, cx, cy, r, rot) {
  withCtx('blue', (g) => {
    g.translate(cx, cy); g.rotate(rot);
    g.strokeStyle = SOLID;
    g.lineWidth = 14; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 6; g.beginPath(); g.arc(0, 0, r * 0.62, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 40; i++) {
      const a = i / 40 * Math.PI * 2;
      const l = i % 4 === 0 ? 46 : 20;
      g.lineWidth = i % 4 === 0 ? 8 : 4;
      g.beginPath(); g.moveTo(Math.sin(a) * (r - 14), -Math.cos(a) * (r - 14)); g.lineTo(Math.sin(a) * (r - 14 - l), -Math.cos(a) * (r - 14 - l)); g.stroke();
    }
    g.font = font(54, 800); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = SOLID;
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      g.save(); g.translate(Math.sin(a) * (r - 112), -Math.cos(a) * (r - 112)); g.rotate(a); g.fillText(String(i), 0, 0); g.restore();
    }
  });
  // halftone body of the dial in pink
  withCtx('pink', (g) => {
    const grd = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    grd.addColorStop(0, tone(0.75)); grd.addColorStop(1, tone(0.12));
    g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  });
}

function marquee(f, y, dir, word) {
  const unit = `${word} · `;
  const size = 96;
  const g = ctx('pink');
  g.font = font(size); g.letterSpacing = `${-0.02 * size}px`;
  const uw = g.measureText(unit).width;
  const shift = ((f * 9 * dir) % uw + uw) % uw;
  for (let x = -uw + shift - uw; x < W + uw; x += uw) text('pink', unit, x, y, size, { align: 'left' });
}

function magnifier(f, x, y, r) {
  withCtx('yellow', (g) => { g.fillStyle = SOLID; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });
  withCtx('blue', (g) => {
    g.strokeStyle = SOLID; g.lineWidth = 18; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    g.lineCap = 'round'; g.lineWidth = 34; g.beginPath(); g.moveTo(x + r * 0.72, y + r * 0.72); g.lineTo(x + r * 1.45, y + r * 1.45); g.stroke();
  });
}

function keyhole(g, cx, cy, s) {
  g.beginPath();
  g.arc(cx, cy - 40 * s, 70 * s, 0, Math.PI * 2);
  g.moveTo(cx - 34 * s, cy);
  g.lineTo(cx + 34 * s, cy);
  g.lineTo(cx + 62 * s, cy + 190 * s);
  g.lineTo(cx - 62 * s, cy + 190 * s);
  g.closePath();
}

// ------------------------------------------------------------------ hidden frame
function hiddenFrame(F, slot, digit) {
  rect('pink', 0, 0, W, H);
  frameCounter(F, true);
  text('blue', `ЦИФРА ${slot} ОТ 4`, W / 2, 520, 64, { weight: 800, fam: MONO, ls: 0.06 });
  text('yellow', digit, W / 2 + 18, 950 + 18, 760);
  text('blue', digit, W / 2, 950, 760);
  slotBar(0, 0, { active: slot, digit, onFlash: true });
}

// ------------------------------------------------------------------ frame
function drawIntro(F) {
  frameCounter(F, false);
  // a padlock slams in while the "level" loads; nothing here is needed for the puzzle
  const k = F / 5;
  const sc = k < 1 ? 1.5 - 0.5 * easeOut(k) : 1;
  const wob = F > 8 ? Math.sin(F * 0.9) * 0.06 * Math.exp(-(F - 8) / 14) : 0;
  withCtx('pink', (g) => { const grd = g.createRadialGradient(540, 900, 0, 540, 900, 420); grd.addColorStop(0, tone(0.7)); grd.addColorStop(1, tone(0.0)); g.fillStyle = grd; g.fillRect(0, 400, W, 1000); });
  withCtx('blue', (g) => {
    g.translate(540, 900); g.rotate(wob); g.scale(sc, sc);
    g.strokeStyle = SOLID; g.lineWidth = 46; g.beginPath(); g.arc(0, -150, 120, Math.PI, 0); g.lineTo(120, -40); g.moveTo(-120, -150); g.lineTo(-120, -40); g.stroke();
    g.fillStyle = SOLID; g.beginPath(); g.roundRect(-200, -60, 400, 300, 34); g.fill();
  });
  withCtx('yellow', (g) => { g.translate(540, 900); g.rotate(wob); g.scale(sc, sc); g.fillStyle = SOLID; g.beginPath(); g.arc(0, 60, 40, 0, Math.PI * 2); g.fill(); g.fillRect(-16, 70, 32, 90); });
  text('blue', 'ЗАРЕЖДАНЕ', W / 2, 1300, 40, { weight: 800, fam: MONO, ls: 0.3 });
  const p = range(F, 2, 42);
  withCtx('blue', (g) => { g.strokeStyle = SOLID; g.lineWidth = 7; g.strokeRect(190, 1352, 700, 44); });
  rect('yellow', 198, 1360, 684 * p, 28);
  text('blue', `${Math.round(p * 100)}%`, W / 2, 1450, 40, { weight: 800, fam: MONO });
}

function drawFrame(F) {
  clearAll();
  if (F < INTRO) { drawIntro(F); return; }
  const f = Math.min(F - INTRO, MAIN - 1 + (F - INTRO >= MAIN ? 1 : 0)); // puzzle frame (>= MAIN during the hold)
  if (HIDDEN[f]) { hiddenFrame(F, ...HIDDEN[f]); return; }
  const B = (n) => Math.round(n * BEAT); // beat -> frame
  frameCounter(F, false);

  // A — hook (beats 0-5)
  if (f < 72) {
    block(f, [
      { s: 'ЗАКЛЮЧЕНИ', at: 1 },
      { s: 'СТЕ В ТОВА', at: B(1) },
      { s: 'ВИДЕО.', at: B(2), hl: true },
    ], 900);
  }
  // B — the exit is a code
  else if (f < 141) {
    block(f, [
      { s: 'ИЗХОДЪТ Е', at: 72 },
      { s: 'КОД ОТ', at: 86 },
      { s: '4 ЦИФРИ.', at: 100, hl: true },
    ], 860);
  }
  // C — one frame each, pause
  else if (f < 211) {
    block(f, [
      { s: 'ВСЯКА ЦИФРА', at: 141 },
      { s: 'Е ТУК САМО', at: 155 },
      { s: '1 КАДЪР.', at: 169, hl: true },
    ], 790);
    if (f >= 183) {
      const k = (f - 183) / 5;
      const sc = k < 1 ? 1.8 - 0.8 * easeOut(k) : 1;
      withCtx('yellow', (g) => { g.translate(540, 1110); g.rotate(-0.07); g.scale(sc, sc); g.fillStyle = SOLID; g.fillRect(-380, -74, 760, 148); });
      text('blue', 'ПАУЗИРАЙ.', 540, 1112, fitSize('ПАУЗИРАЙ.', 680, 96), { rot: -0.07, scale: sc });
    }
  }
  // D1 — dial + magnifier + marquee (search)
  else if (f < 261) {
    const lt = f - 211;
    marquee(f, 455, 1, 'ТЪРСИ');
    marquee(f, 1190, -1, 'ТЪРСИ');
    dial(f, 540, 820, 300 * backOut(range(lt, 0, 8), 1.6), lt * 0.06 + Math.sin(lt * 0.2) * 0.4);
    const mx = 540 + Math.sin(lt * 0.17) * 260, my = 800 + Math.cos(lt * 0.23) * 220;
    magnifier(f, mx, my, 120);
  }
  // D2 — decoy: the code from the first video, crossed out
  else if (f < 291) {
    const lt = f - 261;
    const sc = lt < 5 ? 1.4 - 0.4 * easeOut(lt / 5) : 1;
    text('pink', '4718', 548, 808, 330, { scale: sc });
    text('blue', '4718', 540, 800, 330, { scale: sc });
    const strike = easeOut(range(lt, 6, 11));
    rect('pink', 80, 780, 920 * strike, 46, { rot: -0.12, cx: 540, cy: 800 });
    if (lt >= 12) {
      const k = (lt - 12) / 4;
      const s2 = k < 1 ? 1.7 - 0.7 * easeOut(k) : 1;
      withCtx('yellow', (g) => { g.translate(540, 1060); g.rotate(0.05); g.scale(s2, s2); g.fillStyle = SOLID; g.fillRect(-360, -70, 720, 140); });
      text('blue', 'НЕ Е ТОЗИ.', 540, 1062, fitSize('НЕ Е ТОЗИ.', 640, 84), { rot: 0.05, scale: s2 });
    }
  }
  // D3 — keyhole tunnel
  else if (f < 324) {
    const lt = f - 291;
    for (let i = 0; i < 9; i++) {
      const r = ((i * 120 + lt * 22) % 1080);
      withCtx('pink', (g) => { g.strokeStyle = tone(0.6); g.lineWidth = 50; g.beginPath(); g.arc(540, 820, r, 0, Math.PI * 2); g.stroke(); });
    }
    const s = 0.8 + Math.pow(lt / 32, 3) * 14;
    withCtx('blue', (g) => { g.fillStyle = SOLID; keyhole(g, 540, 800, s); g.fill(); });
    withCtx('yellow', (g) => { g.fillStyle = SOLID; keyhole(g, 540, 800, s * 0.55); g.fill(); });
  }
  // E — the hint
  else if (f < 379) {
    block(f, [
      { s: 'КОДЪТ Е', at: 324 },
      { s: 'ДЕНЯТ, В КОЙТО', at: 338 },
      { s: 'ЗАПОЧВА', at: 352 },
      { s: 'ВСИЧКО.', at: 362, hl: true },
    ], 840, { maxSize: 170 });
  }
  // F — the loop clue
  else if (f < 421) {
    block(f, [
      { s: 'ПОСЛЕДНАТА', at: 379 },
      { s: 'ЦИФРА Е ТАМ,', at: 386 },
      { s: 'ОТКЪДЕТО', at: 393 },
      { s: 'ЗАПОЧНА.', at: 400, hl: true },
    ], 840, { maxSize: 170 });
  }
  // G — final card: call to action, our logos, partners (logos are a DOM overlay,
  // composited untouched on top of the print effect); held until the end
  else {
    block(f, [
      { s: 'ПИШИ КОДА', at: 421 },
      { s: 'В КОМЕНТАРИТЕ.', at: 428, hl: true },
    ], 520, { maxSize: 140 });
    text('blue', 'КВАЛИФИКАЦИИ · 5 ГРАДА', W / 2, 850, 32, { weight: 700, fam: MONO, ls: 0.12 });
    if (f >= 432) {
      text('blue', 'ПАРТНЬОРИ', W / 2, 922, 30, { weight: 800, fam: MONO, ls: 0.3 });
      rect('blue', 64, 950, 952 * easeOut(range(f, 432, 440)), 4);
    }
  }

  // the code bar stays from beat 2 of section B until the final card (not over the montage)
  if (f >= 100 && f < 421 && !(f >= 211 && f < 324)) slotBar(f, 100);

  for (const at of [72, 141, 211, 261, 291, 324, 379, 421]) wipe(f, at);
}

// ------------------------------------------------------------------ boot
const out = document.getElementById('out');
const riso = new Riso(out);
const logos = document.getElementById('logos');
const partnerTiles = [];

async function boot() {
  const faces = ['900 50px "Unbounded"', '800 50px "Unbounded"', '700 50px "JetBrains Mono"', '800 50px "JetBrains Mono"'];
  await Promise.all(faces.map((x) => document.fonts.load(x, 'АБВЪЬЮЯ 0123')));
  await document.fonts.ready;
  for (const x of faces) if (!document.fonts.check(x, 'Ъ')) throw new Error('font missing ' + x);
  // partner logos: assets/partners/partners.json lists [{ name, file }] in display order
  const plist = await (await fetch('../assets/partners/partners.json')).json();
  const grid = document.getElementById('partners');
  for (const p of plist) {
    const tile = document.createElement('div');
    tile.className = p.dark ? 'tile dark' : 'tile';
    if (p.file) { const im = document.createElement('img'); im.src = `../assets/partners/${p.file}`; im.alt = p.name; tile.appendChild(im); }
    else { tile.classList.add('missing'); tile.textContent = p.name; }
    grid.appendChild(tile);
    partnerTiles.push(tile);
  }
  await Promise.all([...document.images].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = r; }))));
  window.__frame = async (F) => {
    drawFrame(F);
    const f = F - INTRO;
    const hidden = f >= 0 && HIDDEN[f];
    // misregistration: constant offset + a small jump on every beat (frozen during the final hold)
    const beat = Math.floor(Math.min(F, INTRO + 440) / BEAT);
    const j = (s) => (hash(beat * 7 + s) - 0.5) * 6;
    const offsets = { blue: [0, 0], pink: [5 + j(1), -3 + j(2)], yellow: [-4 + j(3), 4 + j(4)] };
    if (hidden) offsets.pink = [0, 0];
    riso.draw(layers, offsets, Math.min(F, INTRO + 445));
    logos.style.opacity = f >= 424 ? Math.min(1, (f - 424) / 4) : 0;
    partnerTiles.forEach((el, i) => {
      const k = range(f, 434 + i * 2, 440 + i * 2);
      el.style.opacity = k;
      el.style.transform = `scale(${0.6 + 0.4 * backOut(k, 1.8)})`;
    });
    await new Promise((r) => requestAnimationFrame(() => r()));
  };
  window.__ready = true;
}
boot().catch((e) => { window.__error = String(e.stack || e); });
