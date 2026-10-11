// Scripted first-person shots for the gameplay section (8s-24s).
// stateAt(t) is a pure function of time: it returns everything the 3D renderer
// needs for that instant (camera, lights, props, post settings).
import { POS } from './room.js';
import {
  clamp, lerp, smooth, easeOutCubic, easeInOutCubic, easeOutExpo, easeOutBack, easeInCubic, range, noise1, fbm1, hash1,
} from './util.js';

const EYE = 1.65;
const V = (x, y, z) => [x, y, z];
const vlerp = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

const KP = [POS.keypad.x, POS.keypad.y, POS.keypad.z];
const keyWorld = (col, row) => [KP[0] - 0.048 + col * 0.048, KP[1] + 0.045 - row * 0.04, KP[2] + 0.03];
const DIAL = (i) => [POS.padlock.x - 0.03 + i * 0.02, POS.padlock.y - 0.022, POS.padlock.z + 0.024];

// Global tension: handheld shake grows as the timer runs out.
function tension(t) {
  if (t < 15.5) return lerp(0.25, 0.55, range(t, 8, 15));
  if (t < 20) return lerp(0.8, 1.0, range(t, 15.5, 20));
  return 0.35; // slow motion: slow, heavy drift instead of jitter
}

function handheld(t, amp, speed = 1) {
  return [
    fbm1(t * 0.9 * speed, 11) * 0.02 * amp + noise1(t * 9 * speed, 12) * 0.004 * amp,
    fbm1(t * 0.8 * speed, 13) * 0.015 * amp + noise1(t * 11 * speed, 14) * 0.004 * amp,
    fbm1(t * 0.7 * speed, 15) * 0.01 * amp,
  ];
}

function impulse(t, t0, dur = 0.25) {
  if (t < t0 || t > t0 + dur) return 0;
  const k = (t - t0) / dur;
  return Math.exp(-k * 5) * Math.sin(k * 40);
}

function flicker(t, t0, t1, seed, depth = 1) {
  if (t < t0 || t > t1) return 1;
  const f = Math.floor(t * 30);
  const h = hash1(f * 13 + seed);
  return h < 0.45 ? 1 - depth : h < 0.6 ? 1 - depth * 0.5 : 1;
}

function base(t) {
  return {
    time: t,
    cover: null,
    cam: { pos: V(0, EYE, 2.8), look: V(0, 1.4, -3.5), roll: 0, fov: 70, shake: [0, 0] },
    flash: { on: 1, uv: 0, angle: 0.42 },
    lights: { pendant: 0.9, lamp: 1, picture: 1, alarm: 0, alarmAngle: 0, alarmPulse: 1, keypad: 1 },
    haze: 0.055,
    uvReveal: 0,
    padlock: { dials: [0, 0, 0, 0], shackle: 0, rattle: 0 },
    chest: { lid: 0, glow: 0 },
    key: { visible: false },
    keypad: { display: '_ _ _ _', color: 'yellow', pressed: {}, glow: 2.2 },
    post: {
      exposure: 1.0, bloom: 0.55, ca: 0.0015, vignette: 0.7, grain: 0.05, seed: Math.floor(t * 30),
      saturation: 0.78, contrast: 1.12, redVig: 0, redFlash: 0, freeze: 0, glitch: 0, glitchSeed: 0, fade: 1,
      aperture: 0, focus: 2, maxBlur: 16, bloomThreshold: 1.0,
    },
    mb: { n: 2, shutter: 1 / 60 },
  };
}

// dial values over time (continuous so they visibly roll)
function dialValues(t) {
  const start = [0, 0, 0, 0];
  const first = [4, 7, 2, 8];
  const roll = (from, to, t0, t1) => lerp(from, to + 10, easeOutBack(range(t, t0, t1), 1.2)) % 10;
  if (t < 13.0) return start;
  if (t < 14.0) return first.map((v, i) => roll(start[i], v, 13.02 + i * 0.07, 13.3 + i * 0.07));
  // second attempt: third dial 2 -> 1 (rolls the long way round with clicks)
  const d3 = t < 14.04 ? 2 : lerp(2, 1, easeOutBack(range(t, 14.04, 14.2), 2.0));
  return [4, 7, d3, 8];
}

