// Finals reel: kinetic typography cut to the recorded voice. window.__frame(f) sets frame f.
// All timing comes from voice.json (where each spoken sentence/sub-phrase lands).
const FPS = 30;
const $ = (s) => document.querySelector(s);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const range = (x, a, b) => clamp((x - a) / (b - a));
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
const easeIn = (t) => Math.pow(clamp(t), 3);
const backOut = (t, s = 1.9) => { t = clamp(t) - 1; return t * t * ((s + 1) * t + s) + 1; };
function hash(n) { let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; }

// slam: fast scale-down from big, with a tiny overshoot; returns progress
function slam(el, t, t0, { from = 1.6, rot = 0, dy = 0, dur = 0.16 } = {}) {
  if (t < t0) { el.style.opacity = 0; return 0; }
  const k = range(t, t0, t0 + dur);
  const s = k < 1 ? from - (from - 0.97) * easeOut(k) : 0.97 + 0.03 * easeOut(range(t, t0 + dur, t0 + dur + 0.12));
  el.style.opacity = clamp(k * 3);
  el.style.transform = `translateY(${dy * (1 - easeOut(k))}px) rotate(${rot * (1 - k)}deg) scale(${s})`;
  return k;
}
function pop(el, t, t0, { dur = 0.25, from = 0.4 } = {}) {
  const k = backOut(range(t, t0, t0 + dur));
  el.style.opacity = clamp(range(t, t0, t0 + dur * 0.4));
  el.style.transform = `scale(${from + (1 - from) * k})`;
  return k;
}
function highlight(el, t, t0) { el.querySelectorAll('.hl').forEach((h) => h.style.setProperty('--hl', easeOut(range(t, t0, t0 + 0.35)).toFixed(3))); }

