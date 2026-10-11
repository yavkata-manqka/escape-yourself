// Custom HDR post-processing chain, driven explicitly per frame (no clocks).
//   scene -> [volumetric haze, half res] -> composite -> accumulate (motion blur)
//         -> depth of field -> bloom -> ACES filmic + sRGB + thriller grade
import * as THREE from 'three';

const VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function fsMaterial(frag, uniforms, opts = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: frag, uniforms,
    depthTest: false, depthWrite: false, ...opts,
  });
}

const NOISE = /* glsl */`
float hash13(vec3 p3) { p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
}`;

const FOG_FRAG = /* glsl */`
uniform sampler2D tDepth;
uniform mat4 projInv; uniform mat4 camWorld;
uniform vec3 camPos;
uniform float haze; uniform float time; uniform float seed;
uniform vec3 fPos; uniform vec3 fDir; uniform vec2 fCone; uniform vec3 fColor;
uniform vec3 aPos; uniform vec3 aDir0; uniform vec3 aDir1; uniform vec2 aCone; uniform vec3 aColor;
uniform vec3 pPos[5]; uniform vec3 pCol[5];
varying vec2 vUv;
${NOISE}
void main() {
  float d = texture2D(tDepth, vUv).x;
  vec4 v = projInv * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  v /= v.w;
  vec3 wp = (camWorld * vec4(v.xyz, 1.0)).xyz;
  vec3 rd = wp - camPos;
  float L = min(length(rd), 14.0);
  rd = normalize(rd);
  vec3 acc = vec3(0.0);
  // analytic in-scatter from point lights: integral of 1/r^2 along the ray
  for (int i = 0; i < 5; i++) {
    vec3 lp = pPos[i] - camPos;
    float t0 = dot(lp, rd);
    float h = max(length(lp - rd * t0), 0.03);
    float I = (atan((L - t0) / h) + atan(t0 / h)) / h;
    acc += pCol[i] * I;
  }
  acc *= haze * 0.02;
  // ray-marched spot cones (flashlight + rotating alarm) with drifting dust density
  const int N = 20;
  float jitter = hash12(gl_FragCoord.xy + seed * 17.0);
  float stepL = min(L, 9.0) / float(N);
  vec3 sc = vec3(0.0);
  for (int i = 0; i < N; i++) {
    float s = (float(i) + jitter) * stepL;
    vec3 p = camPos + rd * s;
    float dens = 0.55 + 0.9 * vnoise(p * 2.3 + vec3(0.0, time * 0.07, time * 0.04)) * vnoise(p * 0.7 - time * 0.03);
    vec3 fv = p - fPos; float fd = length(fv);
    float fs = smoothstep(fCone.x, fCone.y, dot(fv / fd, fDir));
    sc += fColor * fs * dens / (1.0 + fd * fd * 0.35);
    vec3 av = p - aPos; float ad = length(av);
    vec3 an = av / ad;
    float as0 = smoothstep(aCone.x, aCone.y, dot(an, aDir0));
    float as1 = smoothstep(aCone.x, aCone.y, dot(an, aDir1));
    sc += aColor * (as0 + as1) * dens / (1.0 + ad * ad * 0.25);
  }
  acc += sc * stepL * haze;
  gl_FragColor = vec4(acc, 1.0);
}`;

const COMPOSITE_FRAG = /* glsl */`
uniform sampler2D tColor; uniform sampler2D tFog; uniform float weight;
varying vec2 vUv;
void main() { gl_FragColor = vec4((texture2D(tColor, vUv).rgb + texture2D(tFog, vUv).rgb) * weight, 1.0); }`;

const DOF_FRAG = /* glsl */`
uniform sampler2D tColor; uniform sampler2D tDepth;
uniform float near; uniform float far; uniform float focus; uniform float aperture; uniform float maxBlur;
uniform vec2 texel;
varying vec2 vUv;
float linZ(float d) { float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
float coc(float z) { return clamp(abs(1.0 / focus - 1.0 / z) * aperture, 0.0, maxBlur); }
void main() {
  vec3 acc = texture2D(tColor, vUv).rgb; float wsum = 1.0;
  const int N = 40;
  for (int i = 1; i < N; i++) {
    float r = sqrt(float(i) / float(N)) * maxBlur;
    float a = float(i) * 2.39996;
    vec2 off = vec2(cos(a), sin(a)) * r * texel;
    float cs = coc(linZ(texture2D(tDepth, vUv + off).x));
    // a tap contributes when its own circle of confusion reaches the centre pixel
    float w = smoothstep(r - 1.5, r + 0.5, cs);
    acc += texture2D(tColor, vUv + off).rgb * w; wsum += w;
  }
  gl_FragColor = vec4(acc / wsum, 1.0);
}`;