function keypadState(t) {
  const presses = [['4', 17.56], ['7', 18.56], ['1', 19.56]];
  const pressed = {};
  let typed = '';
  for (const [k, tp] of presses) {
    if (t >= tp) typed += k;
    const p = t < tp ? 0 : t < tp + 0.06 ? (t - tp) / 0.06 : Math.max(0, 1 - (t - tp - 0.06) / 0.16);
    if (p > 0) pressed[k] = p;
  }
  const slots = (typed + '____').slice(0, 4).split('');
  let disp = slots.join(' ');
  if (t >= 20) disp = `${typed.split('').join(' ')} ${(Math.floor((t - 20) / 0.5) % 2 === 0) ? '_' : ' '}`;
  return { display: disp, color: t >= 15.5 ? 'red' : 'yellow', pressed, glow: 2.2 + (t > 20 ? 0.6 * Math.sin((t - 20) * Math.PI) : 0) };
}

function heartbeat(t) {
  // 120 BPM double-thump locked to the beat until 20s; slow motion: one beat per second
  const period = t < 20 ? 0.5 : 1.0;
  const ph = ((t - (t < 20 ? 0 : 20)) % period) / period;
  return Math.exp(-ph * 9) + 0.6 * Math.exp(-Math.max(0, ph - 0.18) * 11) * (ph > 0.18 ? 1 : 0);
}

