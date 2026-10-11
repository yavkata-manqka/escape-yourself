// Three.js gameplay renderer. renderAt(state) draws one deterministic frame
// from a plain state object produced by shots.js; nothing reads a clock.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildRoom, POS } from './room.js';
import { Post } from './post.js';
import { mulberry32 } from './util.js';

const YELLOW = '#FFC72C';

export class Scene3D {
  constructor(canvas, W, H) {
    this.W = W; this.H = H;
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    r.setPixelRatio(1);
    r.setSize(W, H, false);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.shadowMap.autoUpdate = true;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping; // ACES filmic is applied in the final post pass
    this.renderer = r;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.06;
    this.camera = new THREE.PerspectiveCamera(72, W / H, 0.03, 30);
    this.scene.add(this.camera);
    this.post = new Post(r, W, H);
  }

  async init() {
    this.H_ = buildRoom(this.scene);
    this.buildFlashlight();
    this.buildDust();
    this.paintDial();
    this.paintUV();
    // wait for every texture to finish loading
    await new Promise((res) => {
      const check = () => (THREE.DefaultLoadingManager.itemsLoaded >= THREE.DefaultLoadingManager.itemsTotal ? res() : setTimeout(check, 50));
      THREE.DefaultLoadingManager.onLoad = res;
      check();
    });
    this.renderer.compile(this.scene, this.camera);
  }

