# Escape Yourself — 30 s vertical promo

`escape-yourself-promo.mp4`: 1080×1920, 30 fps, H.264 (yuv420p), AAC 48 kHz, 30.0 s.

## Structure

| Time | Section | Built with |
|---|---|---|
| 0–2 s | Boot screen (glitch power-on, logo, "НАТИСНИ START") | HTML/CSS + GSAP (`src/flat.js`) |
| 2–5 s | Character select (4 flat SVG characters, stat card) | `src/characters.js`, `src/flat.js` |
| 5–8 s | City select (Natural Earth map of Bulgaria, 5 pins, zoom into Пловдив) | `src/flat.js` |
| 8–24 s | First-person escape-room gameplay, cuts on every 0.5 s beat | Three.js (`src/room.js`, `src/shots.js`, `src/scene3d.js`, `src/post.js`) + HUD (`src/hud.js`) |
| 24–30 s | Pause menu over the frozen last frame | `src/hud.js` |

Everything is deterministic: `window.__frame(t)` in `src/main.js` seeks the paused GSAP
timeline, sets the 3D scene to the scripted state for time `t` and renders it. Nothing reads
a real clock, so any frame can be re-rendered on its own.

The 3D pipeline: PBR materials (albedo/normal/roughness), soft shadow maps, a flashlight with a
cookie, half-res ray-marched volumetric haze for the torch and the rotating alarm beams, analytic
glow around lamps, dust particles, motion blur by sub-frame accumulation, depth of field, HDR bloom,
ACES filmic tone mapping, a thriller grade that keeps yellows vivid, vignette, grain and chromatic
aberration on impacts.

## Rebuild

```bash
npm install                          # three, gsap, playwright
python3 -I scripts/gen_textures.py   # procedural PBR textures -> assets/textures/
node scripts/frames.mjs build/frames 0 900   # capture all frames (SwiftShader WebGL; ~1 h)
bash scripts/encode.sh               # synthesise audio + encode the MP4
```

Look-dev helpers: `node scripts/frames.mjs <dir> --times 9.7,13.6` renders single stills;
`src/test3d.html` + `scripts/still.mjs` render only the 3D layer.

See `credits.txt` for every asset source.