const SHOTS = [
  // 8.0 black, "НИВО 1" over black while the door creaks
  { t0: 8.0, t1: 8.5, f: (t, S) => { S.cover = 'black'; } },
  // 8.5 flashlight clicks on: the room is revealed from the doorway
  {
    t0: 8.5, t1: 9.0, f: (t, S, lt) => {
      const k = easeOutCubic(lt / 0.5);
      S.cam.pos = vlerp(V(-0.2, EYE, 3.15), V(-0.25, EYE, 2.85), k);
      S.cam.look = V(1.0, 1.3, -3.5);
      S.cam.fov = 80;
      S.flash.on = lt < 0.034 ? 0 : flicker(t, 8.53, 8.62, 3, 0.6);
      S.lights.pendant = 0.55; S.lights.lamp = 0.8; S.lights.picture = 0.8;
      S.post.exposure = lerp(0.6, 1.0, easeOutCubic(lt / 0.3));
    },
  },
  // 9.0 fast walk in; the pendant flickers on the beat at 9.5
  {
    t0: 9.0, t1: 10.0, f: (t, S, lt) => {
      const k = easeInOutCubic(lt / 1.0);
      const step = Math.sin(lt * Math.PI * 2 * 2.3);
      S.cam.pos = add(vlerp(V(-0.25, EYE, 2.4), V(0.0, EYE, 0.6), k), V(0.02 * Math.sin(lt * Math.PI * 2.3), 0.03 * step, 0));
      S.cam.look = vlerp(V(1.0, 1.3, -3.5), V(2.0, 1.2, -2.2), k);
      S.cam.roll = 0.015 * Math.sin(lt * Math.PI * 2.3);
      S.cam.fov = 72;
      S.lights.pendant = 0.9 * flicker(t, 9.5, 9.82, 7, 0.95);
      S.mb = { n: 3, shutter: 1 / 50 };
    },
  },
  // 10.0 whip pan across the bookshelf
  {
    t0: 10.0, t1: 10.5, f: (t, S, lt) => {
      const k = easeInOutCubic(lt / 0.5);
      S.cam.pos = vlerp(V(-0.75, EYE, -0.95), V(-0.8, EYE - 0.02, -1.25), k);
      S.cam.look = vlerp(V(-2.2, 1.75, -2.6), V(-2.2, 1.0, -0.1), k);
      S.cam.roll = lerp(-0.08, 0.06, k);
      S.cam.fov = 66;
      S.mb = { n: 6, shutter: 1 / 40 };
    },
  },
  // 10.5 snap zoom on the desk papers; the flashlight battery stutters
  {
    t0: 10.5, t1: 11.0, f: (t, S, lt) => {
      S.cam.pos = vlerp(V(1.25, 1.52, -0.72), V(1.3, 1.49, -0.76), lt / 0.5);
      S.cam.look = add([POS.papers.x, POS.papers.y, POS.papers.z], V(-0.02, 0, 0.0));
      S.cam.fov = lerp(72, 30, easeOutExpo(lt / 0.14));
      S.flash.on = lt < 0.2 ? 1 : flicker(t, 10.7, 11.0, 21, 0.85) * lerp(1, 0.45, range(t, 10.7, 11.0));
      S.post.aperture = 9; S.post.focus = 0.93; S.post.maxBlur = 14;
      S.mb = { n: lt < 0.16 ? 4 : 2, shutter: 1 / 50 };
      S.post.ca = 0.006 * (1 - range(lt, 0, 0.2));
    },
  },
  // 11.0 full-screen "МИСЛИ."
  { t0: 11.0, t1: 11.5, f: (t, S) => { S.cover = 'black'; } },
  // 11.5 the painting; 12.0 UV torch reveals 4 7 1 and a smeared digit
  {
    t0: 11.5, t1: 12.5, f: (t, S, lt) => {
      const k = easeOutCubic(lt / 1.0);
      S.cam.pos = vlerp(V(1.05, 1.78, -0.95), V(1.28, 1.8, -1.12), k);
      S.cam.look = V(POS.painting.x, POS.painting.y - 0.02, POS.painting.z);
      S.cam.fov = 58;
      const uv = t >= 12.0 ? (t < 12.06 ? 0 : 1) : 0;
      S.flash.uv = uv;
      S.flash.on = t >= 12.0 && t < 12.06 ? 0 : uv ? 1 : 0.32;
      S.uvReveal = uv * clamp(range(t, 12.06, 12.3) * flicker(t, 12.06, 12.2, 31, 0.7));
      S.lights.picture = uv ? 0.0 : 0.55;
      S.lights.lamp = uv ? 0.12 : 0.8;
      S.lights.pendant = uv ? 0.2 : 0.9;
      S.post.exposure = uv ? 1.1 : 0.9;
      S.post.aperture = 2.5; S.post.focus = 1.3;
    },
  },
  // 12.5 smash zoom onto the chest
  {
    t0: 12.5, t1: 13.0, f: (t, S, lt) => {
      S.cam.pos = vlerp(V(-1.15, 1.58, -1.3), V(-1.18, 1.5, -1.45), easeOutCubic(lt / 0.5));
      S.cam.look = V(POS.chest.x, 0.42, POS.chest.z + 0.1);
      S.cam.fov = lerp(85, 40, easeOutExpo(lt / 0.15));
      const im = impulse(t, 12.5, 0.3);
      S.cam.shake = [im * 0.03, im * 0.02];
      S.post.ca = 0.012 * (1 - range(lt, 0, 0.18));
      S.mb = { n: lt < 0.15 ? 5 : 2, shutter: 1 / 45 };
      S.post.aperture = 3; S.post.focus = 1.6;
    },
  },
  // 13.0 failed attempt: 4-7-2 -> rattle, red flash, buzzer
  {
    t0: 13.0, t1: 14.0, f: (t, S, lt) => {
      S.cam.pos = add(V(-1.17, 0.57, -2.2), V(0, -0.01 * lt, -0.02 * lt));
      S.cam.look = add(DIAL(1.5), V(0, 0.02, 0));
      S.cam.fov = 38;
      S.padlock.dials = dialValues(t);
      const r = impulse(t, 13.5, 0.4);
      S.padlock.rattle = r * 0.12;
      S.padlock.shackle = Math.max(0, r) * 0.15;
      const im = impulse(t, 13.5, 0.3);
      S.cam.shake = [im * 0.025, im * 0.03];
      S.post.redFlash = t >= 13.5 ? Math.exp(-(t - 13.5) * 7) : 0;
      S.post.ca = t >= 13.5 ? 0.02 * Math.exp(-(t - 13.5) * 8) : 0.002;
      S.post.glitch = t >= 13.5 && t < 13.62 ? 0.8 : 0;
      S.post.glitchSeed = Math.floor(t * 30);
      S.post.aperture = 2.2; S.post.focus = 0.4; S.post.maxBlur = 18;
    },
  },
  // 14.0 macro: third dial clicks 2 -> 1 (dutch angle)
  {
    t0: 14.0, t1: 14.25, f: (t, S, lt) => {
      const d = DIAL(2);
      S.cam.pos = add(d, V(0.06, 0.05, 0.16 - 0.02 * lt / 0.25));
      S.cam.look = d;
      S.cam.roll = -0.22;
      S.cam.fov = 30;
      S.padlock.dials = dialValues(t);
      S.post.aperture = 0.9; S.post.focus = 0.17; S.post.maxBlur = 20;
      S.flash.aim = d;
    },
  },
  // 14.25 macro straight on: 4-7-1-8 aligned, the shackle springs open
  {
    t0: 14.25, t1: 14.5, f: (t, S, lt) => {
      const c = [POS.padlock.x, POS.padlock.y + 0.01, POS.padlock.z];
      S.cam.pos = add(c, V(-0.02, 0.03, 0.27 - 0.03 * lt / 0.25));
      S.cam.look = c;
      S.cam.roll = 0.1;
      S.cam.fov = 34;
      S.padlock.dials = [4, 7, 1, 8];
      S.padlock.shackle = easeOutBack(range(t, 14.38, 14.45), 3);
      const im = impulse(t, 14.38, 0.2);
      S.cam.shake = [im * 0.01, im * 0.015];
      S.post.aperture = 1.0; S.post.focus = 0.27; S.post.maxBlur = 16;
      S.flash.aim = c;
    },
  },
  // 14.5 the lid opens, golden glow, the key rises (then flies to the HUD slot)
  {
    t0: 14.5, t1: 15.0, f: (t, S, lt) => {
      S.cam.pos = vlerp(V(-1.0, 1.02, -1.62), V(-1.04, 0.98, -1.74), lt / 0.5);
      S.cam.look = V(POS.chest.x, 0.62, POS.chest.z + 0.05);
      S.cam.fov = 50;
      S.padlock.dials = [4, 7, 1, 8];
      S.padlock.shackle = 1;
      S.chest.lid = 1.05 * easeOutBack(range(t, 14.5, 14.68), 1.6);
      S.chest.glow = 0.9 * range(t, 14.52, 14.65);
      const kr = easeOutCubic(range(t, 14.55, 14.78));
      S.key = {
        visible: t < 14.8,
        pos: [POS.chest.x, 0.47 + 0.42 * kr, POS.chest.z + 0.1 + 0.25 * kr],
        spin: lt * 6,
        glow: 3 + 6 * kr,
      };
      S.post.bloom = 0.8;
      S.post.aperture = 2; S.post.focus = 1.0;
    },
  },
  // 15.0 blackout: total darkness
  { t0: 15.0, t1: 15.5, f: (t, S) => { S.cover = 'black'; } },
  // 15.5 the red alarm kicks in
  {
    t0: 15.5, t1: 16.0, f: (t, S, lt) => {
      S.cam.pos = add(V(0.25, EYE - 0.05, 0.3), V(0, 0, -0.1 * lt));
      S.cam.look = vlerp(V(0.35, 2.5, -3.3), V(0.45, 2.1, -3.3), easeOutCubic(lt / 0.5));
      S.cam.fov = 70;
      S.flash.on = 0;
      const im = impulse(t, 15.5, 0.35);
      S.cam.shake = [im * 0.03, im * 0.04];
      S.post.ca = 0.02 * Math.exp(-lt * 6);
    },
  },
  // 16.0 whip pan to the exit door, dutch angle, running
  {
    t0: 16.0, t1: 16.5, f: (t, S, lt) => {
      const k = easeInOutCubic(lt / 0.5);
      const step = Math.sin(lt * Math.PI * 2 * 3.2);
      S.cam.pos = add(vlerp(V(0.1, EYE, 0.0), V(0.45, EYE, -0.9), lt / 0.5), V(0, 0.045 * step, 0));
      S.cam.look = vlerp(V(-2.4, 1.5, 0.4), V(0.9, 1.25, -3.5), k);
      S.cam.roll = lerp(0.0, 0.2, k);
      S.cam.fov = 74;
      S.flash.on = 0.8 * flicker(t, 16.0, 16.12, 41, 0.8);
      S.mb = { n: 6, shutter: 1 / 40 };
    },
  },
  // 16.5 running at the door
  {
    t0: 16.5, t1: 17.0, f: (t, S, lt) => {
      const step = Math.sin(lt * Math.PI * 2 * 3.2 + 1);
      S.cam.pos = add(vlerp(V(0.5, EYE, -1.0), V(0.95, 1.6, -2.15), lt / 0.5), V(0.025 * step, 0.05 * Math.abs(step), 0));
      S.cam.look = V(1.25, 1.3, -3.5);
      S.cam.roll = lerp(0.16, -0.12, easeInOutCubic(lt / 0.5));
      S.cam.fov = 72;
      S.flash.on = 0.8;
      S.mb = { n: 4, shutter: 1 / 45 };
    },
  },
  // 17.0 at the keypad: "1 ОПИТ. БЕЗ РЕСТАРТ."
  {
    t0: 17.0, t1: 17.5, f: (t, S, lt) => {
      S.cam.pos = vlerp(V(1.22, 1.56, -2.5), V(1.3, 1.52, -2.68), easeOutCubic(lt / 0.5));
      S.cam.look = add(KP, V(-0.05, 0, 0));
      S.cam.roll = -0.08;
      S.cam.fov = 58;
      S.flash.on = 0.8;
    },
  },
  // 17.5 / 18.5 / 19.5 keypad presses, each cut tighter
  ...[[17.5, 18.5, '4', 0, 1, 0.42, 44, 0.06], [18.5, 19.5, '7', 0, 2, 0.31, 40, -0.1], [19.5, 20.0, '1', 0, 0, 0.23, 36, 0.13]].map(
    ([t0, t1, key, col, row, dist, fov, roll]) => ({
      t0, t1, f: (t, S, lt) => {
        const kw = keyWorld(col, row);
        const k = easeOutCubic(lt / (t1 - t0));
        S.cam.pos = add(kw, V(-0.04 + 0.02 * k, 0.03, dist - 0.03 * k));
        S.cam.look = kw;
        S.cam.roll = roll;
        S.cam.fov = fov;
        S.flash.on = 0.7; S.flash.aim = kw;
        const im = impulse(t, t0 + 0.06, 0.25);
        S.cam.shake = [im * 0.012, im * 0.02];
        S.post.aperture = 2.2; S.post.focus = Math.hypot(0.04, 0.03, dist); S.post.maxBlur = 18;
      },
    }),
  ),
  // 20.0 - 24.0 slow-motion climax: the crosshair hovers over the last button ("8")
  {
    t0: 20.0, t1: 24.0, f: (t, S, lt) => {
      const kw = keyWorld(1, 2); // "8"
      const k = easeInOutCubic(lt / 4);
      const hb = heartbeat(t);
      S.time = 20 + lt * 0.15; // slow motion for dust and lights
      S.cam.pos = add(kw, V(lerp(0.05, 0.02, k), lerp(0.035, 0.02, k), lerp(0.22, 0.16, k)));
      S.cam.look = kw;
      S.cam.roll = lerp(0.1, 0.04, k);
      S.cam.fov = 36 - 1.2 * hb;
      S.flash.on = 0.45; S.flash.aim = kw;
      S.post.aperture = 1.4; S.post.focus = Math.hypot(lerp(0.05, 0.02, k), lerp(0.035, 0.02, k), lerp(0.22, 0.16, k)); S.post.maxBlur = 26;
      S.post.exposure = 0.9 + 0.12 * hb;
      S.mb = { n: 1, shutter: 0 };
    },
  },
];