const BRIGHT_FRAG = /* glsl */`
uniform sampler2D tColor; uniform float threshold; uniform vec2 texel;
varying vec2 vUv;
void main() {
  vec3 c = vec3(0.0);
  c += texture2D(tColor, vUv + texel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(tColor, vUv + texel * vec2( 1.0, -1.0)).rgb;
  c += texture2D(tColor, vUv + texel * vec2(-1.0,  1.0)).rgb;
  c += texture2D(tColor, vUv + texel * vec2( 1.0,  1.0)).rgb;
  c *= 0.25;
  float l = max(c.r, max(c.g, c.b));
  float k = max(l - threshold, 0.0); k = k * k / (l + 1e-4) ;
  gl_FragColor = vec4(min(c * (k / max(l, 1e-4)) , vec3(60.0)), 1.0);
}`;

const DOWN_FRAG = /* glsl */`
uniform sampler2D tColor; uniform vec2 texel;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tColor, vUv).rgb * 0.5;
  c += texture2D(tColor, vUv + texel * vec2(-1.0, -1.0)).rgb * 0.125;
  c += texture2D(tColor, vUv + texel * vec2( 1.0, -1.0)).rgb * 0.125;
  c += texture2D(tColor, vUv + texel * vec2(-1.0,  1.0)).rgb * 0.125;
  c += texture2D(tColor, vUv + texel * vec2( 1.0,  1.0)).rgb * 0.125;
  gl_FragColor = vec4(c, 1.0);
}`;

const UP_FRAG = /* glsl */`
uniform sampler2D tColor; uniform sampler2D tLow; uniform vec2 texel; uniform float lowWeight;
varying vec2 vUv;
void main() {
  vec3 c = vec3(0.0);
  c += texture2D(tLow, vUv + texel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(tLow, vUv + texel * vec2( 0.0, -1.0)).rgb * 2.0;
  c += texture2D(tLow, vUv + texel * vec2( 1.0, -1.0)).rgb;
  c += texture2D(tLow, vUv + texel * vec2(-1.0,  0.0)).rgb * 2.0;
  c += texture2D(tLow, vUv).rgb * 4.0;
  c += texture2D(tLow, vUv + texel * vec2( 1.0,  0.0)).rgb * 2.0;
  c += texture2D(tLow, vUv + texel * vec2(-1.0,  1.0)).rgb;
  c += texture2D(tLow, vUv + texel * vec2( 0.0,  1.0)).rgb * 2.0;
  c += texture2D(tLow, vUv + texel * vec2( 1.0,  1.0)).rgb;
  gl_FragColor = vec4(texture2D(tColor, vUv).rgb + c / 16.0 * lowWeight, 1.0);
}`;