function grainURL() {
  const c = document.createElement('canvas'); c.width = c.height = 540;
  const g = c.getContext('2d'); const img = g.createImageData(540, 540);
  let s = 7;
  for (let i = 0; i < img.data.length; i += 4) { s = (s * 1103515245 + 12345) & 0x7fffffff; const n = 200 + ((s >> 8) % 56); img.data[i] = n; img.data[i + 1] = n - 2; img.data[i + 2] = n - 6; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

// rolling number reel ("50+", "200+")
function buildReel(el, text) {
  el.innerHTML = '';
  for (const ch of text) {
    const col = document.createElement('div'); col.className = 'col';
    if (/\d/.test(ch)) { for (let r = 0; r < 3; r++) for (let d = 0; d < 10; d++) col.insertAdjacentHTML('beforeend', `<span>${d}</span>`); col.dataset.target = 20 + +ch; }
    else { col.innerHTML = `<span>${ch}</span>`; col.dataset.plus = '1'; }
    el.appendChild(col);
  }
}
function rollReel(el, t, t0, t1) {
  el.querySelectorAll('.col').forEach((col, i) => {
    if (col.dataset.plus) { const k = range(t, t1, t1 + 0.12); col.style.opacity = k; col.style.transform = `scale(${1.6 - 0.6 * easeOut(k)})`; return; }
    const k = easeOut(range(t, t0 + i * 0.06, t1 + i * 0.06));
    col.style.transform = `translateY(${-280 * (+col.dataset.target) * k}px)`;
  });
}

// ------------------------------------------------------------------ build
const PERSON = '<svg viewBox="0 0 40 62"><circle cx="20" cy="11" r="10" fill="#161514"/><path d="M4 62 V34 Q4 23 20 23 Q36 23 36 34 V62 Z" fill="#161514"/></svg>';
function buildTokens(box, cols, size, gapX, gapY, rows, count, bands) {
  const out = [];
  let k = 0;
  for (const r of rows) for (let c = 0; c < cols && k < count; c++, k++) {
    const d = document.createElement('div'); d.className = 'tok';
    d.style.width = d.style.height = `${size}px`;
    d.style.left = `${c * gapX}px`; d.style.top = `${r}px`;
    const q = size / 92;
    [[22, 22], [52, 22], [22, 52], [52, 52]].forEach(([x, y]) => { const i = document.createElement('i'); i.style.left = `${x * q}px`; i.style.top = `${y * q}px`; i.style.width = i.style.height = `${18 * q}px`; d.appendChild(i); });
    box.appendChild(d); out.push(d);
  }
  return out;
}

async function buildMap() {
  const gj = await (await fetch('../assets/data/bulgaria_ne10m.geojson')).json();
  const ring = (gj.geometry.type === 'Polygon' ? gj.geometry.coordinates : gj.geometry.coordinates[0])[0];
  const k = Math.cos((42.75 * Math.PI) / 180), P = ([lon, lat]) => [lon * k, -lat];
  const pts = ring.map(P);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = Math.min(872 / (maxX - minX), 520 / (maxY - minY));
  const ox = (952 - (maxX - minX) * s) / 2, oy = (600 - (maxY - minY) * s) / 2;
  const pr = (lon, lat) => { const [x, y] = P([lon, lat]); return [ox + (x - minX) * s, oy + (y - minY) * s]; };
  const d = 'M' + ring.map(([lon, lat]) => pr(lon, lat).map((v) => v.toFixed(1)).join(' ')).join('L') + 'Z';
  const cities = [['София', 23.32, 42.70, 'r'], ['Пловдив', 24.75, 42.15, 'b'], ['Велико Търново', 25.63, 43.08, 't'], ['Варна', 27.91, 43.21, 'l'], ['Бургас', 27.47, 42.50, 'l']];
  const svg = $('#map');
  svg.innerHTML = `<path id="mapPath" d="${d}" fill="#ECE7DB" stroke="#161514" stroke-width="7" stroke-linejoin="round"/>` +
    cities.map(([n, lon, lat, side], i) => {
      const [x, y] = pr(lon, lat);
      const w = n.length * 19 + 36;
      const lx = side === 'r' ? 24 : side === 'l' ? -24 - w : -w / 2;
      const ly = side === 't' ? -96 : side === 'b' ? 22 : -76;
      return `<g class="pin" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><g class="pinb">
        <path d="M0 0 C -5 -12 -22 -26 -22 -42 A22 22 0 1 1 22 -42 C 22 -26 5 -12 0 0 Z" fill="#161514"/>
        <circle cx="0" cy="-42" r="9" fill="#FFC72C"/>
        <g transform="translate(${lx} ${ly})"><rect width="${w}" height="50" rx="25" fill="#161514"/><text x="${w / 2}" y="34" text-anchor="middle" font-family="Inter" font-weight="800" font-size="28" fill="#ECE7DB">${n}</text></g>
      </g></g>`;
    }).join('');
  const path = $('#mapPath');
  const L = path.getTotalLength();
  path.style.strokeDasharray = `${L}`;
  return L;
}

function buildWatch() {
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const a = (i / 60) * Math.PI * 2, r0 = i % 5 === 0 ? 196 : 214;
    return `<line x1="${300 + Math.sin(a) * r0}" y1="${410 - Math.cos(a) * r0}" x2="${300 + Math.sin(a) * 230}" y2="${410 - Math.cos(a) * 230}" stroke="#161514" stroke-width="${i % 5 === 0 ? 10 : 4}" stroke-linecap="round"/>`;
  }).join('');
  $('#watch').innerHTML = `
    <rect x="262" y="70" width="76" height="60" rx="12" fill="#161514"/>
    <rect x="240" y="40" width="120" height="44" rx="14" fill="#161514"/>
    <circle cx="300" cy="410" r="262" fill="#161514"/>
    <circle cx="300" cy="410" r="240" fill="#FFC72C"/>
    ${ticks}
    <g id="hand"><line x1="300" y1="440" x2="300" y2="210" stroke="#161514" stroke-width="16" stroke-linecap="round"/></g>
    <circle cx="300" cy="410" r="22" fill="#161514"/>`;
}

