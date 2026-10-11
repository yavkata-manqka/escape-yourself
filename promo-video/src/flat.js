// Branded flat sections: boot screen (0-2s), character select (2-5s), city select (5-8s).
// Everything is a paused GSAP timeline that main.js seeks frame by frame,
// plus a few pure functions of time for blinking and jitter.
import { CHARACTERS } from './characters.js';
import { hash1, range, easeInExpo, clamp } from './util.js';

const $ = (sel, root = document) => root.querySelector(sel);
export const CURSOR_SVG = `<svg viewBox="0 0 32 38" width="64" height="76"><path d="M3 2 L3 31 L10.5 24.5 L15.5 35.5 L21 33 L16 22.5 L26 22 Z" fill="#161514" stroke="#ECE7DB" stroke-width="2.4" stroke-linejoin="round"/></svg>`;

export function grainURL() {
  const c = document.createElement('canvas');
  c.width = c.height = 540;
  const g = c.getContext('2d');
  const img = g.createImageData(540, 540);
  let s = 12345;
  for (let i = 0; i < img.data.length; i += 4) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const n = 205 + ((s >> 8) % 51);
    img.data[i] = n; img.data[i + 1] = n - 3; img.data[i + 2] = n - 8; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // a few soft fibres
  g.globalAlpha = 0.05;
  for (let i = 0; i < 160; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const x = s % 540, y = (s >> 10) % 540;
    g.strokeStyle = i % 2 ? '#7a6f5c' : '#ffffff';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + ((s >> 4) % 30) - 15, y + ((s >> 6) % 30) - 15); g.stroke();
  }
  return c.toDataURL('image/png');
}

function header() {
  return `
    <img class="hdr-logo" src="../assets/logo.png" alt="">
    <div class="rule hdr-rule" style="top:404px"></div>`;
}

function footer() {
  return `
    <div class="rule ftr-rule" style="top:1468px"></div>
    <div class="footer"><img class="usyc-logo" src="../assets/usyc-logo.png" alt=""></div>`;
}

export function buildFlat(root, grain) {
  root.innerHTML = `
  <section class="screen" id="boot">
    <div class="grain" style="background-image:url(${grain})"></div>
    <div class="bracket" style="left:120px;top:520px;border-left-width:6px;border-top-width:6px"></div>
    <div class="bracket" style="right:120px;top:520px;border-right-width:6px;border-top-width:6px"></div>
    <div class="bracket" style="left:120px;top:1370px;border-left-width:6px;border-bottom-width:6px"></div>
    <div class="bracket" style="right:120px;top:1370px;border-right-width:6px;border-bottom-width:6px"></div>
    <img id="boot-logo" src="../assets/logo.png" alt="">
    <div id="boot-press"><span>НАТИСНИ START</span></div>
    <div id="boot-bar"><i></i></div>
    <div class="glitch-bars"></div>
  </section>

  <section class="screen" id="chars">
    <div class="grain" style="background-image:url(${grain})"></div>
    ${header()}
    <div class="title big-title" id="chars-title" style="top:446px">ИЗБЕРИ ГЕРОЙ</div>
    <div class="serif sub" id="chars-sub" style="top:610px">Отбор от <span class="hl">четирима</span>.</div>
    <div class="chars">${CHARACTERS.map((c, i) => `<div class="char" id="ch-${c.id}" data-i="${i}"><svg viewBox="0 0 248 400">${c.svg}</svg></div>`).join('')}</div>
    <div class="card" id="info">
      ${CHARACTERS.map((c, i) => `
      <div class="slot" id="info-${i}">
        <div class="label"><span class="dot"></span>ИГРАЧ ${i + 1} / 4</div>
        <div class="name">${c.name}</div>
        <div class="stat"><span class="slabel">${c.stat}</span>
          <span class="bar">${Array.from({ length: 10 }, (_, k) => `<i><b style="width:${clamp((c.value - k * 10) / 10) * 100}%"></b></i>`).join('')}</span>
          <span class="num">${c.value}</span></div>
      </div>`).join('')}
    </div>
    <div id="team-stamp">ОТБОР ОТ 4</div>
    ${footer()}
  </section>

  <section class="screen" id="city">
    <div class="grain" style="background-image:url(${grain})"></div>
    ${header()}
    <div class="title big-title" id="city-title" style="top:446px">ИЗБЕРИ ГРАД</div>
    <div id="map-wrap"><div id="map-zoom"><svg id="map-svg" viewBox="0 0 952 600"></svg></div></div>
    <div class="card" id="city-card">
      <div class="label"><span class="dot"></span>КВАЛИФИКАЦИИ · 2026</div>
      <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-top:18px">
        <div><div class="big" style="font-size:104px">19–25</div><div class="label" style="color:var(--grey);margin-top:10px">ОКТОМВРИ</div></div>
        <div style="text-align:right"><div class="big" style="font-size:104px">5</div><div class="label" style="color:var(--grey);margin-top:10px">ГРАДА</div></div>
      </div>
    </div>
    ${footer()}
    <div class="cursor" id="city-cursor">${CURSOR_SVG}</div>
  </section>`;
}