export function shotIndex(t) {
  return SHOTS.findIndex((s) => t >= s.t0 && t < s.t1);
}

export function stateAt(t) {
  const S = base(t);
  const i = shotIndex(t);
  if (i < 0) { S.cover = 'black'; return S; }
  const sh = SHOTS[i];
  sh.f(t, S, t - sh.t0);
  // alarm (after the blackout)
  if (t >= 15.5) {
    const slow = t >= 20 ? 20 + (t - 20) * 0.15 : t;
    S.lights.alarm = 1;
    S.lights.alarmAngle = (slow - 15.5) * Math.PI * 2 * 0.9;
    S.lights.alarmPulse = t < 20 ? 0.55 + 0.45 * heartbeat(t) : 0.4 + 0.6 * heartbeat(t);
    S.lights.pendant = 0; S.lights.lamp = 0; S.lights.picture = 0;
    S.post.redVig = (t < 20 ? 0.18 : 0.22) * heartbeat(t) + 0.06;
    S.haze = 0.07;
  }
  S.keypad = keypadState(t);
  if (t >= 14.5) { S.padlock.dials = [4, 7, 1, 8]; S.padlock.shackle = 1; }
  if (t >= 15.0) { S.chest.lid = 1.05; S.chest.glow = 0; }
  // handheld sway + tension shake
  const amp = tension(t);
  const hh = handheld(S.time, amp * 2.2, t >= 20 ? 0.3 : 1);
  S.cam.shake = [(S.cam.shake[0] || 0) + hh[0], (S.cam.shake[1] || 0) + hh[1]];
  S.cam.roll += hh[2];
  return S;
}

// Sub-frame states for motion blur, all inside the current shot (never across a cut).
export function statesForFrame(t) {
  const center = stateAt(t);
  const { n, shutter } = center.mb;
  if (center.cover || n <= 1) return { states: [center], center };
  const sh = SHOTS[shotIndex(t)];
  const states = [];
  for (let i = 0; i < n; i++) {
    let ts = t + (i / (n - 1) - 0.5) * shutter;
    ts = clamp(ts, sh.t0, sh.t1 - 1e-4);
    states.push(stateAt(ts));
  }
  return { states, center };
}

export const SHOT_LIST = SHOTS.map((s) => [s.t0, s.t1]);