function buildEnvelope() {
  $('#env').innerHTML = `
    <g id="letter"><rect x="130" y="120" width="440" height="330" rx="18" fill="#ffffff" stroke="#161514" stroke-width="10"/>
      <text x="350" y="330" text-anchor="middle" font-family="Inter" font-weight="900" font-size="190" fill="#161514">?</text></g>
    <rect x="60" y="190" width="580" height="320" rx="26" fill="#FFC72C" stroke="#161514" stroke-width="12"/>
    <path d="M60 220 L350 400 L640 220" fill="none" stroke="#161514" stroke-width="12" stroke-linejoin="round"/>
    <g id="flap"><path d="M66 198 L350 380 L634 198 Z" fill="#FFC72C" stroke="#161514" stroke-width="12" stroke-linejoin="round"/></g>`;
}

async function partners() {
  const fill = async (id, json, cls) => {
    const list = await (await fetch(json)).json();
    for (const p of list) { const d = document.createElement('div'); d.className = cls; d.innerHTML = `<img src="${p.file}" alt="">`; document.getElementById(id).appendChild(d); }
    return list.length;
  };
  const n1 = await fill('partners', '../assets/partners/partners.json', 'tile');
  const n2 = await fill('escape-partners', '../assets/escape-partners/partners.json', 'tile');
  $('#pl1').style.top = '640px';
  $('#partners').style.top = '690px';
  return n2;
}