const FINAL_FRAG = /* glsl */`
uniform sampler2D tColor; uniform sampler2D tBloom;
uniform float exposure; uniform float bloom; uniform float ca; uniform float vignette; uniform float grain;
uniform float seed; uniform float saturation; uniform float contrast; uniform float redVig; uniform float redFlash;
uniform float freeze; uniform float glitch; uniform float glitchSeed; uniform float fade; uniform vec2 res;
varying vec2 vUv;
${NOISE}
vec3 RRTAndODTFit(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 ACESFilmic(vec3 color) {
  const mat3 ACESInputMat = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 ACESOutputMat = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color *= 1.0 / 0.6;
  color = ACESInputMat * color; color = RRTAndODTFit(color); color = ACESOutputMat * color;
  return clamp(color, 0.0, 1.0);
}
vec3 sRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 sampleHDR(vec2 uv) { return texture2D(tColor, uv).rgb + texture2D(tBloom, uv).rgb * bloom; }
void main() {
  vec2 uv = vUv;
  // glitch: horizontal band displacement
  if (glitch > 0.0) {
    float band = floor(uv.y * 38.0 + glitchSeed * 3.0);
    float h = hash12(vec2(band, floor(glitchSeed * 10.0)));
    if (h < glitch * 0.6) uv.x += (hash12(vec2(band, glitchSeed)) - 0.5) * 0.12 * glitch;
  }
  vec2 dc = uv - 0.5;
  float r2 = dot(dc, dc);
  vec2 off = dc * ca * (0.4 + r2 * 2.0);
  vec3 col;
  col.r = sampleHDR(uv + off).r;
  col.g = sampleHDR(uv).g;
  col.b = sampleHDR(uv - off).b;
  col *= exposure;
  col = ACESFilmic(col);
  col = sRGB(col);
  // thriller grade: contrast S-curve around mid grey, desaturate except yellow/amber
  col = clamp((col - 0.5) * contrast + 0.5, 0.0, 1.0);
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.35);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float mx = max(col.r, max(col.g, col.b)), mn = min(col.r, min(col.g, col.b));
  float sat = (mx - mn) / (mx + 1e-4);
  // hue proxy for yellow/amber: red high, green fairly high, blue low
  float yellow = smoothstep(0.25, 0.6, sat) * smoothstep(0.35, 0.7, col.g / (col.r + 1e-4)) * (1.0 - smoothstep(0.85, 1.0, col.g / (col.r + 1e-4)) * 0.0);
  float redness = smoothstep(0.4, 0.8, sat) * (1.0 - smoothstep(0.15, 0.45, col.g / (col.r + 1e-4)));
  float s = mix(saturation, 1.12, max(yellow, redness));
  col = mix(vec3(l), col, s);
  // warm blacks (no teal in the shadows)
  col += vec3(0.010, 0.006, 0.0) * (1.0 - l);
  // vignette
  float vig = smoothstep(0.95, 0.25, sqrt(r2) * 1.25);
  col *= mix(1.0, vig, vignette);
  // red danger vignette + flash
  float edge = smoothstep(0.18, 0.62, sqrt(r2));
  col = mix(col, vec3(0.86, 0.06, 0.03), edge * redVig);
  col = mix(col, vec3(0.9, 0.05, 0.02), redFlash * 0.55);
  // freeze-frame treatment for the pause menu
  float lf = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(lf) * 0.42, freeze);
  // film grain (luminance weighted)
  float gn = hash12(gl_FragCoord.xy + vec2(seed * 91.7, seed * 13.3)) - 0.5;
  gn += hash12(gl_FragCoord.xy * 0.5 + vec2(seed * 7.1, seed * 3.9)) - 0.5;
  col += gn * grain * (0.35 + 0.65 * (1.0 - lf));
  col *= fade;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export class Post {
  constructor(renderer, W, H) {
    this.r = renderer; this.W = W; this.H = H;
    const hf = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false };
    this.depthTex = new THREE.DepthTexture(W, H, THREE.UnsignedIntType);
    this.sceneRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4, depthTexture: this.depthTex });
    this.sceneRT.resolveDepthBuffer = true;
    this.fogRT = new THREE.WebGLRenderTarget(W / 2, H / 2, hf);
    this.accumRT = new THREE.WebGLRenderTarget(W, H, hf);
    this.dofRT = new THREE.WebGLRenderTarget(W, H, hf);
    this.mips = [];
    let w = W / 2, h = H / 2;
    for (let i = 0; i < 6; i++) {
      this.mips.push(new THREE.WebGLRenderTarget(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), hf));
      w /= 2; h /= 2;
    }
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.quad = new THREE.Mesh(tri);
    this.quad.frustumCulled = false;
    this.qscene = new THREE.Scene();
    this.qscene.add(this.quad);

    const v3 = () => new THREE.Vector3();
    this.fog = fsMaterial(FOG_FRAG, {
      tDepth: { value: this.depthTex }, projInv: { value: new THREE.Matrix4() }, camWorld: { value: new THREE.Matrix4() },
      camPos: { value: v3() }, haze: { value: 0 }, time: { value: 0 }, seed: { value: 0 },
      fPos: { value: v3() }, fDir: { value: v3() }, fCone: { value: new THREE.Vector2(0.9, 0.95) }, fColor: { value: v3() },
      aPos: { value: v3() }, aDir0: { value: v3() }, aDir1: { value: v3() }, aCone: { value: new THREE.Vector2(0.9, 0.95) }, aColor: { value: v3() },
      pPos: { value: [v3(), v3(), v3(), v3(), v3()] }, pCol: { value: [v3(), v3(), v3(), v3(), v3()] },
    });
    this.composite = fsMaterial(COMPOSITE_FRAG, { tColor: { value: null }, tFog: { value: this.fogRT.texture }, weight: { value: 1 } }, {
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, transparent: true,
    });
    this.dof = fsMaterial(DOF_FRAG, {
      tColor: { value: this.accumRT.texture }, tDepth: { value: this.depthTex }, near: { value: 0.05 }, far: { value: 30 },
      focus: { value: 2 }, aperture: { value: 0 }, maxBlur: { value: 18 }, texel: { value: new THREE.Vector2(1 / W, 1 / H) },
    });
    this.bright = fsMaterial(BRIGHT_FRAG, { tColor: { value: null }, threshold: { value: 1.0 }, texel: { value: new THREE.Vector2(1 / W, 1 / H) } });
    this.down = fsMaterial(DOWN_FRAG, { tColor: { value: null }, texel: { value: new THREE.Vector2() } });
    this.up = fsMaterial(UP_FRAG, { tColor: { value: null }, tLow: { value: null }, texel: { value: new THREE.Vector2() }, lowWeight: { value: 1 } });
    this.final = fsMaterial(FINAL_FRAG, {
      tColor: { value: null }, tBloom: { value: this.mips[0].texture },
      exposure: { value: 1 }, bloom: { value: 0.5 }, ca: { value: 0 }, vignette: { value: 0.6 }, grain: { value: 0.05 },
      seed: { value: 0 }, saturation: { value: 0.8 }, contrast: { value: 1.15 }, redVig: { value: 0 }, redFlash: { value: 0 },
      freeze: { value: 0 }, glitch: { value: 0 }, glitchSeed: { value: 0 }, fade: { value: 1 }, res: { value: new THREE.Vector2(W, H) },
    });
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.qscene, this.cam);
  }

  // Render one sub-frame of the scene (+ haze) and add it into the accumulation buffer.
  accumulate(scene, camera, fogU, weight, first) {
    const r = this.r;
    r.setRenderTarget(this.sceneRT);
    r.clear(true, true, true);
    r.render(scene, camera);
    // haze
    const u = this.fog.uniforms;
    camera.updateMatrixWorld();
    u.projInv.value.copy(camera.projectionMatrixInverse);
    u.camWorld.value.copy(camera.matrixWorld);
    u.camPos.value.setFromMatrixPosition(camera.matrixWorld);
    for (const k in fogU) {
      if (u[k] === undefined) continue;
      const val = fogU[k];
      if (Array.isArray(val)) val.forEach((x, i) => u[k].value[i].copy(x));
      else if (val && val.isVector3) u[k].value.copy(val);
      else if (val && val.isVector2) u[k].value.copy(val);
      else u[k].value = val;
    }
    this.pass(this.fog, this.fogRT);
    // composite into accumulation
    this.composite.uniforms.tColor.value = this.sceneRT.texture;
    this.composite.uniforms.weight.value = weight;
    r.setRenderTarget(this.accumRT);
    if (first) { r.setClearColor(0x000000, 1); r.clear(true, false, false); }
    this.quad.material = this.composite;
    r.render(this.qscene, this.cam);
  }

  finish(camera, P) {
    let src = this.accumRT;
    if (P.aperture > 0) {
      const u = this.dof.uniforms;
      u.near.value = camera.near; u.far.value = camera.far;
      u.focus.value = P.focus; u.aperture.value = P.aperture; u.maxBlur.value = P.maxBlur ?? 18;
      this.pass(this.dof, this.dofRT);
      src = this.dofRT;
    }
    // bloom
    this.bright.uniforms.tColor.value = src.texture;
    this.bright.uniforms.threshold.value = P.bloomThreshold ?? 1.0;
    this.pass(this.bright, this.mips[0]);
    for (let i = 1; i < this.mips.length; i++) {
      this.down.uniforms.tColor.value = this.mips[i - 1].texture;
      this.down.uniforms.texel.value.set(1 / this.mips[i - 1].width, 1 / this.mips[i - 1].height);
      this.pass(this.down, this.mips[i]);
    }
    // upsample: add lower mip into higher mip (in place via ping: write to temporary using blending)
    for (let i = this.mips.length - 1; i > 0; i--) {
      this.up.uniforms.tColor.value = this.mips[i - 1].texture;
      this.up.uniforms.tLow.value = this.mips[i].texture;
      this.up.uniforms.texel.value.set(1 / this.mips[i].width, 1 / this.mips[i].height);
      this.up.uniforms.lowWeight.value = 1.0;
      // render into a scratch target of the same size, then swap
      if (!this['scratch' + i]) this['scratch' + i] = this.mips[i - 1].clone();
      const s = this['scratch' + i];
      this.pass(this.up, s);
      const tmp = this.mips[i - 1]; this.mips[i - 1] = s; this['scratch' + i] = tmp;
    }
    const f = this.final.uniforms;
    f.tColor.value = src.texture;
    f.tBloom.value = this.mips[0].texture;
    for (const k of ['exposure', 'bloom', 'ca', 'vignette', 'grain', 'seed', 'saturation', 'contrast', 'redVig', 'redFlash', 'freeze', 'glitch', 'glitchSeed', 'fade']) {
      if (P[k] !== undefined) f[k].value = P[k];
    }
    this.pass(this.final, null);
  }
}