// shrink huge titles until they fit the 952 px content width
export function fitTitles() {
  document.querySelectorAll('.big-title').forEach((el) => {
    let size = 168;
    el.style.fontSize = `${size}px`;
    while (el.scrollWidth > 952 && size > 60) { size -= 2; el.style.fontSize = `${size}px`; }
  });
}

// --------------------------------------------------------------- Bulgaria map
const CITIES = [
  { name: 'София', lat: 42.70, lon: 23.32, side: 'right' },
  { name: 'Пловдив', lat: 42.15, lon: 24.75, side: 'below' },
  { name: 'Велико Търново', lat: 43.08, lon: 25.63, side: 'above' },
  { name: 'Варна', lat: 43.21, lon: 27.91, side: 'left' },
  { name: 'Бургас', lat: 42.50, lon: 27.47, side: 'left' },
];
export const SELECTED_CITY = 1; // Пловдив

export async function buildMap() {
  const gj = await (await fetch('../assets/data/bulgaria_ne10m.geojson')).json();
  const rings = gj.geometry.type === 'Polygon' ? [gj.geometry.coordinates] : gj.geometry.coordinates;
  // equirectangular projection with cos(lat0) scaling (good for a country this size)
  const lat0 = 42.75, k = Math.cos((lat0 * Math.PI) / 180);
  const P = ([lon, lat]) => [lon * k, -lat];
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  rings.forEach((poly) => poly[0].forEach((pt) => { const [x, y] = P(pt); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }));
  const W = 952, H = 600, pad = 40;
  const s = Math.min((W - 2 * pad) / (maxX - minX), (H - 2 * pad) / (maxY - minY));
  const ox = (W - (maxX - minX) * s) / 2, oy = (H - (maxY - minY) * s) / 2;
  const proj = (pt) => { const [x, y] = P(pt); return [ox + (x - minX) * s, oy + (y - minY) * s]; };
  const d = rings.map((poly) => poly.map((ring) => 'M' + ring.map((pt) => proj(pt).map((v) => v.toFixed(1)).join(' ')).join('L') + 'Z').join('')).join('');
  const svg = $('#map-svg');
  const pins = CITIES.map((c, i) => {
    const [x, y] = proj([c.lon, c.lat]);
    const w = c.name.length * 21 + 40;
    let lx, ly;
    if (c.side === 'right') { lx = 30; ly = -30; } else if (c.side === 'left') { lx = -30 - w; ly = -30; } else if (c.side === 'above') { lx = -w / 2; ly = -132; } else { lx = -w / 2; ly = 26; }
    return `
    <g class="pin" id="pin-${i}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
      <circle class="pulse" r="20" fill="none" stroke="var(--yellow)" stroke-width="6" opacity="0"/>
      <g class="pin-body">
        <ellipse cx="0" cy="2" rx="12" ry="5" fill="rgba(0,0,0,0.35)"/>
        <path d="M0 0 C -6 -14 -26 -30 -26 -50 A26 26 0 1 1 26 -50 C 26 -30 6 -14 0 0 Z" fill="var(--yellow)" stroke="var(--ink)" stroke-width="5"/>
        <circle cx="0" cy="-50" r="9" fill="var(--ink)"/>
      </g>
      <g class="pin-label-g" transform="translate(${lx.toFixed(1)} ${ly.toFixed(1)})">
        <rect class="tag" width="${w}" height="58" rx="10" fill="var(--ink)"/>
        <text class="pin-label" x="${w / 2}" y="41" text-anchor="middle" fill="var(--cream)">${c.name}</text>
      </g>
    </g>`;
  }).join('');
  svg.innerHTML = `
    <path d="${d}" fill="rgba(0,0,0,0.12)" transform="translate(10 14)"/>
    <path id="bg-shape" d="${d}" fill="var(--ink)" stroke="var(--ink)" stroke-width="4" stroke-linejoin="round"/>
    ${pins}`;
  // fix label widths to the real text length
  svg.querySelectorAll('.pin-label-g').forEach((g) => {
    const t = g.querySelector('text'), r = g.querySelector('rect');
    const tw = t.getComputedTextLength() + 44;
    const c = CITIES[+g.parentNode.id.split('-')[1]];
    r.setAttribute('width', tw); t.setAttribute('x', tw / 2);
    let lx, ly;
    if (c.side === 'right') { lx = 30; ly = -84; } else if (c.side === 'left') { lx = -30 - tw; ly = -84; } else if (c.side === 'above') { lx = -tw / 2; ly = -150; } else { lx = -tw / 2; ly = 22; }
    g.setAttribute('transform', `translate(${lx} ${ly})`);
  });
  return CITIES.map((c) => proj([c.lon, c.lat]));
}

