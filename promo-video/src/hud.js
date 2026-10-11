// Gameplay HUD, flash texts (8-23s) and the pause menu (23-30s).
// HUD and flash texts are pure functions of time; the pause menu is a GSAP timeline.
import { CURSOR_SVG } from './flat.js';
import { hash1, clamp, lerp, range, easeOutCubic, easeOutBack, easeInCubic } from './util.js';

const $ = (s) => document.querySelector(s);

export const FLASHES = [
  { t0: 8.0, t1: 8.46, html: 'НИВО 1', cls: 'yellow', size: 210, rot: -3 },
  { t0: 9.5, t1: 9.96, html: 'ТЪРСИ.', cls: 'yellow', size: 220, rot: 4, dy: 260 },
  { t0: 11.0, t1: 11.5, html: 'МИСЛИ.', cls: 'full', size: 205, rot: -2 },
  { t0: 13.5, t1: 13.98, html: 'ГРЕШНО.', cls: 'red', size: 190, rot: -4, dy: -260 },
  // these four hold for a full second each so they can be read calmly
  { t0: 15.0, t1: 15.96, html: 'ВРЕМЕТО<br>ИЗТИЧА.', cls: 'black', size: 160, rot: 3 },
  { t0: 16.0, t1: 16.96, html: 'ПОБЪРЗАЙ.', cls: 'yellow', size: 150, rot: -5, dy: 120 },
  { t0: 17.0, t1: 17.96, html: 'НЕ<br>ПАНИКЬОСВАЙ.', cls: 'black', size: 112, rot: 4, dy: -80 },
  { t0: 18.0, t1: 18.96, html: '1 ОПИТ.<br>БЕЗ РЕСТАРТ.', cls: 'blackyellow', size: 116, rot: -4, dy: 280 },
  { t0: 20.5, t1: 23.0, html: 'СЕГА ИЛИ<br>НИКОГА.', cls: 'black', size: 138, rot: -2, slow: true, dy: -330 },
];

const KEY_SVG = `<svg viewBox="0 0 100 100"><g transform="rotate(-35 50 50)">
  <circle cx="28" cy="50" r="18" fill="#FFC72C" stroke="#161514" stroke-width="7"/>
  <circle cx="28" cy="50" r="7" fill="#161514"/>
  <path d="M44 44 H90 V56 H82 V68 H72 V56 H64 V64 H56 V56 H44 Z" fill="#FFC72C" stroke="#161514" stroke-width="6" stroke-linejoin="round"/>
</g></svg>`;
const LOCK_SVG = `<svg viewBox="0 0 64 64"><path d="M18 28 V20 A14 14 0 0 1 46 20 V28" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><rect x="10" y="28" width="44" height="30" rx="7" fill="none" stroke="currentColor" stroke-width="7"/><circle cx="32" cy="43" r="5" fill="currentColor"/></svg>`;
const ARROW_DARK = '<svg viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="#FFC72C" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ARROW_NE = '<svg viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="#161514" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function buildHud(hud, flash, pause, grain) {
  hud.innerHTML = `
    <div id="timer"><div class="label"><span class="dot"></span>ТАЙМЕРЪТ ТЕЧЕ</div><div class="digits">59:59</div></div>
    <div id="level-chip">НИВО 1</div>
    <div id="penalty">-0:05</div>
    <div id="crosshair"><div class="ring"></div><div class="d"></div></div>
    <div class="prompt" id="prompt-look"><span class="key">E</span><span class="txt">Огледай</span></div>
    <div class="prompt" id="prompt-unlock"><span class="key">E</span><span class="txt">Отключи</span></div>
    <div id="inventory">${'<div class="slot"></div>'.repeat(4)}</div>
    <div id="plus-key">+1 КЛЮЧ</div>
    <div id="flykey">${KEY_SVG}</div>
    <div id="particles"></div>`;
  flash.innerHTML = FLASHES.map((f, i) =>
    f.cls === 'full'
      ? `<div class="flash full" id="fl-${i}"><span style="font-size:${f.size}px">${f.html}</span></div>`
      : `<div class="flash ${f.cls}" id="fl-${i}"><span class="blk" style="font-size:${f.size}px">${f.html}</span></div>`).join('');
  pause.innerHTML = `
    <div class="layer" id="pause-dim"></div>
    <div id="panel">
      <div class="grain" style="background-image:url(${grain})"></div>
      <div class="title ptitle">ПАУЗА</div>
      <div id="pause-icon"><i></i><i></i></div>
      <div class="serif psub">Има само <span class="hl">един начин</span> да продължиш.</div>
      <div class="btn" id="btn-cont">${LOCK_SVG}<span>ПРОДЪЛЖИ</span></div>
      <div class="btn" id="btn-reg"><span>ЗАПИШИ ОТБОРА СИ</span><span class="arrow">${ARROW_DARK}</span></div>
      <div class="info">
        <div class="serif reg">Регистрация до <span class="hl">15.10</span></div>
        <div class="bio"><span>Линк в биото</span><span class="yb">${ARROW_NE}</span></div>
      </div>
      <div class="prule" style="top:1080px"></div>
      <div class="pfoot">
        <div class="l"><img class="usyc-img" src="../assets/usyc-logo.png" alt=""></div>
        <img class="logo-sm" src="../assets/logo.png" alt="">
      </div>
    </div>
    <div class="cursor" id="pause-cursor">${CURSOR_SVG}</div>`;
  // fit flash texts inside 960 px
  FLASHES.forEach((f, i) => {
    const el = document.getElementById(`fl-${i}`);
    if (f.cls === 'full') return;
    const blk = el.querySelector('.blk');
    const w = blk.getBoundingClientRect().width;
    if (w > 960) blk.style.fontSize = `${Math.floor(f.size * 960 / w)}px`;
  });
}

