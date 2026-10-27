// 3D layer for the finals teaser: a dark-glass map of Bulgaria, 52 team lights,
// the "wall" where teams go dark in waves, and the line-up of 8 gold light columns.
// Everything is a pure function of time t (seconds); nothing reads a clock.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { T } from './timeline.js';

const W = 1080, H = 1920;
const GOLD = new THREE.Color(1.0, 0.72, 0.18);

// ------------------------------------------------------------------ helpers
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const range = (x, a, b) => clamp((x - a) / (b - a));
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = (t) => Math.pow(clamp(t), 3);
export const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const backOut = (t, s = 1.8) => { t = clamp(t) - 1; return t * t * ((s + 1) * t + s) + 1; };
const lerp = (a, b, t) => a + (b - a) * t;
const v3lerp = (a, b, t) => new THREE.Vector3(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
function mulberry32(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash = (n) => mulberry32(n * 7919 + 13)();

// ------------------------------------------------------------------ geography
const LAT0 = 42.73, LON0 = 25.45, S = 1.25, K = Math.cos((LAT0 * Math.PI) / 180);
const proj = (lon, lat) => [(lon - LON0) * K * S, -(lat - LAT0) * S]; // -> world x, z
export const CITIES = [
  { name: 'София', lon: 23.32, lat: 42.70, teams: 16 },
  { name: 'Пловдив', lon: 24.75, lat: 42.15, teams: 11 },
  { name: 'Велико Търново', lon: 25.63, lat: 43.08, teams: 7 },
  { name: 'Варна', lon: 27.91, lat: 43.21, teams: 10 },
  { name: 'Бургас', lon: 27.47, lat: 42.50, teams: 8 },
];
const MAP_H = 0.22;

export class Scene3D {
  constructor(canvas) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1);
    r.setSize(W, H, false);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = r;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030304);
    scene.fog = new THREE.FogExp2(0x030304, 0.045);
    const pm = new THREE.PMREMGenerator(r);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.25;
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(50, W / H, 0.05, 80);

    // lights: a warm rim from behind and a cold key from the front
    const rim = new THREE.DirectionalLight(0xffc04a, 3.0); rim.position.set(-3, 4, -6); scene.add(rim);
    const key = new THREE.DirectionalLight(0xdfe6ff, 0.6); key.position.set(2, 6, 6); scene.add(key);
    scene.add(new THREE.AmbientLight(0x221a10, 0.6));

    this.buildMap();
    this.buildTeams();
    this.buildArena();
    this.buildDust();

    const comp = new EffectComposer(r);
    comp.setPixelRatio(1);
    comp.setSize(W, H);
    comp.addPass(new RenderPass(scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.6, 0.45, 0.92);
    comp.addPass(this.bloom);
    comp.addPass(new OutputPass());
    this.grade = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, seed: { value: 0 }, vig: { value: 0.65 }, grain: { value: 0.045 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float seed; uniform float vig; uniform float grain; varying vec2 vUv;
        float h(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        void main(){
          vec2 d = vUv - 0.5;
          // gentle chromatic fringe at the edges
          float ca = dot(d, d) * 0.006;
          vec3 c = vec3(texture2D(tDiffuse, vUv + d * ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - d * ca).b);
          c *= mix(1.0, smoothstep(0.95, 0.25, length(d * vec2(1.0, 0.8))), vig);
          c += (h(gl_FragCoord.xy + seed * 37.0) - 0.5) * grain;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    comp.addPass(this.grade);
    this.composer = comp;
  }

  // ---------------------------------------------------------------- map of Bulgaria
  async loadMap() {
    const gj = await (await fetch('../assets/data/bulgaria_ne10m.geojson')).json();
    const ring = (gj.geometry.type === 'Polygon' ? gj.geometry.coordinates : gj.geometry.coordinates[0])[0];
    const pts = ring.map(([lon, lat]) => proj(lon, lat));
    const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: MAP_H, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshPhysicalMaterial({ color: 0x0c0c0f, metalness: 0.7, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.3, envMapIntensity: 0.12, transparent: true });
    this.mapMesh = new THREE.Mesh(geo, mat);
    this.mapGroup.add(this.mapMesh);
    // gold outline (fat line) + a travelling pulse along it
    const flat = [];
    pts.forEach(([x, z]) => flat.push(x, MAP_H + 0.035, z));
    this.outlinePts = pts;
    const lg = new LineGeometry(); lg.setPositions(flat);
    this.outlineMat = new LineMaterial({ color: 0xffffff, linewidth: 2.5, transparent: true, resolution: new THREE.Vector2(W, H) });
    this.outlineMat.color.setRGB(1.1, 0.75, 0.18);
    const outline = new Line2(lg, this.outlineMat); outline.computeLineDistances();
    this.mapGroup.add(outline);
    this.pulseGeo = new LineGeometry();
    this.pulseMat = new LineMaterial({ color: 0xffffff, linewidth: 5, transparent: true, resolution: new THREE.Vector2(W, H) });
    this.pulseMat.color.setRGB(2.6, 1.9, 0.6);
    this.pulse = new Line2(this.pulseGeo, this.pulseMat);
    this.mapGroup.add(this.pulse);
  }

  buildMap() {
    this.mapGroup = new THREE.Group();
    this.scene.add(this.mapGroup);
  }

  // ---------------------------------------------------------------- 52 teams
  buildTeams() {
    const rnd = mulberry32(2026);
    const teams = [];
    CITIES.forEach((c, ci) => {
      const [cx, cz] = proj(c.lon, c.lat);
      for (let j = 0; j < c.teams; j++) {
        const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 0.32;
        teams.push({ ci, j, map: [cx + Math.cos(a) * rr, MAP_H + 0.07, cz + Math.sin(a) * rr * 0.8] });
      }
    });
    this.N = teams.length; // 52
    // wall: 4 columns x 13 rows, standing up, facing the camera
    const order = teams.map((_, i) => i).sort((a, b) => hash(a + 5) - hash(b + 5));
    // wall: 7 columns x 8 rows (52 of 56 cells), standing up, facing the camera
    order.forEach((ti, k) => {
      const col = k % 7, row = Math.floor(k / 7);
      teams[ti].wall = [(col - 3) * 0.5, 3.6 + (3.5 - row) * 0.5, -0.4];
    });
    // the 8 survivors and the wave in which each other team goes dark
    const elim = teams.map((_, i) => i).sort((a, b) => hash(a + 99) - hash(b + 99));
    const survivors = elim.slice(0, 8);
    const rest = elim.slice(8); // 44 -> waves of 14, 14, 10, 6
    const waveSizes = [14, 14, 10, 6];
    let p = 0;
    waveSizes.forEach((n, w) => { for (let i = 0; i < n; i++) teams[rest[p++]].wave = w; });
    survivors.forEach((ti, k) => { teams[ti].survivor = k; teams[ti].wave = -1; });
    this.teams = teams;
    this.survivors = survivors;
    const geo = new THREE.SphereGeometry(1, 20, 14);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: true });
    this.teamMesh = new THREE.InstancedMesh(geo, mat, this.N);
    this.teamMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < this.N; i++) this.teamMesh.setColorAt(i, new THREE.Color(0, 0, 0));
    this.teamMesh.frustumCulled = false;
    this.scene.add(this.teamMesh);
  }

  // ---------------------------------------------------------------- arena: floor + 8 light columns
  buildArena() {
    const g = new THREE.Group();
    this.arena = g;
    this.scene.add(g);
    // dark reflective floor with a faint gold grid
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, 512, 512);
    x.strokeStyle = 'rgba(255,190,60,0.35)'; x.lineWidth = 2;
    for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 512); x.stroke(); x.beginPath(); x.moveTo(0, i * 64); x.lineTo(512, i * 64); x.stroke(); }
    const gt = new THREE.CanvasTexture(c); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(12, 12); gt.anisotropy = 8;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x070707, metalness: 0.85, roughness: 0.32, emissive: 0xffffff, emissiveMap: gt, emissiveIntensity: 0.0 }));
    floor.rotation.x = -Math.PI / 2;
    g.add(floor);
    this.floor = floor;
    // columns in a semicircle (championship line-up)
    this.columns = [];
    const colMat = () => new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { glow: { value: 0 }, core: { value: 0 } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float glow; uniform float core; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){
          float edge = pow(1.0 - abs(dot(vN, vV)), 1.6);
          float fade = pow(1.0 - vUv.y, 1.4);
          float a = (0.05 + edge * 0.5) * fade * glow;
          vec3 col = vec3(1.0, 0.68, 0.16) * (0.9 + core * 1.6);
          gl_FragColor = vec4(col * a, 1.0);
        }`,
    });
    const emblemTex = this.makeEmblem();
    for (let i = 0; i < 8; i++) {
      const a = lerp(-1.05, 1.05, i / 7);
      const R = 3.3;
      const pos = [Math.sin(a) * R, 0, -2.4 + -Math.cos(a) * R * 0.55 + 1.2];
      const grp = new THREE.Group();
      grp.position.set(...pos);
      const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 9, 32, 1, true), colMat());
      outer.position.y = 4.5;
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 9, 16, 1, true), colMat());
      inner.position.y = 4.5;
      inner.material.uniforms.core.value = 1;
      const pool = new THREE.Mesh(new THREE.CircleGeometry(1.1, 48), new THREE.MeshBasicMaterial({ map: this.radial(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(0.9, 0.55, 0.12) }));
      pool.rotation.x = -Math.PI / 2; pool.position.y = 0.01;
      const emblem = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.1), new THREE.MeshBasicMaterial({ map: emblemTex, transparent: true, depthWrite: false, color: new THREE.Color(1.4, 1.1, 0.7) }));
      emblem.position.y = 1.7;
      grp.add(outer, inner, pool, emblem);
      g.add(grp);
      this.columns.push({ grp, outer, inner, pool, emblem, pos });
    }
  }

  radial() {
    if (this._radial) return this._radial;
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
    this._radial = new THREE.CanvasTexture(c);
    return this._radial;
  }

  makeEmblem() {
    const c = document.createElement('canvas'); c.width = 380; c.height = 440;
    const x = c.getContext('2d');
    const shield = () => { x.beginPath(); x.moveTo(190, 18); x.lineTo(352, 78); x.lineTo(338, 250); x.quadraticCurveTo(310, 360, 190, 420); x.quadraticCurveTo(70, 360, 42, 250); x.lineTo(28, 78); x.closePath(); };
    const gr = x.createLinearGradient(0, 0, 0, 440);
    gr.addColorStop(0, '#2a2418'); gr.addColorStop(1, '#0b0a08');
    shield(); x.fillStyle = gr; x.fill();
    const gold = x.createLinearGradient(0, 0, 380, 440);
    gold.addColorStop(0, '#fff2c4'); gold.addColorStop(0.45, '#FFC72C'); gold.addColorStop(1, '#a8740a');
    shield(); x.lineWidth = 16; x.strokeStyle = gold; x.stroke();
    x.font = '700 230px Oswald'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = gold; x.fillText('?', 190, 236);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  }

  buildDust() {
    const n = 1400, rnd = mulberry32(7);
    const pos = new Float32Array(n * 3), ph = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = (rnd() - 0.5) * 14; pos[i * 3 + 1] = rnd() * 9; pos[i * 3 + 2] = (rnd() - 0.5) * 14; ph[i] = rnd() * 100; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
    this.dust = new THREE.Points(geo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { t: { value: 0 }, amt: { value: 0.5 } },
      vertexShader: `attribute float ph; uniform float t; varying float vA;
        void main(){ vec3 p = position + vec3(sin(t*0.3+ph)*0.3, mod(t*0.15+ph, 9.0) - position.y*0.0, cos(t*0.25+ph)*0.3);
          p.y = mod(position.y + t * 0.18 + ph * 0.1, 9.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(26.0 / -mv.z, 1.0, 9.0); vA = 0.5 + 0.5 * sin(t * 2.0 + ph); }`,
      fragmentShader: `uniform float amt; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(1.0, 0.75, 0.3) * 0.9 * a * vA * amt, 1.0); }`,
    }));
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);
  }

  // ---------------------------------------------------------------- camera path
  cameraAt(t) {
    // [time, pos, look, fov]
    const keys = [
      [0.0, [0.2, 11.2, 10.2], [0, 0, 0.9], 46],
      [T.rise, [-0.1, 10.0, 9.0], [0, 0.1, 0.8], 46],
      [T.rise + 1.8, [0.0, 3.4, 9.6], [0, 3.75, -0.4], 50],
      [T.lineup - 0.2, [0.0, 3.4, 8.9], [0, 3.75, -0.4], 50],
    ];
    if (t < T.lineup) {
      let i = 0; while (i < keys.length - 2 && t >= keys[i + 1][0]) i++;
      const [t0, p0, l0, f0] = keys[i], [t1, p1, l1, f1] = keys[i + 1];
      const k = easeInOut(range(t, t0, t1));
      return { pos: v3lerp(p0, p1, k), look: v3lerp(l0, l1, k), fov: lerp(f0, f1, k) };
    }
    if (t < T.flythrough) { // slow orbit around the line-up
      const k = range(t, T.lineup, T.flythrough);
      const a = lerp(-0.22, 0.18, easeInOut(k));
      const R = lerp(7.6, 6.6, k);
      return { pos: new THREE.Vector3(Math.sin(a) * R, lerp(1.9, 1.5, k), -0.6 + Math.cos(a) * R), look: new THREE.Vector3(0, 1.7, -0.9), fov: 52 };
    }
    if (t < T.finalHit) { // accelerate through the middle of the line-up
      const k = easeIn(range(t, T.flythrough, T.finalHit));
      return { pos: v3lerp([0, 1.5, 6.0], [0, 1.7, -2.6], k), look: new THREE.Vector3(0, 1.8, -9), fov: lerp(52, 74, k) };
    }
    // after the hit: wide hero shot of the line-up, slow push
    const k = range(t, T.finalHit, T.endCard);
    return { pos: v3lerp([0, 2.6, 7.6], [0, 2.3, 6.4], easeOut(k)), look: new THREE.Vector3(0, 2.2, -1.0), fov: 54 };
  }

  // ---------------------------------------------------------------- frame
  render(t) {
    const cam = this.camera;
    const c = this.cameraAt(t);
    cam.position.copy(c.pos); cam.fov = c.fov; cam.updateProjectionMatrix(); cam.lookAt(c.look);

    // map: visible until the line-up, outline pulse travels around the border
    const mapA = 1 - range(t, T.rise + 0.4, T.rise + 1.6);
    this.mapGroup.visible = mapA > 0.001;
    this.mapGroup.position.y = -1.5 * easeIn(range(t, T.rise + 0.4, T.rise + 1.6));
    if (this.mapMesh) {
      this.mapMesh.material.opacity = mapA;
      const ob = easeOut(range(t, 0.2, 2.2));
      this.outlineMat.opacity = ob * mapA;
      // pulse: a bright segment running round the border twice in the intro, then calmer
      const n = this.outlinePts.length;
      const head = Math.floor(((t * 0.42) % 1) * n);
      const seg = [];
      for (let k = -40; k <= 0; k++) { const [x, z] = this.outlinePts[(head + k + n) % n]; seg.push(x, MAP_H + 0.04, z); }
      this.pulseGeo.setPositions(seg);
      this.pulse.computeLineDistances();
      this.pulseMat.opacity = ob * mapA;
    }

    // teams
    const m = new THREE.Matrix4(), col = new THREE.Color();
    this.teams.forEach((tm, i) => {
      // appear per city, one city per beat
      const tApp = T.teams + tm.ci * 0.25 + tm.j * 0.02;
      const app = backOut(range(t, tApp, tApp + 0.3), 2.4);
      let p = new THREE.Vector3(...tm.map);
      let r = 0.05 * app, bright = 1.35 * clamp(app);
      // rise into the wall
      const riseT = T.rise + (i % 13) * 0.03;
      const kr = easeInOut(range(t, riseT, riseT + 1.4));
      if (kr > 0) { p = v3lerp(tm.map, tm.wall, kr); r = lerp(0.05, 0.1, kr); }
      // waves: non-survivors flicker and go dark
      if (tm.wave >= 0) {
        const tw = T.waves[tm.wave];
        if (t >= tw) {
          const k = range(t, tw, tw + 0.25);
          const flick = (Math.floor(t * 30) % 2 === 0 && k < 0.6) ? 0.35 : 1;
          bright *= (1 - k) * flick;
          r *= 1 - 0.5 * k;
        }
      } else if (t >= T.waves[4]) {
        // survivors flare, then fly to their column
        bright *= 1 + 1.5 * Math.exp(-(t - T.waves[4]) * 3);
        const s = tm.survivor;
        const tf = T.lineup + s * T.columnStep;
        const kf = easeInOut(range(t, tf - 0.5, tf));
        if (kf > 0) {
          const target = [this.columns[s].pos[0], 1.7, this.columns[s].pos[2]];
          p = v3lerp(tm.wall, target, kf);
        }
        if (t >= tf) { r = 0; }
      }
      m.compose(p, new THREE.Quaternion(), new THREE.Vector3(r, r, r));
      this.teamMesh.setMatrixAt(i, m);
      col.copy(GOLD).multiplyScalar(bright);
      if (tm.survivor !== undefined && t >= T.waves[4]) col.setRGB(1.7 * bright / 1.35, 1.35 * bright / 1.35, 0.8 * bright / 1.35);
      this.teamMesh.setColorAt(i, col);
    });
    this.teamMesh.instanceMatrix.needsUpdate = true;
    this.teamMesh.instanceColor.needsUpdate = true;

    // arena + columns
    const arenaA = range(t, T.lineup - 0.5, T.lineup + 0.4);
    this.arena.visible = arenaA > 0;
    this.floor.material.emissiveIntensity = 0.06 * arenaA + (t >= T.finalHit ? 0.08 * Math.exp(-(t - T.finalHit) * 1.5) : 0);
    this.columns.forEach((c, i) => {
      const tc = T.lineup + i * T.columnStep;
      const k = easeOut(range(t, tc, tc + 0.35));
      const burst = t >= tc ? Math.exp(-(t - tc) * 4) : 0;
      const hit = t >= T.finalHit ? 1.6 * Math.exp(-(t - T.finalHit) * 1.2) : 0;
      const breathe = 0.9 + 0.1 * Math.sin(t * 2.4 + i);
      const g = k * (breathe + burst * 1.5 + hit);
      c.outer.material.uniforms.glow.value = g;
      c.inner.material.uniforms.glow.value = g;
      c.outer.scale.y = c.inner.scale.y = 0.2 + 0.8 * k;
      c.outer.position.y = c.inner.position.y = 4.5 * (0.2 + 0.8 * k);
      c.pool.material.opacity = k * (0.8 + burst);
      c.emblem.material.opacity = backOut(range(t, tc + 0.15, tc + 0.5));
      c.emblem.scale.setScalar(0.6 + 0.4 * backOut(range(t, tc + 0.15, tc + 0.5)));
      c.emblem.position.y = 1.7 + 0.06 * Math.sin(t * 1.6 + i * 0.8);
      c.emblem.lookAt(cam.position.x, c.emblem.getWorldPosition(new THREE.Vector3()).y, cam.position.z);
    });

    // dust
    this.dust.material.uniforms.t.value = t;
    this.dust.material.uniforms.amt.value = 0.45 + (t >= T.finalHit ? 1.2 * Math.exp(-(t - T.finalHit) * 0.8) : 0) + 0.3 * range(t, T.lineup, T.lineup + 1);

    this.bloom.strength = 0.6 + (t >= T.finalHit ? 0.5 * Math.exp(-(t - T.finalHit) * 2) : 0);
    this.grade.uniforms.seed.value = Math.floor(t * 30);
    this.composer.render();
    const gl = this.renderer.getContext();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  }

  // screen position of each city (for the DOM labels)
  cityScreen() {
    return CITIES.map((c) => {
      const [x, z] = proj(c.lon, c.lat);
      const v = new THREE.Vector3(x, MAP_H + 0.1 + this.mapGroup.position.y, z).project(this.camera);
      return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H];
    });
  }
}