// --------------------------------------------------------------- timeline
export function flatTimeline(tl, pinXY) {
  const gsap = window.gsap;
  const ease = 'power3.out', back = 'back.out(2.2)';

  // BOOT ------------------------------------------------------------
  tl.set('#boot', { display: 'block' }, 0);
  tl.fromTo('#boot-logo', { scale: 1.35, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.28, ease: 'back.out(2.6)' }, 0.5);
  tl.fromTo('.bracket', { scale: 1.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease, stagger: 0.03 }, 0.5);
  tl.fromTo('#boot-bar', { opacity: 0 }, { opacity: 1, duration: 0.1 }, 0.75);
  tl.fromTo('#boot-bar i', { width: '0%' }, { width: '100%', duration: 1.0, ease: 'power1.inOut' }, 0.75);
  tl.fromTo('#boot-press', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.2, ease }, 1.0);
  tl.set('#boot-press span', { backgroundColor: '#FFC72C', borderRadius: 10 }, 1.75);
  tl.to('#boot-press span', { scale: 0.92, duration: 0.06, yoyo: true, repeat: 1 }, 1.75);
  tl.set('#boot', { display: 'none' }, 2.0);

  // CHARACTER SELECT ------------------------------------------------
  tl.set('#chars', { display: 'block' }, 2.0);
  tl.fromTo('#chars .hdr-rule, #chars .ftr-rule', { scaleX: 0 }, { scaleX: 1, duration: 0.35, ease }, 2.0);
  tl.fromTo('#chars-title', { scale: 1.5, opacity: 0, rotate: -3 }, { scale: 1, opacity: 1, rotate: 0, duration: 0.22, ease: 'back.out(1.8)', transformOrigin: '0% 50%' }, 2.0);
  tl.fromTo('#chars-sub', { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.25, ease }, 2.12);
  tl.fromTo('#chars-sub .hl', { '--hl': 0 }, { '--hl': 1, duration: 0.3, ease }, 2.2);
  CHARACTERS.forEach((c, i) => {
    tl.fromTo(`#ch-${c.id}`, { y: 160, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'back.out(1.6)' }, 2.1 + i * 0.06);
  });
  tl.fromTo('#info', { y: 60, opacity: 0, rotate: 0 }, { y: 0, opacity: 1, rotate: -1.2, duration: 0.3, ease: 'back.out(1.6)' }, 2.3);
  // highlight each in turn on the beat
  const slots = CHARACTERS.map((_, i) => `#info-${i}`);
  tl.set(slots, { opacity: 0 }, 2.0);
  CHARACTERS.forEach((c, i) => {
    const t0 = 2.5 + i * 0.5;
    const el = `#ch-${c.id}`;
    tl.to(el, { '--skin': '#ECE7DB', '--cloth': '#FFC72C', '--hair': '#161514', '--pants': '#161514', '--cone': 0.3, '--rim': '#FFC72C', duration: 0.08 }, t0);
    tl.fromTo(el, { scale: 1 }, { scale: 1.08, duration: 0.1, ease: 'power2.out', yoyo: true, repeat: 1, transformOrigin: '50% 85%' }, t0);
    if (i < 3) tl.to(el, { '--skin': '#CFC8B8', '--cloth': '#CFC8B8', '--hair': '#9b9486', '--pants': '#9b9486', '--cone': 0, '--rim': '#2a2826', duration: 0.06 }, t0 + 0.5);
    tl.set(slots, { opacity: 0 }, t0);
    tl.fromTo(`#info-${i}`, { opacity: 1, x: 70 }, { x: 0, duration: 0.18, ease }, t0);
    tl.fromTo(`#info-${i} .bar b`, { scaleX: 0 }, { scaleX: 1, transformOrigin: 'left center', duration: 0.3, ease: 'power2.out', stagger: 0.012 }, t0 + 0.04);
    tl.fromTo(`#info-${i} .num`, { scale: 1.6 }, { scale: 1, duration: 0.2, ease: back }, t0 + 0.08);
  });
  // idle animations
  tl.to('#ch-brain .arm-up', { rotate: -10, svgOrigin: '160 174', duration: 0.12, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 2.55);
  tl.to('#ch-brain .glasses', { y: -5, duration: 0.12, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 2.55);
  tl.fromTo('#ch-brain .glint', { opacity: 0 }, { opacity: 1, duration: 0.06, yoyo: true, repeat: 1 }, 2.8);
  tl.to('#ch-leader .headg', { y: -7, duration: 0.12, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 3.05);
  tl.to('#ch-leader .brow', { y: -6, duration: 0.08, yoyo: true, repeat: 1 }, 3.15);
  tl.fromTo('#ch-seeker .torch', { rotate: -10 }, { rotate: 12, svgOrigin: '160 176', duration: 0.24, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 3.5);
  tl.fromTo('#ch-seeker .eyes', { x: -3 }, { x: 5, duration: 0.24, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 3.5);
  tl.fromTo('#ch-panic .drop', { y: 0, opacity: 1 }, { y: -26, x: (i) => [16, -14, 20][i], opacity: 0, duration: 0.36, stagger: 0.1, ease: 'power1.out' }, 4.0);
  tl.to('#ch-panic .bite', { rotate: 3, svgOrigin: '160 176', duration: 0.05, yoyo: true, repeat: 7 }, 4.05);
  // 4.5: the whole team lights up
  tl.to(CHARACTERS.map((c) => `#ch-${c.id}`), { '--skin': '#ECE7DB', '--cloth': '#FFC72C', '--hair': '#161514', '--pants': '#161514', '--cone': 0.3, '--rim': '#FFC72C', duration: 0.06 }, 4.5);
  tl.fromTo(CHARACTERS.map((c) => `#ch-${c.id}`), { y: 0 }, { y: -18, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.out', stagger: 0.04 }, 4.5);
  tl.set(slots, { opacity: 0 }, 4.5);
  tl.fromTo('#team-stamp', { scale: 2.2, opacity: 0, rotate: -12 }, { scale: 1, opacity: 1, rotate: -3, duration: 0.18, ease: 'back.out(2)' }, 4.5);
  tl.set('#chars', { display: 'none' }, 5.0);

  // CITY SELECT -------------------------------------------------------
  tl.set('#city', { display: 'block' }, 5.0);
  tl.fromTo('#city .hdr-rule, #city .ftr-rule', { scaleX: 0 }, { scaleX: 1, duration: 0.35, ease }, 5.0);
  tl.fromTo('#city-title', { scale: 1.5, opacity: 0, rotate: 3 }, { scale: 1, opacity: 1, rotate: 0, duration: 0.22, ease: 'back.out(1.8)', transformOrigin: '0% 50%' }, 5.0);
  tl.fromTo('#bg-shape', { scale: 0.86, opacity: 0, transformOrigin: '50% 50%' }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(1.4)' }, 5.1);
  tl.fromTo('#city-card', { y: 70, opacity: 0, rotate: 0 }, { y: 0, opacity: 1, rotate: 1.2, duration: 0.3, ease: 'back.out(1.6)' }, 5.25);
  for (let i = 0; i < 5; i++) {
    const t0 = 5.5 + i * 0.25;
    tl.fromTo(`#pin-${i} .pin-body`, { scale: 0, y: -60, transformOrigin: '50% 100%' }, { scale: 1, y: 0, duration: 0.24, ease: 'back.out(2.6)' }, t0);
    tl.fromTo(`#pin-${i} .pin-label-g`, { opacity: 0, scale: 0.6, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.18, ease: back }, t0 + 0.05);
    tl.fromTo(`#pin-${i} .pulse`, { attr: { r: 14 }, opacity: 0.9 }, { attr: { r: 60 }, opacity: 0, duration: 0.4, ease: 'power2.out' }, t0 + 0.04);
  }
  // cursor flies to Plovdiv and clicks on the 7.0 beat
  const [px, py] = pinXY[SELECTED_CITY];
  const mapX = 64, mapY = 590;
  const cx = mapX + px + 4, cy = mapY + py - 40;
  tl.fromTo('#city-cursor', { x: 900, y: 1500, opacity: 0 }, { x: cx, y: cy, opacity: 1, duration: 0.45, ease: 'power3.inOut' }, 6.5);
  tl.to('#city-cursor', { scale: 0.82, duration: 0.05, yoyo: true, repeat: 1 }, 6.98);
  const pin = `#pin-${SELECTED_CITY}`;
  tl.to(`${pin} .tag`, { attr: { fill: '#FFC72C' }, duration: 0.01 }, 7.0);
  tl.to(`${pin} .pin-label`, { attr: { fill: '#161514' }, duration: 0.01 }, 7.0);
  tl.fromTo(`${pin} .pin-body`, { scale: 1 }, { scale: 1.35, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out', transformOrigin: '50% 100%' }, 7.0);
  tl.fromTo(`${pin} .pulse`, { attr: { r: 14 }, opacity: 1 }, { attr: { r: 90 }, opacity: 0, duration: 0.45, ease: 'power2.out' }, 7.0);
  // camera zooms into the pin, then cut to black
  tl.set('#map-zoom', { transformOrigin: `${px}px ${py - 50}px` }, 5.0);
  tl.fromTo('#map-zoom', { scale: 1 }, { scale: 14, duration: 0.7, ease: 'power4.in' }, 7.1);
  tl.to(['#city-title', '#city-card', '#city .footer', '#city .hdr-logo', '#city .rule', '#city-cursor'], { opacity: 0, duration: 0.25, ease: 'power2.in' }, 7.3);
  tl.set('#city', { display: 'none' }, 7.8333);
}

// Per-frame procedural details that are not tweens (blinking, flicker, jitter).
export function flatProcedural(t) {
  // boot: console power-on + glitch flicker
  const boot = $('#boot');
  if (t < 2) {
    const f = Math.floor(t * 30);
    const on = t < 0.12 ? 0 : t < 0.3 ? range(t, 0.12, 0.3) : 1;
    boot.style.clipPath = on < 1 ? `inset(${(1 - on) * 50}% 0 ${(1 - on) * 50}% 0)` : 'none';
    let flick = 1;
    if (t >= 0.3 && t < 0.5) flick = hash1(f * 7) < 0.45 ? 0.15 : 1;
    boot.style.opacity = t < 0.12 ? 0 : flick;
    // glitch bars over the cream at power-on
    const bars = boot.querySelector('.glitch-bars');
    let html = '';
    if (t >= 0.12 && t < 0.62) {
      for (let i = 0; i < 6; i++) {
        const h = hash1(f * 31 + i * 7);
        if (h < 0.55) {
          const y = Math.floor(hash1(f * 13 + i) * 1920), hh = 6 + Math.floor(hash1(f * 17 + i) * 60);
          const col = ['#161514', '#FFC72C', '#CFC8B8'][i % 3];
          html += `<div class="glitch-bar" style="top:${y}px;height:${hh}px;background:${col};opacity:${0.5 + 0.5 * hash1(f + i)};transform:translateX(${(hash1(f * 3 + i) - 0.5) * 300}px)"></div>`;
        }
      }
    }
    bars.innerHTML = html;
    // "НАТИСНИ START" blinks on the eighth notes until pressed
    const press = $('#boot-press span');
    if (t >= 1.0 && t < 1.75) press.style.visibility = Math.floor((t - 1.0) / 0.25) % 2 === 0 ? 'visible' : 'hidden';
    else press.style.visibility = 'visible';
  }
  // idle breathing on the characters
  if (t >= 2 && t < 5) {
    document.querySelectorAll('.char').forEach((el, i) => {
      const b = el.querySelector('.body');
      const panic = i === 3 ? (hash1(Math.floor(t * 30) * 5) - 0.5) * 3 : 0;
      b.style.transform = `translate(${panic}px, ${Math.sin((t + i * 0.37) * Math.PI * 2) * 2}px)`;
    });
  }
}
