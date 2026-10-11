// Risograph compositor: three ink layers (canvas 2D) -> WebGL -> printed look.
// Each layer canvas uses R = solid ink, G = tone (rendered as a halftone screen).
// Inks overprint multiplicatively on paper, with grainy edges, ink mottling
// and per-layer misregistration.

export const INKS = {
  blue: [0.17, 0.25, 1.0],   // electric ultramarine
  pink: [1.0, 0.31, 0.63],   // fluorescent pink
  yellow: [1.0, 0.78, 0.17], // brand yellow #FFC72C
};
const PAPER = [0.953, 0.937, 0.898];

const VS = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv = p * 0.5 + 0.5; uv.y = 1.0 - uv.y; gl_Position = vec4(p, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D tB, tP, tY;
uniform vec2 offB, offP, offY;   // misregistration in px
uniform float seed;
uniform vec3 inkB, inkP, inkY, paper;
const vec2 RES = vec2(1080.0, 1920.0);
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn(vec2 x){ vec2 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(h12(i), h12(i+vec2(1,0)), f.x), mix(h12(i+vec2(0,1)), h12(i+vec2(1,1)), f.x), f.y); }
// halftone dot screen: returns 1 where the dot covers this pixel
float screen(vec2 px, float v, float ang, float cell){
  mat2 r = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  vec2 q = r * px / cell;
  vec2 c = fract(q) - 0.5;
  float d = length(c) * 1.414;
  return 1.0 - smoothstep(sqrt(v) - 0.08, sqrt(v) + 0.08, d);
}
float ink(sampler2D t, vec2 off, float ang, float s){
  vec2 px = uv * RES;
  vec4 c = texture(t, (px - off) / RES);
  // grainy edges: perturb the coverage with fine noise before thresholding
  float n = vn(px * 0.55 + s * 13.0) * 0.6 + vn(px * 0.13 + s) * 0.4;
  float solid = smoothstep(0.42, 0.58, c.r + (n - 0.5) * 0.32);
  float tone = c.g > 0.01 ? screen(px, clamp(c.g, 0.0, 1.0), ang, 11.0) : 0.0;
  float cov = max(solid, tone);
  // ink mottling + tiny speckle holes where the drum starved
  float mott = 0.86 + 0.14 * vn(px * 0.02 + s * 3.0);
  float hole = step(0.985, h12(floor(px * 0.5) + s));
  return cov * mott * (1.0 - hole * 0.8);
}
void main(){
  vec2 px = uv * RES;
  float aB = ink(tB, offB, 0.26, 1.0);
  float aP = ink(tP, offP, 1.31, 2.0);
  float aY = ink(tY, offY, 0.0, 3.0);
  // paper: fibres + very soft vignette
  float fib = vn(px * vec2(0.9, 0.25)) * 0.03 + vn(px * 0.05) * 0.03;
  vec3 col = paper * (1.0 - fib);
  vec2 dc = uv - 0.5; col *= 1.0 - dot(dc, dc) * 0.12;
  col *= mix(vec3(1.0), inkY, aY);
  col *= mix(vec3(1.0), inkP, aP);
  col *= mix(vec3(1.0), inkB, aB);
  // print grain
  col += (h12(px + seed * 17.0) - 0.5) * 0.035;
  o = vec4(col, 1.0);
}`;

export class Riso {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
    this.gl = gl;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    this.prog = prog;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.tex = ['tB', 'tP', 'tY'].map((name, i) => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(gl.getUniformLocation(prog, name), i);
      return t;
    });
    const u = (n) => gl.getUniformLocation(prog, n);
    gl.uniform3fv(u('inkB'), INKS.blue);
    gl.uniform3fv(u('inkP'), INKS.pink);
    gl.uniform3fv(u('inkY'), INKS.yellow);
    gl.uniform3fv(u('paper'), PAPER);
    this.u = u;
  }

  draw(layers, offsets, seed) {
    const gl = this.gl;
    [layers.blue, layers.pink, layers.yellow].forEach((c, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[i]);
      const px = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, 1080, 1920).data;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1080, 1920, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
    });
    gl.uniform2fv(this.u('offB'), offsets.blue);
    gl.uniform2fv(this.u('offP'), offsets.pink);
    gl.uniform2fv(this.u('offY'), offsets.yellow);
    gl.uniform1f(this.u('seed'), seed);
    gl.viewport(0, 0, 1080, 1920);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const px = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  }
}
