// Frame driver for the finals teaser. window.__frame(f) sets the whole page to frame f.
import { Scene3D, CITIES, clamp, range, easeOut, easeInOut, backOut } from './scene.js';
import { FPS, DURATION, T } from './timeline.js';

const $ = (s) => document.querySelector(s);
const set = (el, op, tf = '') => { el.style.opacity = op; el.style.transform = tf; };
function hash(n) { let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; }

// a text block that slams in (fast scale-down), glints once, holds, then fades
function slamBlock(el, t, t0, t1, { from = 1.35 } = {}) {
  const a = range(t, t0, t0 + 0.18), b = 1 - range(t, t1 - 0.2, t1);
  const k = easeOut(a);
  set(el, Math.min(clamp(a * 2), b), `scale(${from - (from - 1) * k})`);
  el.querySelectorAll('.gold').forEach((g) => g.style.setProperty('--shine', range(t, t0 + 0.1, t0 + 0.9).toFixed(3)));
}

async function loadFonts() {
  const faces = ['700 40px Oswald', '600 40px Oswald', '800 40px Manrope', '500 40px Manrope', '700 40px Manrope'];
  await Promise.all(faces.map((f) => document.fonts.load(f, 'АБВЪЬЮЯ 0123?')));
  await document.fonts.ready;
  for (const f of faces) if (!document.fonts.check(f, 'Ъ')) throw new Error('font missing ' + f);
}

async function partners() {
  const fill = async (id, json, cls = 'tile') => {
    let list = [];
    try { list = await (await fetch(json)).json(); } catch { list = []; }
    const grid = document.getElementById(id);
    for (const p of list) {
      const tile = document.createElement('div'); tile.className = cls;
      const im = document.createElement('img'); im.src = p.file; im.alt = p.name; tile.appendChild(im);
      grid.appendChild(tile);
    }
    return list.length;
  };
  const n1 = await fill('partners', '../assets/partners/partners.json');
  const n2 = await fill('escape-partners', '../assets/escape-partners/partners.json', 'tile dark');
  const rows = (n) => Math.ceil(n / 4);
  const plabels = document.querySelectorAll('#end .plabel');
  plabels[0].style.top = '640px';
  const g2top = 690 + rows(n1) * 126 + 40;
  plabels[1].style.top = `${g2top}px`;
  document.getElementById('escape-partners').style.top = `${g2top + 50}px`;
  if (!n2) plabels[1].style.display = 'none';
}

// ------------------------------------------------------------------ "на косъм" race lanes
const FINISH = 820;
const RACES = [
  // [start, per-lane durations]
  [T.race1, [1.75, 1.78, 1.95, 2.02, 1.9, 2.1]],   // two lanes finish almost together
  [T.race2, [2.3, 2.45, 2.2, 1.0, 2.6, 2.35]],     // one lane wins by far
  [T.much, [0.62, 0.63, 0.64, 0.62, 0.65, 0.63]],  // everyone within a hair
];
function buildLanes() {
  const box = $('#lanes');
  box.innerHTML = '<div id="finish"></div><div id="hairline"></div>';
  for (let i = 0; i < 6; i++) {
    const l = document.createElement('div'); l.className = 'lane'; l.style.top = `${i * 92}px`;
    l.innerHTML = '<div class="track"></div><div class="trail"></div><div class="head"></div>';
    box.appendChild(l);
  }
}
function updateRace(t) {
  let r = RACES[0];
  for (const rc of RACES) if (t >= rc[0]) r = rc;
  const [t0, durs] = r;
  const lanes = document.querySelectorAll('.lane');
  let lead = -1, second = -1;
  lanes.forEach((l, i) => {
    const k = easeInOut(range(t, t0, t0 + durs[i]));
    const x = FINISH * k;
    l.querySelector('.trail').style.width = `${x}px`;
    l.querySelector('.head').style.left = `${x}px`;
    l.querySelector('.head').style.opacity = t >= t0 ? 1 : 0;
  });
  // the "hair": a bright line on the finish when the closest pair crosses
  const hl = $('#hairline');
  let flash = 0;
  if (r === RACES[0]) flash = Math.exp(-Math.max(0, t - (t0 + 1.78)) * 3) * (t >= t0 + 1.74 ? 1 : 0);
  if (r === RACES[2]) flash = t >= t0 + 0.62 ? 1 : 0;
  hl.style.opacity = flash;
  hl.style.top = r === RACES[0] ? '0px' : '-20px';
  hl.style.height = r === RACES[0] ? '184px' : '592px';
}