  buildFlashlight() {
    // cookie: bright hotspot, soft ring and a dim outer spill, like a real LED torch reflector
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0.0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.2, 'rgba(255,250,240,0.92)');
    grd.addColorStop(0.36, 'rgba(255,240,215,0.62)');
    grd.addColorStop(0.5, 'rgba(255,232,200,0.32)');
    grd.addColorStop(0.75, 'rgba(255,225,190,0.14)');
    grd.addColorStop(1.0, 'rgba(0,0,0,0)');
    g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    // faint reflector imperfections
    const rnd = mulberry32(5);
    g.globalAlpha = 0.025;
    for (let i = 0; i < 12; i++) {
      g.strokeStyle = '#000'; g.lineWidth = 2 + rnd() * 3;
      g.beginPath(); g.arc(128, 128, 20 + rnd() * 90, 0, Math.PI * 2); g.stroke();
    }
    g.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const spot = new THREE.SpotLight(0xfff0d8, 0, 14, 0.42, 0.55, 1.8);
    spot.map = tex;
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0006;
    spot.shadow.normalBias = 0.01;
    spot.shadow.radius = 3;
    spot.shadow.camera.near = 0.1;
    spot.shadow.camera.far = 14;
    this.scene.add(spot);
    this.scene.add(spot.target);
    this.flash = spot;
  }

  buildDust() {
    const N = 5000;
    const rnd = mulberry32(99);
    const pos = new Float32Array(N * 3), ph = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (rnd() - 0.5) * 4.8;
      pos[i * 3 + 1] = rnd() * 2.9 + 0.05;
      pos[i * 3 + 2] = (rnd() - 0.5) * 6.8;
      ph[i * 4] = rnd() * 100; ph[i * 4 + 1] = 0.3 + rnd() * 0.7; ph[i * 4 + 2] = rnd(); ph[i * 4 + 3] = rnd();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('phase', new THREE.BufferAttribute(ph, 4));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        time: { value: 0 }, fPos: { value: new THREE.Vector3() }, fDir: { value: new THREE.Vector3() }, fCone: { value: new THREE.Vector2(0.9, 0.95) },
        fColor: { value: new THREE.Vector3() }, aColor: { value: new THREE.Vector3() }, aPos: { value: new THREE.Vector3() },
        lampColor: { value: new THREE.Vector3() }, lampPos: { value: new THREE.Vector3() }, pxScale: { value: this.H / 2 },
      },
      vertexShader: /* glsl */`
        attribute vec4 phase;
        uniform float time; uniform vec3 fPos; uniform vec3 fDir; uniform vec2 fCone; uniform vec3 fColor;
        uniform vec3 aColor; uniform vec3 aPos; uniform vec3 lampColor; uniform vec3 lampPos; uniform float pxScale;
        varying vec3 vCol;
        void main() {
          vec3 p = position;
          float t = time * phase.y;
          p += vec3(sin(t * 0.31 + phase.x) * 0.25, sin(t * 0.17 + phase.x * 1.7) * 0.18 - time * 0.006, cos(t * 0.23 + phase.x * 0.7) * 0.25);
          vec3 fv = p - fPos; float fd = length(fv);
          float fs = smoothstep(fCone.x, fCone.y, dot(fv / fd, fDir));
          vec3 c = fColor * fs / (1.0 + fd * fd * 0.5);
          float ld = length(p - lampPos);
          c += lampColor / (1.0 + ld * ld * 30.0);
          float ad = length(p - aPos);
          c += aColor / (1.0 + ad * ad * 4.0);
          float twinkle = 0.55 + 0.45 * sin(time * (2.0 + phase.z * 5.0) + phase.x);
          vCol = c * twinkle * (0.5 + phase.w);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp((0.004 + phase.w * 0.005) * pxScale / -mv.z, 1.0, 12.0);
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vCol;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.0, length(d));
          gl_FragColor = vec4(vCol * a * 0.9, 1.0);
        }`,
    });
    this.dust = new THREE.Points(geo, mat);
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);
  }

  // dial ring texture: digits 0-9 around the circumference (rotated so they read upright on the lock)
  paintDial() {
    const { canvas, ctx: g, tex } = this.H_.dialCanvas;
    const W = canvas.width, Hh = canvas.height;
    g.fillStyle = '#b8924a'; g.fillRect(0, 0, W, Hh);
    // knurled ridges between digits
    for (let i = 0; i < 40; i++) {
      g.fillStyle = i % 4 === 0 ? 'rgba(60,40,10,0.0)' : 'rgba(70,46,14,0.25)';
    }
    for (let k = 0; k < 10; k++) {
      const cx = (k + 0.5) / 10 * W;
      g.save();
      g.translate(cx, Hh / 2);
      g.rotate(Math.PI / 2);
      g.scale(1.25, 1.0);
      g.fillStyle = '#1a120a';
      g.font = '800 92px Inter';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(k), 0, 6);
      g.restore();
      g.fillStyle = 'rgba(60,40,12,0.55)';
      g.fillRect((k / 10) * W - 2, 0, 4, Hh);
    }
    tex.needsUpdate = true;
  }

  paintUV() {
    const { canvas, ctx: g, tex } = this.H_.uv.tex;
    const W = canvas.width, Hh = canvas.height;
    g.clearRect(0, 0, W, Hh);
    const draw = (txt, x, y, rot, size) => {
      g.save(); g.translate(x, y); g.rotate(rot);
      g.font = `italic 700 ${size}px "Playfair Display"`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = 'rgba(255,199,44,1)'; g.shadowBlur = 40;
      g.fillStyle = 'rgba(255,214,90,1)';
      g.fillText(txt, 0, 0);
      g.shadowBlur = 12; g.fillText(txt, 0, 0);
      g.restore();
    };
    const y = Hh * 0.47;
    draw('4', W * 0.2, y, -0.08, 250);
    draw('7', W * 0.42, y + 10, 0.05, 250);
    draw('1', W * 0.62, y - 6, -0.04, 250);
    // smeared, unreadable fourth digit
    g.save();
    g.translate(W * 0.83, y + 4);
    g.font = 'italic 700 250px "Playfair Display"';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(255,199,44,1)';
    for (let i = 0; i < 18; i++) {
      g.globalAlpha = 0.12;
      g.shadowBlur = 30;
      g.fillStyle = 'rgba(255,214,90,1)';
      g.fillText('8', i * 5 - 30, i * 7 - 50);
    }
    g.globalAlpha = 0.5;
    g.fillStyle = 'rgba(255,214,90,1)';
    g.beginPath(); g.ellipse(-10, 60, 90, 20, 0.6, 0, Math.PI * 2); g.fill();
    g.restore();
    // drips under the smear
    g.fillStyle = 'rgba(255,214,90,0.6)';
    for (let i = 0; i < 4; i++) g.fillRect(W * 0.78 + i * 22, y + 60, 6, 60 + i * 25);
    tex.needsUpdate = true;
  }

  updateKeypadDisplay(text, color) {
    const { canvas, ctx: g, tex } = this.H_.keypadDisplay;
    if (this._kpd === text + color) return;
    this._kpd = text + color;
    const W = canvas.width, Hh = canvas.height;
    g.fillStyle = '#0b0a08'; g.fillRect(0, 0, W, Hh);
    g.fillStyle = color === 'red' ? '#ff2a14' : YELLOW;
    g.font = '800 96px Inter';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = g.fillStyle; g.shadowBlur = 18;
    g.fillText(text, W / 2, Hh / 2 + 6);
    tex.needsUpdate = true;
  }

  // ------------------------------------------------------------------ state
  apply(S) {
    const H = this.H_;
    const cam = this.camera;
    cam.position.set(...S.cam.pos);
    cam.up.set(0, 1, 0);
    cam.lookAt(new THREE.Vector3(...S.cam.look));
    const sh = S.cam.shake || [0, 0];
    cam.rotateY(sh[0]);
    cam.rotateX(sh[1]);
    cam.rotateZ(S.cam.roll || 0);
    cam.fov = S.cam.fov;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    // flashlight held slightly right/below the eye, aimed at what the camera looks at
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    const fwd = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 2).negate();
    const fp = cam.position.clone().addScaledVector(right, 0.16).addScaledVector(up, -0.14).addScaledVector(fwd, 0.1);
    const aim = new THREE.Vector3(...(S.flash.aim || S.cam.look));
    this.flash.position.copy(fp);
    this.flash.target.position.copy(aim);
    this.flash.target.updateMatrixWorld();
    const uv = S.flash.uv || 0;
    const fcol = new THREE.Color(0xfff0d8).lerp(new THREE.Color(0x9a3cff), uv);
    this.flash.color.copy(fcol);
    // auto-exposure for the torch: keep the illuminance on the aimed surface roughly constant up close
    const aimDist = aim.distanceTo(fp);
    const power = THREE.MathUtils.clamp((aimDist / 2.6) ** 2, 0.004, 1);
    this.flash.intensity = S.flash.on * power * (uv > 0 ? THREE.MathUtils.lerp(240, 18, uv) : 240);
    this.flash.angle = S.flash.angle ?? 0.5;
    const fDir = aim.clone().sub(fp).normalize();

    // practical lamps
    H.pendant.light.intensity = H.pendant.base * S.lights.pendant;
    H.pendant.bulb.emissiveIntensity = 60 * S.lights.pendant;
    H.lamp.spot.intensity = H.lamp.base.spot * S.lights.lamp;
    H.lamp.glow.intensity = H.lamp.base.glow * S.lights.lamp;
    H.lamp.bulb.emissiveIntensity = 60 * S.lights.lamp;
    H.lamp.shade.emissiveIntensity = 0.06 * S.lights.lamp;
    H.pictureLight.spot.intensity = H.pictureLight.base * S.lights.picture;
    H.pictureLight.bulb.emissiveIntensity = 30 * S.lights.picture;
    const A = S.lights.alarm || 0;
    H.alarm.rot.rotation.y = S.lights.alarmAngle || 0;
    H.alarm.spots.forEach((s) => (s.intensity = 260 * A));
    H.alarm.point.intensity = 7 * A * (S.lights.alarmPulse ?? 1);
    H.alarm.dome.emissiveIntensity = 6 * A * (0.5 + 0.5 * (S.lights.alarmPulse ?? 1));
    H.keypadLight.intensity = 0.15 * (S.lights.keypad ?? 1);

    // UV reveal on the painting
    H.uv.mat.opacity = S.uvReveal || 0;
    H.uv.violet.opacity = 0.06 * uv;

    // padlock
    const dials = S.padlock.dials;
    H.padlock.dials.forEach((d, i) => { d.rotation.x = (dials[i] / 10) * Math.PI * 2; });
    H.padlock.shackle.position.y = 0.035 * S.padlock.shackle;
    H.padlock.group.rotation.z = S.padlock.rattle || 0;
    H.padlock.group.position.set(POS.padlock.x, POS.padlock.y - 0.012 * S.padlock.shackle * 0, POS.padlock.z);
    H.chest.lid.rotation.x = -(S.chest.lid || 0);
    H.chest.glow.opacity = S.chest.glow || 0;
    H.chest.light.intensity = 3 * (S.chest.glow || 0);
    if (S.key && S.key.visible) {
      H.key.group.visible = true;
      H.key.group.position.set(...S.key.pos);
      H.key.group.rotation.set(0.3, S.key.spin, 0.5);
      H.key.mat.emissiveIntensity = S.key.glow;
    } else H.key.group.visible = false;

    // keypad
    for (const k in H.keys) {
      const key = H.keys[k];
      const p = (S.keypad.pressed && S.keypad.pressed[k]) || 0;
      key.group.position.z = key.baseZ - 0.006 * p;
      key.mat.emissiveIntensity = (S.keypad.glow ?? 2.2) + 14 * p;
    }
    this.updateKeypadDisplay(S.keypad.display, S.keypad.color);

    // dust + haze uniforms
    const du = this.dust.material.uniforms;
    du.time.value = S.time;
    du.fPos.value.copy(fp);
    du.fDir.value.copy(fDir);
    const cosO = Math.cos(this.flash.angle), cosI = Math.cos(this.flash.angle * (1 - 0.55));
    du.fCone.value.set(cosO, cosI);
    const fI = S.flash.on * (1 - 0.8 * uv) * Math.sqrt(power);
    du.fColor.value.set(fcol.r, fcol.g, fcol.b).multiplyScalar(5.0 * fI);
    du.lampPos.value.copy(POS.lamp).add(new THREE.Vector3(0, 0.3, 0));
    du.lampColor.value.set(1.0, 0.7, 0.25).multiplyScalar(2.5 * S.lights.lamp);
    du.aPos.value.copy(POS.alarm);
    du.aColor.value.set(1.0, 0.08, 0.03).multiplyScalar(1.6 * A);

    // rotating alarm beam directions in world space
    H.alarm.rot.updateMatrixWorld(true);
    const aDir = (s) => s.target.getWorldPosition(new THREE.Vector3()).sub(s.getWorldPosition(new THREE.Vector3())).normalize();
    const pendantPos = POS.pendant.clone();
    const lampPos = POS.lamp.clone().add(new THREE.Vector3(0, 0.3, 0));
    const picPos = POS.painting.clone().add(new THREE.Vector3(-0.2, 0.75, 0));
    this.fogU = {
      haze: S.haze ?? 0.05,
      time: S.time,
      fPos: fp, fDir, fCone: new THREE.Vector2(cosO, cosI),
      fColor: new THREE.Vector3(fcol.r, fcol.g, fcol.b).multiplyScalar(0.9 * fI),
      aPos: POS.alarm.clone().add(new THREE.Vector3(0, -0.08, 0)),
      aDir0: aDir(H.alarm.spots[0]), aDir1: aDir(H.alarm.spots[1]),
      aCone: new THREE.Vector2(Math.cos(0.5), Math.cos(0.5 * 0.45)),
      aColor: new THREE.Vector3(1.0, 0.07, 0.03).multiplyScalar(0.9 * A),
      pPos: [pendantPos, lampPos, picPos, POS.alarm.clone(), POS.chest.clone().add(new THREE.Vector3(0, 0.6, 0.1))],
      pCol: [
        new THREE.Vector3(1.0, 0.62, 0.25).multiplyScalar(1.4 * S.lights.pendant),
        new THREE.Vector3(1.0, 0.68, 0.22).multiplyScalar(0.9 * S.lights.lamp),
        new THREE.Vector3(1.0, 0.7, 0.3).multiplyScalar(0.5 * S.lights.picture),
        new THREE.Vector3(1.0, 0.06, 0.02).multiplyScalar(1.0 * A * (S.lights.alarmPulse ?? 1)),
        new THREE.Vector3(1.0, 0.75, 0.2).multiplyScalar(1.5 * (S.chest.glow || 0)),
      ],
    };
  }

  // Render a frame; `states` are motion-blur sub-frame states, `center` carries post settings.
  render(states, center) {
    const n = states.length;
    states.forEach((S, i) => {
      this.apply(S);
      this.post.accumulate(this.scene, this.camera, this.fogU, 1 / n, i === 0);
    });
    // re-apply the centre sub-frame so the depth buffer used by DOF matches it closely
    this.post.finish(this.camera, center.post);
  }
}
