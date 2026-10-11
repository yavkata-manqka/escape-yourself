// Frame driver. window.__frame(t) puts the whole page into the exact state for
// time t (seconds) and resolves once the GPU has finished; nothing reads a clock.
import { Scene3D } from './scene3d.js';
import { statesForFrame } from './shots.js';
import { buildFlat, buildMap, flatTimeline, flatProcedural, grainURL, fitTitles } from './flat.js';
import { buildHud, hudUpdate, pauseTimeline, pauseProcedural, slamShake } from './hud.js';
import { hash1, range, lerp } from './util.js';

const FREEZE_T = 22 + 29 / 30; // last gameplay frame, frozen under the pause menu
const $ = (s) => document.querySelector(s);

async function loadFonts() {
  const faces = ['400 40px Inter', '600 40px Inter', '700 40px Inter', '800 40px Inter', '900 40px Inter',
    'italic 400 40px "Playfair Display"', 'italic 700 40px "Playfair Display"'];
  await Promise.all(faces.map((f) => document.fonts.load(f, 'АБВ ЪЬЮЯ абв ъьюя 0123')));
  await document.fonts.ready;
  for (const f of faces) if (!document.fonts.check(f, 'Ъ')) throw new Error('font missing: ' + f);
}

async function main() {
  await loadFonts();
  const grain = grainURL();
  buildFlat($('#flat'), grain);
  for (const id of ['#boot', '#chars', '#city']) document.querySelector(id).style.display = 'block';
  fitTitles();
  buildHud($('#hud'), $('#flash'), $('#pause'), grain);
  const pins = await buildMap();
  await Promise.all([...document.images].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = r; im.onerror = r; }))));

  const gsap = window.gsap;
  gsap.ticker.sleep(); // no real-time ticking: everything is seeked explicitly
  const tl = gsap.timeline({ paused: true });
  tl.set(['#boot', '#chars', '#city'], { display: 'none' }, 0);
  flatTimeline(tl, pins);
  pauseTimeline(tl);
  tl.set({}, {}, 30);

  const s3d = new Scene3D($('#gl'), 1080, 1920);
  await s3d.init();
  let last3D = null;
  let snapshot = null;
  const gl = s3d.renderer.getContext();
  const px = new Uint8Array(4);

  window.__frame = async (t) => {
    tl.seek(t, true);
    flatProcedural(t);
    $('#flat').style.display = t < 7.8333 ? 'block' : 'none';
    $('#game').style.display = t >= 8 ? 'block' : 'none';

    // 3D gameplay
    const canvas = $('#gl');
    if (t >= 8 && t < 23) {
      const { states, center } = statesForFrame(t);
      if (center.cover) canvas.style.visibility = 'hidden';
      else {
        canvas.style.visibility = 'visible';
        s3d.render(states, center);
        last3D = t;
      }
    } else if (t >= 23) {
      if (last3D !== FREEZE_T) {
        const { states, center } = statesForFrame(FREEZE_T);
        s3d.render(states, center);
        last3D = FREEZE_T;
        snapshot = null;
      }
      canvas.style.visibility = 'visible';
      if (!snapshot) { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); snapshot = canvas.toDataURL('image/jpeg', 0.92); }
    }

    hudUpdate(t);
    pauseProcedural(t);

    // camera shake from slams and impacts
    const shake = t >= 8 && t < 23 ? slamShake(t) : [0, 0, 0];
    $('#shake').style.transform = `translate(${shake[0]}px, ${shake[1]}px) rotate(${shake[2]}deg)`;

    // pause: freeze, desaturate, darken, short glitch
    const game = $('#game');
    if (t >= 23) {
      const k = range(t, 23.0, 23.15);
      game.style.filter = `grayscale(${0.9 * k}) brightness(${lerp(1, 0.5, k)}) contrast(${lerp(1, 1.1, k)})`;
      const g = $('#glitch');
      if (t < 23.3) {
        const f = Math.floor(t * 30);
        let html = '';
        for (let i = 0; i < 9; i++) {
          if (hash1(f * 17 + i) < 0.6) {
            const y = Math.floor(hash1(f * 5 + i * 3) * 1920), h = 20 + Math.floor(hash1(f * 7 + i) * 140);
            const dx = (hash1(f * 11 + i) - 0.5) * 220;
            html += `<div style="position:absolute;left:0;top:${y}px;width:1080px;height:${h}px;background:url(${snapshot}) 0 ${-y}px/1080px 1920px;transform:translateX(${dx}px)"></div>`;
            if (i % 3 === 0) html += `<div style="position:absolute;left:0;top:${y + h}px;width:1080px;height:6px;background:${i % 2 ? '#FFC72C' : '#ECE7DB'};opacity:.8;transform:translateX(${-dx}px)"></div>`;
          }
        }
        g.innerHTML = html;
      } else g.innerHTML = '';
    } else { game.style.filter = 'none'; $('#glitch').innerHTML = ''; }

    // sync with the GPU so the screenshot sees the finished frame
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    await new Promise((r) => requestAnimationFrame(() => r()));
    return true;
  };
  window.__ready = true;
}

main().catch((e) => { console.error(e); window.__error = String(e && e.stack || e); });