// ------------------------------------------------------------------ main
async function main() {
  const faces = ['900 40px Inter', '800 40px Inter', 'italic 400 40px "Playfair Display"'];
  await Promise.all(faces.map((f) => document.fonts.load(f, 'АБВЪЬЮЯ 0123')));
  await document.fonts.ready;
  for (const f of faces) if (!document.fonts.check(f, 'Ъ')) throw new Error('font missing ' + f);
  const V = await (await fetch('voice.json')).json();
  const S = V.sentences;
  const END = S[9].end + 0.35;
  const END2 = END + 2.8;
  const TOTAL = END2 + 3.2;

  $('#grain').style.backgroundImage = `url(${grainURL()})`;
  buildReel($('#n50'), '50+');
  buildReel($('#n200'), '200+');
  const tok0 = buildTokens($('#tokens'), 9, 92, 102, 0, [0, 102, 204, 820, 922, 1024], 52);
  const pplBox = $('#people');
  const people = [];
  for (let r = 0; r < 17; r++) for (let c = 0; c < 12; c++) {
    if (people.length >= 200) break;
    const d = document.createElement('div'); d.className = 'p'; d.innerHTML = PERSON;
    d.style.left = `${c * 78 + (r % 2) * 20}px`; d.style.top = `${r * 74}px`; d.style.width = '44px'; d.style.height = '68px';
    pplBox.appendChild(d); people.push(d);
  }
  const tok2 = buildTokens($('#tokens2'), 13, 60, 70, 0, [0, 82, 164, 246], 52);
  const winners = [3, 9, 15, 20, 28, 33, 41, 47];
  const mapLen = await buildMap();
  const pins = [...document.querySelectorAll('.pin .pinb')];
  const cal = $('#cal');
  for (let d = 19; d <= 25; d++) cal.insertAdjacentHTML('beforeend', `<div class="day">${d}<small>ОКТ</small></div>`);
  const days = [...cal.children];
  buildWatch();
  const bars = [0.38, 0.52, 1.0, 0.44, 0.3].map((h, i) => { const b = document.createElement('div'); b.className = h === 1 ? 'bar top' : 'bar'; $('#bars').appendChild(b); return { el: b, h }; });
  buildEnvelope();
  await partners();
  await Promise.all([...document.images].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = r; im.onerror = r; }))));

  const scenes = ['#s0', '#s1', '#s2', '#s3', '#s4', '#s5', '#s6', '#s7', '#s8', '#s9', '#end', '#end2'].map((s) => $(s));
  const cut = (i) => (i === 0 ? 0 : i === 10 ? END : i === 11 ? END2 : S[i].at - 0.12);
  // punches: every cut and the key slams get a short camera shake
  const punches = [];
  for (let i = 1; i <= 10; i++) punches.push([cut(i), 16]);
  punches.push([S[5].parts[1][0], 22], [S[6].at + 0.05, 14], [S[7].parts[1][0] + 0.45, 18], [S[8].at, 26], [S[8].parts[1][0], 16], [S[9].parts[2][0], 16]);

  window.__frame = async (f) => {
    const t = f / FPS;
    let cur = 0;
    for (let i = 0; i < scenes.length; i++) if (t >= cut(i)) cur = i;
    scenes.forEach((el, i) => { el.style.display = i === cur ? 'block' : 'none'; });
    const lt = t - cut(cur);
    // camera: punch-in on every cut, slow push, shake on punches
    let sh = 0; for (const [p, a] of punches) if (t >= p && t < p + 0.35) sh = Math.max(sh, a * Math.exp(-(t - p) * 11));
    const fr = Math.floor(t * FPS);
    const zoom = cur >= 10 ? 1 : 1.07 - 0.07 * easeOut(range(lt, 0, 0.25)) + 0.02 * range(lt, 0.25, 3);
    $('#cam').style.transform = `translate(${(hash(fr) - 0.5) * 2 * sh}px, ${(hash(fr + 3) - 0.5) * 2 * sh}px) scale(${zoom}) rotate(${(hash(fr + 9) - 0.5) * sh * 0.04}deg)`;
    const gfr = Math.floor(fr / 4); // grain changes every 4th frame, like film
    $('#grain').style.backgroundPosition = `${Math.floor(hash(gfr) * 540)}px ${Math.floor(hash(gfr + 1) * 540)}px`;

    // 0 · 50+ ОТБОРА
    if (cur === 0) {
      slam($('#s0 .kicker'), t, 0.05, { from: 1.2 });
      tok0.forEach((d, i) => pop(d, t, S[0].at + (i % 9) * 0.03 + Math.floor(i / 9) * 0.08, { dur: 0.22, from: 0 }));
      slam($('#n50'), t, S[0].at, { from: 1.4 });
      rollReel($('#n50'), t, S[0].at, S[0].at + 0.8);
      slam($('#s0 .word'), t, S[0].at + 0.75, { from: 1.5 });
    }
    // 1 · 200+ ИГРАЧИ
    if (cur === 1) {
      people.forEach((d, i) => {
        const r = Math.floor(i / 12), c = i % 12;
        const ti = S[1].at - 0.05 + (Math.hypot(r - 8, c - 5.5) / 12) * 0.7;
        const k = backOut(range(t, ti, ti + 0.2), 2.4);
        d.style.opacity = clamp(k); d.style.transform = `translateY(${(1 - k) * 30}px) scale(${0.3 + 0.7 * k})`;
      });
      slam($('#n200'), t, S[1].parts[1][0] - 0.1, { from: 1.5 });
      rollReel($('#n200'), t, S[1].parts[1][0] - 0.1, S[1].parts[1][0] + 0.45);
      slam($('#s1 .tag'), t, S[1].parts[1][0] + 0.3, { from: 1.6, rot: -6 });
      $('#s1 .tag').style.transform += ' rotate(-2deg)';
    }
    // 2 · 5 ГРАДА · 1 СЕДМИЦА
    if (cur === 2) {
      const p0 = S[2].parts[0][0], p1 = S[2].parts[1][0];
      slam($('#h5'), t, p0 - 0.05, { from: 1.5 });
      $('#mapPath').style.strokeDashoffset = `${mapLen * (1 - easeOut(range(t, p0 - 0.1, p0 + 0.45)))}`;
      $('#map').style.opacity = 1;
      pins.forEach((p, i) => { const k = backOut(range(t, p0 + 0.15 + i * 0.07, p0 + 0.4 + i * 0.07), 2.4); p.style.opacity = clamp(k); p.style.transform = `scale(${k})`; });
      slam($('#h1'), t, p1 - 0.05, { from: 1.5 });
      days.forEach((d, i) => pop(d, t, p1 + 0.05 + i * 0.05, { dur: 0.2, from: 0.2 }));
    }
    // 3 · СЕКУНДИТЕ решаваха
    if (cur === 3) {
      const p1 = S[3].parts[1][0];
      slam($('#s3a'), t, S[3].at, { from: 1.15 }); highlight($('#s3a'), t, S[3].at + 0.3);
      pop($('#watch'), t, S[3].at + 0.05, { dur: 0.3, from: 0.5 });
      const spin = t < p1 + 0.35 ? (t - S[3].at) * 1440 : (p1 + 0.35 - S[3].at) * 1440 + Math.sin((t - p1) * 40) * 4 * Math.exp(-(t - p1 - 0.35) * 6);
      $('#hand').setAttribute('transform', `rotate(${spin % 360} 300 410)`);
      slam($('#s3b'), t, p1 + 0.3, { from: 1.7 });
    }
    // 4 · УБЕДИТЕЛНА разлика
    if (cur === 4) {
      const p1 = S[4].parts[1][0];
      slam($('#s4a'), t, S[4].at, { from: 1.15 });
      bars.forEach((b, i) => {
        const base = b.h === 1 ? 0.45 : b.h;
        let h = base * easeOut(range(t, S[4].at + i * 0.05, S[4].at + 0.4 + i * 0.05));
        if (b.h === 1) h = Math.max(h, base + (1 - base) * backOut(range(t, p1 + 0.3, p1 + 0.65), 1.5));
        b.el.style.height = `${h * 700}px`;
      });
      slam($('#s4b'), t, p1 + 0.55, { from: 1.7 });
    }
    // 5 · МНОГО ЗА МАЛКО · на косъм
    if (cur === 5) {
      const p1 = S[5].parts[1][0];
      slam($('#s5a'), t, S[5].at - 0.05, { from: 1.5 });
      const k = easeIn(range(t, S[5].at + 0.2, p1));
      $('#hair .l').style.left = `${-560 + (16 + 560) * k}px`;
      $('#hair .r').style.left = `${1080 + (544 - 1080) * k}px`;
      $('#hair .line').style.opacity = t >= p1 ? 0.6 + 0.4 * Math.sin((t - p1) * 30) : 0;
      $('#hair').style.transform = `scale(${1 + 0.18 * easeOut(range(t, p1, p1 + 0.5))})`;
      slam($('#s5b'), t, p1, { from: 1.6 }); highlight($('#s5b'), t, p1 + 0.15);
    }
    // 6 · САМО 8 ПРОДЪЛЖАВАТ
    if (cur === 6) {
      tok2.forEach((d, i) => {
        const w = winners.indexOf(i);
        d.style.opacity = 1;
        if (w < 0) {
          const td = S[6].at + 0.1 + hash(i + 40) * 0.6;
          const k = Math.max(0, t - td);
          d.style.transform = `translateY(${1400 * k * k}px) rotate(${(hash(i) - 0.5) * 300 * k}deg)`;
          d.style.opacity = clamp(1 - k * 2.2);
        } else {
          const k = easeOut(range(t, S[6].at + 0.75, S[6].at + 1.15));
          const x0 = (i % 13) * 70, y0 = [0, 82, 164, 246][Math.floor(i / 13)];
          const x1 = 455 - 4 * 112 + w * 112 + 26, y1 = 300;
          d.classList.toggle('win', t >= S[6].at + 0.7);
          d.style.transform = `translate(${(x1 - x0) * k}px, ${(y1 - y0) * k}px) scale(${1 + 0.35 * k})`;
        }
      });
      slam($('#only8'), t, S[6].at, { from: 1.6 });
      slam($('#s6 .word'), t, S[6].at + 0.75, { from: 1.5 });
    }
    // 7 · оспорван до последната секунда
    if (cur === 7) {
      const [p0, p1, p2] = S[7].parts.map((p) => p[0]);
      slam($('#s7a'), t, p0, { from: 1.2 });
      slam($('#s7b'), t, p1, { from: 1.15 });
      const k = slam($('#s7c'), t, p1 + 0.45, { from: 1.7 });
      if (k >= 1) $('#s7c').style.transform += ` translate(${(hash(Math.floor(t * 30)) - 0.5) * 6}px, ${(hash(Math.floor(t * 30) + 5) - 0.5) * 6}px)`;
      slam($('#s7d'), t, p2, { from: 1.15 }); highlight($('#s7d'), t, p2 + 0.3);
      $('#drain div').style.width = `${100 - 98.5 * easeIn(range(t, p0, S[7].end + 0.5))}%`;
    }
    // 8 · ФИНАЛ 7.11 СОФИЯ
    if (cur === 8) {
      $('#burst').style.transform = `rotate(${(t - cut(8)) * 14}deg) scale(${1 + 0.1 * easeOut(range(lt, 0, 0.4))})`;
      slam($('#s8a'), t, cut(8), { from: 1.3 });
      slam($('#s8b'), t, S[8].at, { from: 1.9 });
      slam($('#s8c'), t, S[8].parts[1][0], { from: 1.7 });
    }
    // 9 · СЛЕДИ ИМЕЙЛА СИ
    if (cur === 9) {
      const [p0, p1, p2] = S[9].parts.map((p) => p[0]);
      const pk = slam($('#s9a'), t, p0, { from: 1.4 });
      $('#s9a').style.transform = `translateX(-50%) ${$('#s9a').style.transform}`;
      pop($('#env'), t, p0 + 0.1, { dur: 0.3, from: 0.5 });
      const fk = easeOut(range(t, p1, p1 + 0.3));
      $('#flap').setAttribute('transform', `translate(0 ${198 * fk * 2}) scale(1 ${1 - 2 * fk}) translate(0 ${-198 * fk * 0})`);
      $('#flap').setAttribute('transform', `translate(0 198) scale(1 ${1 - 2 * fk}) translate(0 -198)`);
      $('#letter').setAttribute('transform', `translate(0 ${-170 * backOut(range(t, p1 + 0.25, p1 + 0.65), 1.6)})`);
      slam($('#s9b'), t, p2 - 0.05, { from: 1.6 });
      slam($('#s9c'), t, p2 + 0.5, { from: 1.1 });
    }
    // end card
    if (cur === 10) {
      $('#partners').querySelectorAll('.tile').forEach((el, i) => pop(el, t, END + 0.15 + i * 0.04, { dur: 0.3, from: 0.6 }));
      slam($('#end .logos'), t, END, { from: 1.15 });
      slam($('#end .final-label'), t, END + 0.1, { from: 1.2 });
    }
    // end card 2 · escape partners of the qualifications
    if (cur === 11) {
      slam($('#end2 .logos'), t, END2, { from: 1.15 });
      slam($('#e2a'), t, END2 + 0.05, { from: 1.4 });
      slam($('#e2b'), t, END2 + 0.3, { from: 1.2 }); highlight($('#e2b'), t, END2 + 0.45);
      $('#escape-partners').querySelectorAll('.tile').forEach((el, i) => pop(el, t, END2 + 0.55 + i * 0.08, { dur: 0.3, from: 0.6 }));
    }
    await new Promise((r) => requestAnimationFrame(() => r()));
  };
  window.__total = Math.round(TOTAL * FPS);
  window.__ready = true;
}
main().catch((e) => { console.error(e); window.__error = String(e.stack || e); });