// ------------------------------------------------------------------ timer
const SEGS = [[8.0, 9.0, 3599], [9.0, 10.0, 3240], [10.0, 10.5, 2622], [10.5, 11.0, 2045], [11.0, 11.5, 1608], [11.5, 12.5, 1177], [12.5, 13.0, 742], [13.0, 14.0, 488], [14.0, 15.0, 194]];
const FINAL = [[15.0, 10], [16.0, 9], [17.0, 8], [18.0, 7], [19.0, 6], [19.5, 5], [20.0, 4], [20.5, 3]];
export function timerValue(t) {
  if (t >= 15.0) { let v = 10; for (const [ts, val] of FINAL) if (t >= ts) v = val; return v; }
  for (const [a, b, s] of SEGS) if (t >= a && t < b) {
    let v = Math.ceil(s - (t - a) - 1e-6);
    if (a === 13.0 && t >= 13.5) v -= 5;
    return v;
  }
  return 3599;
}
const fmt = (v) => `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;

function lastChange(t) {
  const v = timerValue(t);
  for (let k = 1; k <= 30; k++) { if (timerValue(t - k / 30) !== v) return t - (k - 1) / 30; }
  return -10;
}

export function heartbeat(t) {
  if (t >= 20.5) return 0.35; // slow motion: steady, no repeating pulse
  const ph = (t % 0.5) / 0.5;
  return Math.exp(-ph * 9) + (ph > 0.18 ? 0.6 * Math.exp(-(ph - 0.18) * 11) : 0);
}

// slam envelope for a flash text
function slam(lt) {
  if (lt < 0.066) return lerp(1.75, 0.95, easeOutCubic(lt / 0.066));
  if (lt < 0.15) return lerp(0.95, 1.0, easeOutCubic((lt - 0.066) / 0.084));
  return 1;
}

// returns the shake (px) the whole picture should get from flash-text slams and impacts
export function slamShake(t) {
  const hits = FLASHES.filter((f) => !f.slow).map((f) => f.t0).concat([13.5, 14.4, 12.5]);
  let a = 0;
  for (const h of hits) if (t >= h && t < h + 0.25) a = Math.max(a, 26 * Math.exp(-(t - h) * 14));
  
  const f = Math.floor(t * 30);
  return [(hash1(f * 3) - 0.5) * 2 * a, (hash1(f * 7 + 1) - 0.5) * 2 * a, (hash1(f * 11 + 2) - 0.5) * a * 0.06];
}

export function hudUpdate(t) {
  const hud = $('#hud');
  const visible = t >= 8.5;
  hud.style.display = visible ? 'block' : 'none';
  if (visible) {
    // timer
    const v = timerValue(Math.min(t, 22.99));
    const timer = $('#timer');
    timer.querySelector('.digits').textContent = fmt(v);
    const danger = t >= 15.0;
    timer.classList.toggle('danger', danger);
    const lc = lastChange(Math.min(t, 22.99));
    const p = t - lc;
    const pulse = p >= 0 && p < 0.2 ? 0.07 * Math.exp(-p * 18) : 0;
    let sx = 0, sy = 0;
    if (danger && t < 23) { const f = Math.floor(t * 30); const amp = t < 20.5 ? 5 : 2; sx = (hash1(f * 5) - 0.5) * 2 * amp; sy = (hash1(f * 9) - 0.5) * 2 * amp; }
    timer.style.transform = `translate(${sx}px, ${sy}px) scale(${1 + pulse + (danger ? 0.04 * heartbeat(t) : 0)})`;
    $('#timer .dot').style.opacity = Math.floor(t * 2) % 2 === 0 ? 1 : 0.35;
    // penalty pop-up
    const pen = $('#penalty');
    if (t >= 13.5 && t < 14.0) {
      const lt = t - 13.5;
      pen.style.display = 'block';
      pen.style.transform = `translate(${lerp(-60, 0, easeOutBack(lt / 0.12))}px, ${-40 * easeInCubic(range(lt, 0.25, 0.5))}px) rotate(-4deg) scale(${slam(lt)})`;
      pen.style.opacity = 1 - range(lt, 0.38, 0.5);
    } else pen.style.display = 'none';
    // crosshair
    const ch = $('#crosshair');
    const covered = (t >= 11.0 && t < 11.5) || t < 8.5;
    ch.style.display = covered ? 'none' : 'block';
    const ring = $('#crosshair .ring');
    if (t >= 20.5 && t < 23.0) {
      // slow motion: the ring tightens once, steadily, onto the last button
      ring.style.opacity = Math.min(1, range(t, 20.5, 20.9)) * 0.9;
      ring.style.transform = `scale(${lerp(1.2, 0.85, range(t, 20.5, 23.0))})`;
    } else if (t >= 23) { ring.style.opacity = 0.8; ring.style.transform = 'scale(0.9)'; } else ring.style.opacity = 0;
    // interaction prompts near the object
    promptUpdate('#prompt-look', t, 11.56, 12.06, 11.96, 330, 1130);
    promptUpdate('#prompt-unlock', t, 12.6, 13.06, 12.96, 330, 1130);
    // inventory + key pickup
    const slot0 = document.querySelector('#inventory .slot');
    const filled = t >= 14.93;
    slot0.classList.toggle('filled', filled);
    if (filled && !slot0.innerHTML) slot0.innerHTML = KEY_SVG;
    if (!filled && slot0.innerHTML) slot0.innerHTML = '';
    const sp = filled ? 1 + 0.25 * Math.exp(-(t - 14.93) * 12) : 1;
    slot0.style.transform = `scale(${sp})`;
    const fk = $('#flykey');
    if (t >= 14.7 && t < 14.93) {
      const k = easeInCubic(range(t, 14.7, 14.93));
      const x0 = 520, y0 = 820, x1 = 357, y1 = 1506;
      const x = lerp(x0, x1, k), y = lerp(y0, y1, k) - Math.sin(k * Math.PI) * 140;
      fk.style.display = 'block';
      fk.style.transform = `translate(${x - 60}px, ${y - 60}px) rotate(${k * 360}deg) scale(${lerp(1.5, 0.8, k)})`;
    } else fk.style.display = 'none';
    const pk = $('#plus-key');
    if (t >= 14.62 && t < 15.0) {
      const lt = t - 14.62;
      pk.style.display = 'block';
      pk.style.transform = `translate(-50%, ${-30 * easeOutCubic(lt / 0.38)}px) rotate(-3deg) scale(${slam(lt)})`;
    } else pk.style.display = 'none';
    particles(t);
    $('#level-chip').style.transform = `rotate(2deg) scale(${t < 8.7 ? slam(t - 8.5) : 1})`;
  }
  // flash texts
  FLASHES.forEach((f, i) => {
    const el = document.getElementById(`fl-${i}`);
    if (t < f.t0 || t >= f.t1) { el.style.display = 'none'; return; }
    el.style.display = f.cls === 'full' ? 'grid' : 'block';
    const lt = t - f.t0, dur = f.t1 - f.t0;
    let s, rot = f.rot, op = 1;
    if (f.slow) {
      s = lerp(0.82, 1.16, (lt / dur)) * (lt < 0.1 ? lerp(1.4, 1, easeOutCubic(lt / 0.1)) : 1);
      op = Math.min(1, lt / 0.06);
    } else {
      s = slam(lt);
      rot = f.rot * (lt < 0.066 ? 2.2 : 1);
      if (lt > dur - 0.05) { op = 1 - (lt - (dur - 0.05)) / 0.05; s *= 1.03; }
    }
    if (f.cls === 'full') el.style.transform = `rotate(${rot * 0.4}deg) scale(${lerp(1.0, 1.06, lt / dur)})`;
    else el.style.transform = `translate(-50%, calc(-50% + ${f.dy || 0}px)) rotate(${rot}deg) scale(${s})`;
    if (f.cls === 'full') el.querySelector('span').style.transform = `scale(${slam(lt)})`;
    el.style.opacity = op;
  });
}

function promptUpdate(sel, t, t0, t1, tPress, x, y) {
  const el = $(sel);
  if (t < t0 || t >= t1) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  const lt = t - t0;
  const s = lt < 0.12 ? easeOutBack(lt / 0.12, 2.5) : 1;
  el.style.left = `${x}px`; el.style.top = `${y}px`;
  el.style.transform = `scale(${s})`;
  const key = el.querySelector('.key');
  const pressed = t >= tPress && t < tPress + 0.08;
  key.style.transform = pressed ? 'translateY(6px)' : 'none';
  key.style.boxShadow = pressed ? '0 0 0 #161514' : '';
  el.style.opacity = t > t1 - 0.05 ? 0 : 1;
}

function particles(t) {
  const root = $('#particles');
  let html = '';
  const burst = (tb, cx, cy, n, spread, seed) => {
    if (t < tb || t > tb + 0.45) return;
    const lt = t - tb;
    for (let i = 0; i < n; i++) {
      const a = hash1(seed + i * 3) * Math.PI * 2, sp = spread * (0.4 + hash1(seed + i * 5) * 0.8);
      const x = cx + Math.cos(a) * sp * easeOutCubic(lt / 0.45), y = cy + Math.sin(a) * sp * easeOutCubic(lt / 0.45) + 160 * lt * lt;
      const s = 1 - lt / 0.45;
      html += `<div class="particle" style="transform:translate(${x - 7}px,${y - 7}px) rotate(${a * 57}deg) scale(${s * (0.6 + hash1(seed + i) * 0.9)})"></div>`;
    }
  };
  burst(14.62, 520, 820, 22, 260, 100);
  burst(14.93, 357, 1506, 16, 150, 300);
  root.innerHTML = html;
}

// ------------------------------------------------------------------ pause menu
export function pauseTimeline(tl) {
  tl.set('#pause', { display: 'none' }, 0);
  tl.set('#pause', { display: 'block' }, 23);
  tl.fromTo('#pause-dim', { opacity: 0 }, { opacity: 1, duration: 0.15 }, 23);
  tl.fromTo('#panel', { y: 1500, rotate: 6 }, { y: 0, rotate: -1.2, duration: 0.42, ease: 'back.out(1.25)' }, 23.25);
  tl.fromTo('#panel .ptitle', { scale: 1.5, opacity: 0, transformOrigin: '0% 50%' }, { scale: 1, opacity: 1, duration: 0.2, ease: 'back.out(2)' }, 23.5);
  tl.fromTo('#pause-icon i', { scaleY: 0 }, { scaleY: 1, duration: 0.2, ease: 'back.out(2.4)', stagger: 0.05 }, 23.55);
  tl.fromTo('#panel .psub', { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.22, ease: 'power3.out' }, 23.6);
  tl.fromTo('#panel .psub .hl', { '--hl': 0 }, { '--hl': 1, duration: 0.3, ease: 'power3.out' }, 23.7);
  tl.fromTo('#btn-cont', { opacity: 0, x: -80 }, { opacity: 1, x: 0, duration: 0.25, ease: 'power3.out' }, 23.65);
  tl.fromTo('#btn-reg', { opacity: 0, x: 80 }, { opacity: 1, x: 0, duration: 0.25, ease: 'back.out(1.6)' }, 23.75);
  tl.fromTo('#panel .info', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.25, ease: 'power3.out' }, 23.9);
  tl.fromTo('#panel .reg .hl', { '--hl': 0 }, { '--hl': 1, duration: 0.3, ease: 'power3.out' }, 24);
  tl.fromTo('#panel .pfoot, #panel .prule', { opacity: 0 }, { opacity: 1, duration: 0.25 }, 24);
  // cursor moves onto the yellow button and hovers
  tl.fromTo('#pause-cursor', { x: 980, y: 1720, opacity: 0 }, { x: 700, y: 1058, opacity: 1, duration: 0.75, ease: 'power3.inOut' }, 24.25);
  tl.to('#btn-reg', { scale: 1.045, boxShadow: '0 14px 0 #161514, 0 0 0 10px rgba(255,199,44,0.35)', duration: 0.18, ease: 'back.out(2)' }, 25);
}

export function pauseProcedural(t) {
  if (t < 23) return;
  // the yellow button pulses until 27.75, then everything holds still
  const btn = $('#btn-reg');
  if (t >= 23.95 && t < 26.75) {
    const ph = ((t - 23.95) % 0.5) / 0.5;
    const glow = Math.exp(-ph * 5);
    btn.style.filter = `brightness(${1 + 0.08 * glow})`;
    btn.querySelector('.arrow').style.transform = `translateX(${8 * glow}px)`;
  } else {
    btn.style.filter = 'none';
    btn.querySelector('.arrow').style.transform = 'none';
  }
}