// ------------------------------------------------------------------ main
async function main() {
  await loadFonts();
  await partners();
  buildLanes();
  await Promise.all([...document.images].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = r; im.onerror = r; }))));
  const s3d = new Scene3D($('#gl'));
  await s3d.loadMap();
  const cityEls = CITIES.map((c) => { const d = document.createElement('div'); d.className = 'city'; d.textContent = c.name; $('#cities').appendChild(d); return d; });
  const tiles = [...document.querySelectorAll('.tile')];
  const statT = [T.stat1, T.stat2, T.stat3, T.stat4];

  window.__frame = async (f) => {
    const t = f / FPS;
    const canvas = $('#gl');
    if (t < T.endCard + 0.3) s3d.render(t);

    // 1. scale
    slamBlock($('#t1'), t, 0.15, T.rise + 0.1, { from: 1.15 });
    const pos = s3d.cityScreen();
    cityEls.forEach((el, i) => {
      const ta = T.stat3 + i * 0.08; // city names pop on "Пет града"
      const k = backOut(range(t, ta, ta + 0.25), 2);
      el.style.left = `${pos[i][0]}px`; el.style.top = `${pos[i][1] - 34}px`;
      el.style.opacity = clamp(k) * (1 - range(t, T.rise, T.rise + 0.3));
      el.style.transform = `translate(-50%, -100%) scale(${0.7 + 0.3 * k})`;
    });
    document.querySelectorAll('.stat').forEach((el, i) => {
      const t0 = statT[i];
      const k = range(t, t0, t0 + 0.16);
      set(el, Math.min(clamp(k * 2), 1 - range(t, T.rise, T.rise + 0.3)), `scale(${1.5 - 0.5 * easeOut(k)})`);
      const num = el.querySelector('.num');
      const to = +num.dataset.to;
      const v = Math.round(to * easeOut(range(t, t0, t0 + 0.5)));
      num.textContent = `${v}${v === to ? (num.dataset.suffix || '') : ''}`;
      num.style.setProperty('--shine', range(t, t0 + 0.3, t0 + 1.1).toFixed(3));
    });

    // 2. "на косъм"
    const raceOn = range(t, T.race1 - 0.2, T.race1 + 0.05) * (1 - range(t, T.cutText - 0.3, T.cutText));
    $('#race').style.opacity = raceOn;
    if (raceOn > 0) updateRace(t);
    slamBlock($('#r-seconds'), t, T.race1 + 0.6, T.race2);
    slamBlock($('#r-clear'), t, T.race2 + 0.65, T.much);
    slamBlock($('#r-much'), t, T.much, T.cutText);
    slamBlock($('#r-hair'), t, T.hair, T.cutText, { from: 1.6 });

    // 3. the cut
    slamBlock($('#cut'), t, T.cutText, T.lineup);
    const remainEl = $('#remain');
    const left = [52, 38, 24, 14, 8];
    let w = -1; T.waves.slice(0, 4).forEach((tw, i) => { if (t >= tw) w = i; });
    set(remainEl, Math.min(range(t, T.cutText, T.cutText + 0.2), 1 - range(t, T.lineup - 0.2, T.lineup)),
      `scale(${1 + (w >= 0 ? 0.2 * Math.exp(-(t - T.waves[w]) * 7) : 0)})`);
    remainEl.querySelector('.num').textContent = left[w + 1];

    // 4. "Едно е сигурно — оспорван до последната секунда"
    slamBlock($('#sure'), t, T.sure, T.flythrough, { from: 1.1 });
    slamBlock($('#contested'), t, T.contested, T.flythrough);

    // 5. final
    $('#flash').style.opacity = t >= T.finalHit ? Math.exp(-(t - T.finalHit) * 3.2) : 0;
    const fin = $('#final');
    const kf = range(t, T.finalHit, T.finalHit + 0.22);
    set(fin, Math.min(1, kf * 2) * (1 - range(t, T.cta - 0.3, T.cta)), `scale(${1.35 - 0.35 * easeOut(kf) + 0.03 * range(t, T.finalHit, T.cta)})`);
    fin.querySelectorAll('.gold').forEach((g) => g.style.setProperty('--shine', range(t, T.finalHit + 0.3, T.finalHit + 1.4).toFixed(3)));
    const sub = fin.querySelector('.sub');
    sub.style.opacity = range(t, 16.55, 16.8); // "Седми ноември. София."
    const fr = Math.floor(t * 30);
    const hits = [T.finalHit, ...T.waves.slice(0, 4), T.hair];
    let sh = 0; for (const h of hits) if (t >= h && t < h + 0.4) sh = Math.max(sh, (h === T.finalHit ? 18 : 9) * Math.exp(-(t - h) * 9));
    $('#stage').style.transform = sh ? `translate(${(hash(fr) - 0.5) * 2 * sh}px, ${(hash(fr + 7) - 0.5) * 2 * sh}px)` : '';

    // 6. call to action
    const kc = easeOut(range(t, T.cta, T.cta + 0.4));
    canvas.style.filter = kc > 0 ? `blur(${kc * 16}px) brightness(${1 - 0.62 * kc})` : 'none';
    $('#cta').style.opacity = Math.min(kc, 1 - range(t, T.endCard - 0.2, T.endCard));
    const kn = backOut(range(t, T.cta + 0.05, T.cta + 0.45), 1.4);
    $('#notif').style.transform = `translateY(${(1 - kn) * -260}px)`;
    $('#notif').style.opacity = clamp(kn);
    const kw = easeOut(range(t, T.ctaWhen, T.ctaWhen + 0.3));
    set($('#when'), kw, `translateY(${(1 - kw) * 30}px)`);
    slamBlock($('#follow'), t, T.ctaFollow, 99);
    const ks = easeOut(range(t, T.ctaSpam, T.ctaSpam + 0.3));
    set($('#spam'), ks, `translateY(${(1 - ks) * 30}px)`);

    // 7. end card
    $('#end').style.opacity = easeOut(range(t, T.endCard, T.endCard + 0.35));
    tiles.forEach((el, i) => {
      const k = backOut(range(t, T.endCard + 0.2 + i * 0.04, T.endCard + 0.5 + i * 0.04), 1.6);
      el.style.opacity = clamp(k);
      el.style.transform = `scale(${0.7 + 0.3 * k})`;
    });

    await new Promise((r) => requestAnimationFrame(() => r()));
  };
  window.__total = Math.round(DURATION * FPS);
  window.__ready = true;
}
main().catch((e) => { console.error(e); window.__error = String(e.stack || e); });
