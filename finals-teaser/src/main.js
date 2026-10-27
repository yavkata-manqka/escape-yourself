// Frame driver for the finals teaser. window.__frame(f) sets the whole page to frame f.
import { Scene3D, CITIES, clamp, range, easeOut, easeIn, backOut } from './scene.js';
import { FPS, DURATION, T } from './timeline.js';

const $ = (s) => document.querySelector(s);
const set = (el, op, tf = '') => { el.style.opacity = op; el.style.transform = tf; };
function hash(n) { let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; }

// a text block that rises in, glints once, holds, then fades
function showBlock(el, t, t0, t1, { rise = 60, scaleFrom = 1.12 } = {}) {
  const a = range(t, t0, t0 + 0.45), b = 1 - range(t, t1 - 0.35, t1);
  const k = easeOut(a);
  set(el, Math.min(k, b), `translateY(${(1 - k) * rise}px) scale(${scaleFrom - (scaleFrom - 1) * k})`);
  el.style.setProperty('--shine', range(t, t0 + 0.2, t0 + 1.3).toFixed(3));
  el.querySelectorAll('.gold').forEach((g) => g.style.setProperty('--shine', range(t, t0 + 0.2, t0 + 1.3).toFixed(3)));
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
  // layout: partners grid under the label, escape partners below (hidden when there are none)
  const rows = (n) => Math.ceil(n / 4);
  const plabels = document.querySelectorAll('#end .plabel');
  plabels[0].style.top = '640px';
  const g2top = 690 + rows(n1) * 126 + 40;
  plabels[1].style.top = `${g2top}px`;
  document.getElementById('escape-partners').style.top = `${g2top + 50}px`;
  if (!n2) { plabels[1].style.display = 'none'; }
}

async function main() {
  await loadFonts();
  await partners();
  await Promise.all([...document.images].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = r; im.onerror = r; }))));
  const s3d = new Scene3D($('#gl'));
  await s3d.loadMap();
  const cityEls = CITIES.map((c) => { const d = document.createElement('div'); d.className = 'city'; d.textContent = c.name; $('#cities').appendChild(d); return d; });
  const tiles = [...document.querySelectorAll('.tile')];

  window.__frame = async (f) => {
    const t = f / FPS;
    const canvas = $('#gl');
    if (t < T.endCard + 0.3) s3d.render(t);

    // 1. title
    showBlock($('#t1'), t, T.title1, 2.9);

    // city labels follow their city on screen
    const pos = s3d.cityScreen();
    cityEls.forEach((el, i) => {
      const ta = T.teams + i * 0.6;
      const k = backOut(range(t, ta + 0.05, ta + 0.35), 2);
      const out = 1 - range(t, 7.4, 7.8);
      el.style.left = `${pos[i][0]}px`; el.style.top = `${pos[i][1] - 34}px`;
      el.style.opacity = clamp(k) * out;
      el.style.transform = `translate(-50%, -100%) scale(${0.7 + 0.3 * k})`;
    });

    // 2. counters
    document.querySelectorAll('.stat').forEach((el, i) => {
      const t0 = [T.counter1, T.counter2, T.counter3][i];
      const k = easeOut(range(t, t0, t0 + 0.4));
      set(el, Math.min(k, 1 - range(t, 7.4, 7.8)), `translateY(${(1 - k) * 50}px)`);
      const num = el.querySelector('.num');
      const to = +num.dataset.to;
      const v = Math.round(to * easeOut(range(t, t0, t0 + 1.2)));
      num.textContent = `${v}${v === to ? (num.dataset.suffix || '') : ''}`;
      num.style.setProperty('--shine', range(t, t0 + 1.0, t0 + 1.9).toFixed(3));
    });

    // 3. the cut
    showBlock($('#cut'), t, T.cutText, 12.9);
    const remainEl = $('#remain');
    const left = [52, 38, 24, 14, 8];
    let w = -1; T.waves.slice(0, 4).forEach((tw, i) => { if (t >= tw) w = i; });
    const n = left[w + 1];
    const kr = easeOut(range(t, 9.3, 9.6));
    set(remainEl, Math.min(kr, 1 - range(t, 12.7, 13.0)), `scale(${1 + (w >= 0 ? 0.18 * Math.exp(-(t - T.waves[w]) * 6) : 0)})`);
    remainEl.querySelector('.num').textContent = n;
    remainEl.querySelector('.num').style.setProperty('--shine', w >= 0 ? range(t, T.waves[w], T.waves[w] + 0.6).toFixed(3) : '-1');

    // 4. the strongest
    showBlock($('#strong'), t, T.strongest, 18.4);

    // 5. final hit: flash + title
    const fl = t >= T.finalHit ? Math.exp(-(t - T.finalHit) * 3.2) : 0;
    $('#flash').style.opacity = fl;
    const fin = $('#final');
    const kf = range(t, T.finalHit, T.finalHit + 0.25);
    set(fin, Math.min(1, kf * 2) * (1 - range(t, 22.9, 23.3)), `scale(${1.35 - 0.35 * easeOut(kf) + 0.04 * range(t, T.finalHit, 23.3)})`);
    fin.querySelectorAll('.gold').forEach((g) => g.style.setProperty('--shine', range(t, T.finalHit + 0.3, T.finalHit + 1.6).toFixed(3)));
    // impact shake on the hit
    const sh = t >= T.finalHit && t < T.finalHit + 0.5 ? 18 * Math.exp(-(t - T.finalHit) * 8) : 0;
    const fr = Math.floor(t * 30);
    $('#stage').style.transform = sh ? `translate(${(hash(fr) - 0.5) * 2 * sh}px, ${(hash(fr + 7) - 0.5) * 2 * sh}px)` : '';

    // 6. call to action: blur the 3D behind, notification drops in
    const kc = easeOut(range(t, T.cta, T.cta + 0.5));
    canvas.style.filter = kc > 0 ? `blur(${kc * 16}px) brightness(${1 - 0.62 * kc})` : 'none';
    const cta = $('#cta');
    cta.style.opacity = Math.min(kc, 1 - range(t, T.endCard - 0.25, T.endCard));
    const kn = backOut(range(t, T.cta + 0.15, T.cta + 0.6), 1.4);
    $('#notif').style.transform = `translateY(${(1 - kn) * -260}px)`;
    $('#notif').style.opacity = clamp(kn);
    // order follows the voice: "до 29.10" first, then "СЛЕДИ ИМЕЙЛА СИ.", then the spam hint
    const kw = easeOut(range(t, T.ctaWhen, T.ctaWhen + 0.4));
    set($('#when'), kw, `translateY(${(1 - kw) * 30}px)`);
    showBlock($('#follow'), t, T.ctaFollow, 40);
    const ks = easeOut(range(t, T.ctaSpam, T.ctaSpam + 0.4));
    set($('#spam'), ks, `translateY(${(1 - ks) * 30}px)`);

    // 7. end card
    const ke = easeOut(range(t, T.endCard, T.endCard + 0.4));
    $('#end').style.opacity = ke;
    tiles.forEach((el, i) => {
      const k = backOut(range(t, T.endCard + 0.3 + i * 0.05, T.endCard + 0.6 + i * 0.05), 1.6);
      el.style.opacity = clamp(k);
      el.style.transform = `scale(${0.7 + 0.3 * k})`;
    });

    await new Promise((r) => requestAnimationFrame(() => r()));
  };
  window.__total = Math.round(DURATION * FPS);
  window.__ready = true;
}
main().catch((e) => { console.error(e); window.__error = String(e.stack || e); });
