// Builds the detective's-office escape room: geometry, PBR materials and lights.
// Everything here is static; per-frame state (dial values, light levels, etc.)
// is applied by scene3d.js through the handles returned from buildRoom().
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from './util.js';

const TEX = '../assets/textures/';

export const ROOM = { w: 5.0, d: 7.0, h: 3.0 }; // x: -2.5..2.5, z: -3.5..3.5

export const POS = {
  door: new THREE.Vector3(0.8, 0, -3.5),
  keypad: new THREE.Vector3(1.6, 1.38, -3.47),
  chest: new THREE.Vector3(-1.25, 0, -2.85),
  padlock: new THREE.Vector3(-1.25, 0.40, -2.535),
  painting: new THREE.Vector3(2.47, 1.95, -1.25),
  desk: new THREE.Vector3(2.08, 0, -1.25),
  lamp: new THREE.Vector3(2.2, 0.76, -1.78),
  papers: new THREE.Vector3(1.95, 0.762, -1.12),
  shelf: new THREE.Vector3(-2.3, 0, -1.4),
  pendant: new THREE.Vector3(-0.1, 2.42, -0.3),
  alarm: new THREE.Vector3(0.2, 2.97, -2.6),
};

function loadTex(loader, name, { srgb = false, repeat = [1, 1], aniso = 8 } = {}) {
  const t = loader.load(TEX + name);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function pbr(loader, base, { repeat = [1, 1], rough = true, normalScale = 1, ...rest } = {}) {
  const m = new THREE.MeshStandardMaterial({
    map: loadTex(loader, `${base}_albedo.jpg`, { srgb: true, repeat }),
    normalMap: loadTex(loader, `${base}_normal.jpg`, { repeat }),
    roughnessMap: rough ? loadTex(loader, `${base}_rough.jpg`, { repeat }) : null,
    roughness: 1,
    ...rest,
  });
  m.normalScale.set(normalScale, normalScale);
  return m;
}

// Box UVs scaled to world size so textures keep a consistent texel density.
function worldUVBox(geo, scale = 1) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    let u, v;
    if (nx > 0.5) { u = z; v = y; } else if (ny > 0.5) { u = x; v = z; } else { u = x; v = y; }
    uv.setXY(i, u * scale, v * scale);
  }
  uv.needsUpdate = true;
  return geo;
}

function rbox(w, h, d, r = 0.01, seg = 2) {
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
}

function mesh(geo, mat, x = 0, y = 0, z = 0, { cast = true, receive = true, parent } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = receive;
  if (parent) parent.add(m);
  return m;
}

function canvasTexture(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return { tex: t, canvas: c, ctx: g };
}

export function buildRoom(scene) {
  const loader = new THREE.TextureLoader();
  const rand = mulberry32(1234);
  const H = {}; // handles

  // ---------------------------------------------------------------- materials
  const M = {};
  M.floor = pbr(loader, 'floor', { repeat: [1, 1], normalScale: 0.9 });
  M.plaster = pbr(loader, 'plaster', { repeat: [1, 1], normalScale: 0.8 });
  M.plaster.color.set(0xd8cdb6);
  M.ceiling = pbr(loader, 'plaster', { repeat: [1, 1], normalScale: 0.6 });
  M.ceiling.color.set(0x8f8676);
  M.wood = pbr(loader, 'darkwood', { repeat: [1, 1], normalScale: 0.8 });
  M.woodGloss = pbr(loader, 'darkwood', { repeat: [1, 1], normalScale: 0.5 });
  M.woodGloss.roughnessMap = null; M.woodGloss.roughness = 0.32;
  M.steel = pbr(loader, 'steel', { repeat: [1, 1], metalness: 0.75, normalScale: 0.7 });
  M.brass = pbr(loader, 'brass', { repeat: [1, 1], metalness: 1.0, normalScale: 0.6 });
  M.brassDark = M.brass.clone(); M.brassDark.color = new THREE.Color(0x9a7a48);
  M.paper = new THREE.MeshStandardMaterial({
    map: loadTex(loader, 'paper_albedo.jpg', { srgb: true }),
    normalMap: loadTex(loader, 'paper_normal.jpg'), roughness: 0.9, side: THREE.DoubleSide,
  });
  M.books = new THREE.MeshStandardMaterial({
    map: loadTex(loader, 'books_albedo.jpg', { srgb: true }),
    normalMap: loadTex(loader, 'books_normal.jpg'),
    roughnessMap: loadTex(loader, 'books_rough.jpg'), roughness: 1,
  });
  M.books.map.wrapS = M.books.map.wrapT = THREE.ClampToEdgeWrapping;
  M.rug = new THREE.MeshStandardMaterial({
    map: loadTex(loader, 'rug_albedo.jpg', { srgb: true }),
    normalMap: loadTex(loader, 'rug_normal.jpg'), roughness: 0.97,
  });
  M.painting = new THREE.MeshStandardMaterial({
    map: loadTex(loader, 'painting_albedo.jpg', { srgb: true }),
    normalMap: loadTex(loader, 'painting_normal.jpg'), roughness: 0.55,
  });
  M.black = new THREE.MeshStandardMaterial({ color: 0x0c0b0a, roughness: 0.55, metalness: 0.2 });
  M.rubber = new THREE.MeshStandardMaterial({ color: 0x141312, roughness: 0.7 });
  M.glassAmber = new THREE.MeshPhysicalMaterial({
    color: 0xffb72c, roughness: 0.15, metalness: 0, transmission: 0, emissive: 0xffa31a, emissiveIntensity: 0,
    clearcoat: 1, clearcoatRoughness: 0.1,
  });
  M.bulb = new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffc56a, emissiveIntensity: 40 });
  M.alarmDome = new THREE.MeshPhysicalMaterial({
    color: 0x5a0a06, emissive: 0xff1a0a, emissiveIntensity: 0, roughness: 0.2, clearcoat: 1, transparent: true, opacity: 0.92,
  });

  // ---------------------------------------------------------------- shell
  const { w, d, h } = ROOM;
  const floorGeo = new THREE.PlaneGeometry(w, d);
  floorGeo.attributes.uv.array.forEach((v, i, a) => { a[i] = v * (i % 2 === 0 ? w / 2.2 : d / 2.2); });
  const floor = mesh(floorGeo, M.floor, 0, 0, 0, { cast: false });
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const ceilGeo = new THREE.PlaneGeometry(w, d);
  ceilGeo.attributes.uv.array.forEach((v, i, a) => { a[i] = v * 2.5; });
  const ceil = mesh(ceilGeo, M.ceiling, 0, h, 0, { cast: false });
  ceil.rotation.x = Math.PI / 2;
  scene.add(ceil);

  const wains = 0.95;
  const addWall = (len, x, z, ry) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = ry;
    const up = new THREE.PlaneGeometry(len, h - wains);
    up.attributes.uv.array.forEach((v, i, a) => { a[i] = v * (i % 2 === 0 ? len / 1.6 : (h - wains) / 1.6); });
    mesh(up, M.plaster, 0, wains + (h - wains) / 2, 0, { cast: false, parent: g });
    // wainscot panels
    const back = worldUVBox(new THREE.BoxGeometry(len, wains, 0.02), 0.8);
    mesh(back, M.wood, 0, wains / 2, 0.01, { cast: false, parent: g });
    const nPanels = Math.max(1, Math.round(len / 0.85));
    const pw = len / nPanels;
    for (let i = 0; i < nPanels; i++) {
      const px = -len / 2 + pw * (i + 0.5);
      const frame = worldUVBox(rbox(pw - 0.12, wains - 0.3, 0.025, 0.008), 0.9);
      mesh(frame, M.woodGloss, px, wains / 2 + 0.02, 0.03, { cast: false, parent: g });
    }
    mesh(worldUVBox(rbox(len, 0.06, 0.05, 0.012), 0.8), M.woodGloss, 0, wains, 0.035, { parent: g }); // chair rail
    mesh(worldUVBox(rbox(len, 0.14, 0.03, 0.008), 0.8), M.wood, 0, 0.07, 0.035, { parent: g }); // baseboard
    mesh(worldUVBox(rbox(len, 0.12, 0.08, 0.02), 0.8), M.wood, 0, h - 0.06, 0.04, { parent: g }); // crown
    scene.add(g);
    return g;
  };
  addWall(w, 0, -d / 2, 0); // back (exit door)
  addWall(w, 0, d / 2, Math.PI); // front (entrance)
  addWall(d, -w / 2, 0, Math.PI / 2); // left
  addWall(d, w / 2, 0, -Math.PI / 2); // right

  // rug
  const rug = mesh(new THREE.PlaneGeometry(2.2, 3.3), M.rug, -0.15, 0.006, -0.6, { cast: false });
  rug.rotation.x = -Math.PI / 2;
  scene.add(rug);

  // ---------------------------------------------------------------- exit door (back wall)
  {
    const g = new THREE.Group();
    g.position.copy(POS.door);
    const dw = 1.02, dh = 2.18;
    // frame
    const fr = 0.08;
    mesh(rbox(fr, dh + fr, 0.16, 0.01), M.steel, -dw / 2 - fr / 2, (dh + fr) / 2, 0.05, { parent: g });
    mesh(rbox(fr, dh + fr, 0.16, 0.01), M.steel, dw / 2 + fr / 2, (dh + fr) / 2, 0.05, { parent: g });
    mesh(rbox(dw + 2 * fr, fr, 0.16, 0.01), M.steel, 0, dh + fr / 2, 0.05, { parent: g });
    // slab
    const slab = mesh(rbox(dw, dh, 0.07, 0.012, 3), M.steel, 0, dh / 2, 0.04, { parent: g });
    // raised panels
    mesh(rbox(dw - 0.22, 0.85, 0.02, 0.01), M.steel, 0, 1.55, 0.085, { parent: g });
    mesh(rbox(dw - 0.22, 0.85, 0.02, 0.01), M.steel, 0, 0.55, 0.085, { parent: g });
    // rivets
    const rivGeo = new THREE.SphereGeometry(0.009, 10, 6);
    const rivets = [];
    for (let i = 0; i < 12; i++) {
      const y = 0.1 + i * (dh - 0.2) / 11;
      rivets.push([-dw / 2 + 0.04, y], [dw / 2 - 0.04, y]);
    }
    for (let i = 0; i < 8; i++) {
      const x = -dw / 2 + 0.04 + i * (dw - 0.08) / 7;
      rivets.push([x, 0.06], [x, dh - 0.06], [x, 1.1]);
    }
    const riv = new THREE.InstancedMesh(rivGeo, M.steel, rivets.length);
    const mtx = new THREE.Matrix4();
    rivets.forEach(([x, y], i) => { mtx.makeTranslation(x, y, 0.078); riv.setMatrixAt(i, mtx); });
    riv.castShadow = true; riv.receiveShadow = true;
    g.add(riv);
    // heavy lever handle
    const hb = mesh(rbox(0.06, 0.16, 0.03, 0.01), M.steel, -dw / 2 + 0.12, 1.05, 0.09, { parent: g });
    const lever = mesh(rbox(0.2, 0.035, 0.035, 0.015), M.steel, -dw / 2 + 0.2, 1.05, 0.12, { parent: g });
    // hinges
    for (const y of [0.3, 1.1, 1.9]) mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 16), M.steel, dw / 2 + 0.01, y, 0.08, { parent: g });
    // warning stripe at the bottom (yellow/black), very subtle
    scene.add(g);
    H.door = g; H.doorSlab = slab;
  }

  // ---------------------------------------------------------------- keypad
  {
    const g = new THREE.Group();
    g.position.copy(POS.keypad);
    const bw = 0.17, bh = 0.27;
    mesh(rbox(bw, bh, 0.035, 0.012, 3), M.steel, 0, 0, 0.0, { parent: g });
    mesh(rbox(bw - 0.02, bh - 0.02, 0.01, 0.006), M.black, 0, 0, 0.02, { parent: g });
    // display
    const disp = canvasTexture(512, 128, () => {});
    H.keypadDisplay = disp;
    const dispMat = new THREE.MeshBasicMaterial({ map: disp.tex, toneMapped: true });
    const dm = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.034), dispMat);
    dm.position.set(0, 0.095, 0.0265);
    g.add(dm);
    H.keypadDisplayMat = dispMat;
    // buttons
    const labels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
    H.keys = {};
    const capGeo = rbox(0.036, 0.03, 0.014, 0.006, 3);
    labels.forEach((lab, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const lt = canvasTexture(128, 128, (c, W, Hh) => {
        c.fillStyle = '#000'; c.fillRect(0, 0, W, Hh);
        c.fillStyle = '#fff';
        c.font = '800 84px Inter';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(lab, W / 2, Hh / 2 + 6);
      }, false);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x111010, roughness: 0.45, metalness: 0.1,
        emissive: 0xffc72c, emissiveMap: lt.tex, emissiveIntensity: 2.2,
      });
      const cap = new THREE.Mesh(capGeo, [mat]);
      // apply the label only to the front face via a decal plane
      cap.material = new THREE.MeshStandardMaterial({ color: 0x121110, roughness: 0.5, metalness: 0.15 });
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.025), mat);
      face.position.z = 0.0072;
      const bg = new THREE.Group();
      bg.add(cap); bg.add(face);
      bg.position.set(-0.048 + col * 0.048, 0.045 - row * 0.04, 0.03);
      cap.castShadow = true;
      g.add(bg);
      H.keys[lab] = { group: bg, mat, baseZ: 0.03 };
    });
    const kl = new THREE.PointLight(0xffc72c, 0.02, 0.6, 2);
    kl.position.set(0, 0, 0.12);
    g.add(kl);
    H.keypadLight = kl;
    scene.add(g);
    H.keypad = g;
  }

  // ---------------------------------------------------------------- bookshelf (left wall)
  {
    const g = new THREE.Group();
    g.position.copy(POS.shelf);
    g.rotation.y = Math.PI / 2; // front faces +x
    const sw = 2.0, sh = 2.45, sd = 0.38, t = 0.035;
    const W = (geo) => worldUVBox(geo, 2.2);
    mesh(W(rbox(t, sh, sd, 0.006)), M.wood, -sw / 2 + t / 2, sh / 2, 0, { parent: g });
    mesh(W(rbox(t, sh, sd, 0.006)), M.wood, sw / 2 - t / 2, sh / 2, 0, { parent: g });
    mesh(W(rbox(t, sh, sd, 0.006)), M.wood, 0, sh / 2, 0, { parent: g });
    mesh(W(rbox(sw, 0.02, sd, 0.004)), M.wood, 0, sh / 2, -sd / 2 + 0.01, { parent: g }).scale.y = sh / 0.02;
    mesh(W(rbox(sw + 0.06, 0.06, sd + 0.04, 0.012)), M.woodGloss, 0, sh + 0.03, 0.01, { parent: g });
    mesh(W(rbox(sw, 0.1, sd, 0.008)), M.wood, 0, 0.05, 0, { parent: g });
    const nShelves = 6;
    const books = [];
    const bookGeos = [];
    for (let s = 0; s < nShelves; s++) {
      const y = 0.1 + s * (sh - 0.12) / nShelves;
      mesh(W(rbox(sw - 2 * t, 0.028, sd - 0.02, 0.005)), M.woodGloss, 0, y, 0.005, { parent: g });
      // fill each half with books
      for (const half of [-1, 1]) {
        let x = half < 0 ? -sw / 2 + t + 0.01 : t / 2 + 0.01;
        const xEnd = half < 0 ? -t / 2 - 0.01 : sw / 2 - t - 0.01;
        const shelfH = (sh - 0.12) / nShelves - 0.04;
        while (x < xEnd - 0.03) {
          const r = rand();
          if (r < 0.05 && x < xEnd - 0.25) { x += 0.06 + rand() * 0.1; continue; } // gap
          const bw = 0.022 + rand() * 0.035;
          const bh = Math.min(shelfH, 0.19 + rand() * 0.12);
          const bd = 0.17 + rand() * 0.1;
          if (x + bw > xEnd) break;
          const lean = (rand() < 0.08) ? (rand() - 0.5) * 0.25 : 0;
          const geo = new THREE.BoxGeometry(bw, bh, bd);
          const col = Math.floor(rand() * 16);
          // spine faces +z (front of the shelf group)
          const uv = geo.attributes.uv;
          for (let i = 0; i < uv.count; i++) {
            const u = uv.getX(i), v = uv.getY(i);
            const face = Math.floor(i / 4);
            if (face === 4) uv.setXY(i, (col + 0.04 + u * 0.92) / 16, v * 0.98 + 0.01);
            else uv.setXY(i, (col + 0.4 + u * 0.2) / 16, 0.5 + v * 0.02);
          }
          geo.rotateZ(lean);
          geo.translate(x + bw / 2, y + 0.014 + bh / 2, sd / 2 - bd / 2 - 0.01 - rand() * 0.02);
          bookGeos.push(geo);
          x += bw + 0.002;
        }
      }
    }
    const merged = mergeGeometries(bookGeos);
    const bm = mesh(merged, M.books, 0, 0, 0, { parent: g });
    // a few lying books and objects on top
    scene.add(g);
    H.shelf = g;
  }

  // ---------------------------------------------------------------- desk + props
  {
    const g = new THREE.Group();
    g.position.copy(POS.desk);
    g.rotation.y = -Math.PI / 2; // front faces -x
    const dw = 1.55, dd = 0.78, dh = 0.76;
    const W = (geo) => worldUVBox(geo, 2.2);
    mesh(W(rbox(dw, 0.045, dd, 0.012, 3)), M.woodGloss, 0, dh - 0.022, 0, { parent: g });
    // pedestals
    for (const sx of [-1, 1]) {
      mesh(W(rbox(0.42, dh - 0.05, dd - 0.06, 0.01)), M.wood, sx * (dw / 2 - 0.24), (dh - 0.05) / 2, 0, { parent: g });
      for (let k = 0; k < 3; k++) {
        const yy = 0.14 + k * 0.2;
        mesh(W(rbox(0.38, 0.17, 0.02, 0.008)), M.woodGloss, sx * (dw / 2 - 0.24), yy, (dd - 0.06) / 2 + 0.008, { parent: g });
        mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 10).rotateZ(Math.PI / 2), M.brass, sx * (dw / 2 - 0.24), yy + 0.03, (dd - 0.06) / 2 + 0.03, { parent: g });
      }
    }
    mesh(W(rbox(dw - 0.9, 0.12, 0.02, 0.006)), M.woodGloss, 0, dh - 0.1, dd / 2 - 0.04, { parent: g });
    mesh(W(rbox(dw - 0.9, dh - 0.1, 0.02, 0.006)), M.wood, 0, (dh - 0.1) / 2, -dd / 2 + 0.04, { parent: g });
    // leather writing pad
    const pad = mesh(rbox(0.7, 0.006, 0.45, 0.003), new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.6 }), 0, dh + 0.003, 0.05, { parent: g });
    scene.add(g);
    H.desk = g;

    // papers scattered (world space)
    const papers = new THREE.Group();
    papers.position.copy(POS.papers);
    const pr = mulberry32(77);
    for (let i = 0; i < 7; i++) {
      const pg = new THREE.PlaneGeometry(0.21, 0.297, 4, 4);
      // slight curl
      const p = pg.attributes.position;
      for (let k = 0; k < p.count; k++) p.setZ(k, 0.004 * Math.sin(p.getX(k) * 12) + 0.003 * Math.cos(p.getY(k) * 9));
      pg.computeVertexNormals();
      const u = pg.attributes.uv;
      const ox = (i % 2) * 0.5, oy = (Math.floor(i / 2) % 2) * 0.5;
      for (let k = 0; k < u.count; k++) u.setXY(k, ox + u.getX(k) * 0.5, oy + u.getY(k) * 0.5);
      const m = mesh(pg, M.paper, (pr() - 0.5) * 0.4, 0.002 + i * 0.0015, (pr() - 0.5) * 0.45, { parent: papers });
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = (pr() - 0.5) * 1.2;
    }
    // a photo with a yellow sticky note
    const note = mesh(new THREE.PlaneGeometry(0.075, 0.075), new THREE.MeshStandardMaterial({ color: 0xffc72c, roughness: 0.8 }), 0.06, 0.016, -0.04, { parent: papers });
    note.rotation.x = -Math.PI / 2; note.rotation.z = 0.3;
    // magnifying glass
    const mg = new THREE.Group();
    mesh(new THREE.TorusGeometry(0.055, 0.007, 12, 40), M.brass, 0, 0, 0, { parent: mg });
    const lens = mesh(new THREE.CircleGeometry(0.055, 40), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transmission: 0, transparent: true, opacity: 0.18, clearcoat: 1 }), 0, 0, 0, { parent: mg });
    mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.12, 12).rotateZ(Math.PI / 2), M.wood, 0.115, 0, 0, { parent: mg });
    mg.rotation.x = -Math.PI / 2;
    mg.position.set(-0.17, 0.02, 0.16);
    mg.rotation.z = 0.7;
    papers.add(mg);
    // fountain pen
    mesh(new THREE.CylinderGeometry(0.006, 0.005, 0.14, 12).rotateZ(Math.PI / 2), M.black, 0.15, 0.016, 0.15, { parent: papers }).rotation.y = 0.5;
    scene.add(papers);
    H.papers = papers;

    // closed books stack on desk
    const st = new THREE.Group();
    st.position.set(POS.desk.x + 0.12, 0.76, POS.desk.z + 0.6);
    const sc = [0x3a1612, 0x2a221a, 0x5a3a1e];
    sc.forEach((c, i) => {
      mesh(rbox(0.24 - i * 0.02, 0.045, 0.17 - i * 0.01, 0.006), new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }), 0, 0.023 + i * 0.045, 0, { parent: st }).rotation.y = (i - 1) * 0.12;
    });
    scene.add(st);
  }

  // ---------------------------------------------------------------- banker's lamp
  {
    const g = new THREE.Group();
    g.position.copy(POS.lamp);
    g.rotation.y = -Math.PI / 2;
    mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.025, 32), M.brass, 0, 0.0125, 0, { parent: g });
    mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.3, 12), M.brass, 0, 0.17, -0.02, { parent: g });
    mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.16, 12).rotateX(Math.PI / 2), M.brass, 0, 0.32, 0.04, { parent: g });
    // shade: half-cylinder of amber glass
    const shadeGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.34, 32, 1, true, Math.PI / 2, Math.PI);
    shadeGeo.rotateZ(Math.PI / 2);
    const shade = mesh(shadeGeo, M.glassAmber, 0, 0.33, 0.08, { parent: g });
    M.glassAmber.side = THREE.DoubleSide;
    const bulb = mesh(new THREE.SphereGeometry(0.022, 16, 12), M.bulb.clone(), 0, 0.3, 0.08, { parent: g, cast: false });
    const spot = new THREE.SpotLight(0xffc04a, 30, 4.0, 1.05, 0.7, 2);
    spot.position.set(0, 0.28, 0.08);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0008;
    spot.shadow.radius = 4;
    spot.shadow.camera.near = 0.05;
    g.add(spot);
    const tgt = new THREE.Object3D(); tgt.position.set(0, 0, 0.3); g.add(tgt); spot.target = tgt;
    const glow = new THREE.PointLight(0xffb43a, 2.0, 4.0, 2);
    glow.position.set(0, 0.36, 0.08);
    g.add(glow);
    scene.add(g);
    H.lamp = { spot, glow, bulb: bulb.material, shade: M.glassAmber, base: { spot: 30, glow: 2.0 } };
  }

  // ---------------------------------------------------------------- painting + picture light (right wall)
  {
    const g = new THREE.Group();
    g.position.copy(POS.painting);
    g.rotation.y = -Math.PI / 2; // faces -x
    const pw = 0.9, ph = 1.2;
    mesh(new THREE.PlaneGeometry(pw, ph), M.painting, 0, 0, 0.0, { parent: g, cast: false });
    // gilded frame from four mitred-ish beveled bars
    const fw = 0.1;
    const gild = M.brass.clone(); gild.color = new THREE.Color(0xd8b878); gild.roughness = 0.9;
    const bars = [
      [pw + 2 * fw, fw, 0, ph / 2 + fw / 2],
      [pw + 2 * fw, fw, 0, -ph / 2 - fw / 2],
      [fw, ph, -pw / 2 - fw / 2, 0],
      [fw, ph, pw / 2 + fw / 2, 0],
    ];
    for (const [bw, bh, x, y] of bars) {
      mesh(rbox(bw, bh, 0.05, 0.018, 3), gild, x, y, 0.0, { parent: g });
      mesh(rbox(bw === fw ? 0.025 : bw - 0.12, bw === fw ? bh : 0.025, 0.065, 0.01, 2), gild, x + (bw === fw ? Math.sign(x) * -0.035 : 0), y + (bw === fw ? 0 : Math.sign(y) * -0.035), 0.005, { parent: g });
    }
    // UV-revealed digits overlay (texture painted in scene3d once fonts are ready)
    const uvTex = canvasTexture(768, 1024, () => {});
    const uvMat = new THREE.MeshBasicMaterial({ map: uvTex.tex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const uvPlane = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), uvMat);
    uvPlane.position.z = 0.003;
    g.add(uvPlane);
    const violetMat = new THREE.MeshBasicMaterial({ color: 0x7b3cff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const violet = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), violetMat);
    violet.position.z = 0.002;
    g.add(violet);
    H.uv = { tex: uvTex, mat: uvMat, violet: violetMat };
    // picture light
    const pl = new THREE.Group();
    pl.position.set(0, ph / 2 + fw + 0.12, 0.12);
    mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.5, 24, 1, false, 0, Math.PI * 1.2).rotateZ(Math.PI / 2), M.brass, 0, 0, 0.03, { parent: pl });
    mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 10).rotateX(Math.PI / 2.6), M.brass, 0, 0.03, -0.06, { parent: pl });
    const pbulb = mesh(new THREE.BoxGeometry(0.44, 0.01, 0.01), M.bulb.clone(), 0, -0.022, 0.03, { parent: pl, cast: false });
    g.add(pl);
    const ps = new THREE.SpotLight(0xffc35a, 34, 4.0, 0.9, 0.9, 2);
    ps.position.set(0, ph / 2 + fw + 0.1, 0.2);
    const pt = new THREE.Object3D(); pt.position.set(0, -0.2, 0); g.add(pt);
    ps.target = pt;
    g.add(ps);
    scene.add(g);
    H.pictureLight = { spot: ps, bulb: pbulb.material, base: 34 };
    H.painting = g;
  }

  // ---------------------------------------------------------------- pendant Edison bulb
  {
    const g = new THREE.Group();
    g.position.copy(POS.pendant);
    mesh(new THREE.CylinderGeometry(0.004, 0.004, ROOM.h - POS.pendant.y, 6), M.black, 0, (ROOM.h - POS.pendant.y) / 2 + 0.06, 0, { parent: g });
    mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.06, 16), M.brass, 0, 0.05, 0, { parent: g });
    const bulb = mesh(new THREE.SphereGeometry(0.04, 20, 14), M.bulb.clone(), 0, 0, 0, { parent: g, cast: false });
    bulb.scale.y = 1.25;
    const pl = new THREE.PointLight(0xffb44a, 9, 12, 2);
    pl.position.set(0, -0.06, 0);
    g.add(pl);
    scene.add(g);
    H.pendant = { light: pl, bulb: bulb.material, base: 9 };
  }

  // ---------------------------------------------------------------- chest + padlock
  {
    const g = new THREE.Group();
    g.position.copy(POS.chest);
    g.rotation.y = 0.0;
    const cw = 0.92, ch = 0.42, cd = 0.55;
    const W = (geo) => worldUVBox(geo, 2.4);
    mesh(W(rbox(cw, ch, cd, 0.02, 3)), M.wood, 0, ch / 2 + 0.02, 0, { parent: g });
    // lid (pivot at back edge)
    const lid = new THREE.Group();
    lid.position.set(0, ch + 0.02, -cd / 2);
    const lidGeo = new THREE.CylinderGeometry(cd / 2, cd / 2, cw, 32, 1, false, 0, Math.PI);
    lidGeo.rotateZ(Math.PI / 2); lidGeo.rotateX(Math.PI / 2);
    // flatten the barrel lid a little
    lidGeo.scale(1, 0.45, 1);
    const lidMesh = mesh(lidGeo, M.wood, 0, 0, cd / 2, { parent: lid });
    lidMesh.rotation.x = 0;
    // brass bands on the lid
    for (const x of [-cw / 2 + 0.08, cw / 2 - 0.08]) {
      const bg = new THREE.CylinderGeometry(cd / 2 + 0.006, cd / 2 + 0.006, 0.05, 32, 1, true, 0, Math.PI);
      bg.rotateZ(Math.PI / 2); bg.rotateX(Math.PI / 2); bg.scale(1, 0.45, 1);
      mesh(bg, M.brassDark, x, 0, cd / 2, { parent: lid });
    }
    g.add(lid);
    // brass corner bands on the body
    for (const x of [-cw / 2 + 0.08, cw / 2 - 0.08]) {
      mesh(rbox(0.05, ch + 0.01, cd + 0.012, 0.004), M.brassDark, x, ch / 2 + 0.02, 0, { parent: g });
    }
    mesh(rbox(cw + 0.012, 0.04, cd + 0.012, 0.004), M.brassDark, 0, 0.04, 0, { parent: g });
    // feet
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(new THREE.SphereGeometry(0.03, 12, 8), M.brassDark, sx * (cw / 2 - 0.05), 0.02, sz * (cd / 2 - 0.05), { parent: g });
    // hasp plate
    mesh(rbox(0.11, 0.16, 0.014, 0.004), M.brassDark, 0, ch - 0.02, cd / 2 + 0.006, { parent: g });
    // inner glow (visible when the lid cracks open)
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffc72c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(cw - 0.06, cd - 0.06), glowMat);
    glow.rotation.x = -Math.PI / 2; glow.position.y = ch + 0.015;
    g.add(glow);
    const chestLight = new THREE.PointLight(0xffc72c, 0, 2.0, 2);
    chestLight.position.set(0, ch + 0.15, 0.1);
    g.add(chestLight);
    scene.add(g);
    H.chest = { group: g, lid, glow: glowMat, light: chestLight };

    // padlock
    const p = new THREE.Group();
    p.position.copy(POS.padlock);
    // polished brass body: smooth, without the tarnish map that reads as noise at macro distance
    const lockBrass = new THREE.MeshStandardMaterial({ color: 0xc9a05a, metalness: 1, roughness: 0.32, normalMap: M.brass.normalMap });
    lockBrass.normalScale.set(0.3, 0.3);
    const body = mesh(rbox(0.1, 0.12, 0.04, 0.012, 3), lockBrass, 0, 0, 0, { parent: p });
    // shackle
    const sh = new THREE.Group();
    const shTop = new THREE.TorusGeometry(0.03, 0.007, 12, 24, Math.PI);
    mesh(shTop, M.steel, 0, 0.1, 0, { parent: sh });
    mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.06, 12), M.steel, -0.03, 0.07, 0, { parent: sh });
    mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.06, 12), M.steel, 0.03, 0.07, 0, { parent: sh });
    p.add(sh);
    // dials: 4 cylinders along x, rotating around x
    const dialTex = canvasTexture(1024, 256, () => {}, true);
    H.dialCanvas = dialTex;
    const dialMat = new THREE.MeshStandardMaterial({ map: dialTex.tex, metalness: 0.6, roughness: 0.38, color: 0xffffff });
    const dials = [];
    for (let i = 0; i < 4; i++) {
      const dg = new THREE.CylinderGeometry(0.0145, 0.0145, 0.018, 40);
      dg.rotateZ(Math.PI / 2);
      const dial = mesh(dg, [dialMat, lockBrass, lockBrass], -0.03 + i * 0.02, -0.022, 0.024, { parent: p });
      dials.push(dial);
    }
    // window plate around dials
    mesh(rbox(0.092, 0.04, 0.012, 0.004), M.black, 0, -0.022, 0.014, { parent: p });
    scene.add(p);
    H.padlock = { group: p, shackle: sh, dials, body };

    // key (hidden inside the chest until it opens)
    const key = new THREE.Group();
    const keyMat = new THREE.MeshStandardMaterial({ color: 0xffd36a, metalness: 1, roughness: 0.25, emissive: 0xffc72c, emissiveIntensity: 0 });
    mesh(new THREE.TorusGeometry(0.025, 0.006, 10, 28), keyMat, 0, 0, 0, { parent: key });
    mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.11, 10).rotateZ(Math.PI / 2), keyMat, 0.08, 0, 0, { parent: key });
    mesh(new THREE.BoxGeometry(0.008, 0.022, 0.004), keyMat, 0.125, -0.01, 0, { parent: key });
    mesh(new THREE.BoxGeometry(0.008, 0.016, 0.004), keyMat, 0.108, -0.008, 0, { parent: key });
    key.visible = false;
    scene.add(key);
    H.key = { group: key, mat: keyMat };
  }

  // ---------------------------------------------------------------- red alarm beacon (ceiling)
  {
    const g = new THREE.Group();
    g.position.copy(POS.alarm);
    mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.04, 28), M.black, 0, -0.02, 0, { parent: g });
    const dome = mesh(new THREE.SphereGeometry(0.085, 28, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.alarmDome, 0, -0.04, 0, { parent: g, cast: false });
    const rot = new THREE.Group();
    rot.position.y = -0.08;
    g.add(rot);
    const spot = new THREE.SpotLight(0xff1a0a, 0, 9, 0.5, 0.6, 1.6);
    const tgt = new THREE.Object3D(); tgt.position.set(1, -0.35, 0); rot.add(tgt);
    spot.target = tgt;
    rot.add(spot);
    const spot2 = new THREE.SpotLight(0xff1a0a, 0, 9, 0.5, 0.6, 1.6);
    const tgt2 = new THREE.Object3D(); tgt2.position.set(-1, -0.35, 0); rot.add(tgt2);
    spot2.target = tgt2;
    rot.add(spot2);
    const pl = new THREE.PointLight(0xff200c, 0, 8, 1.6);
    pl.position.y = -0.2;
    g.add(pl);
    scene.add(g);
    H.alarm = { group: g, rot, spots: [spot, spot2], point: pl, dome: M.alarmDome };
  }

  // ---------------------------------------------------------------- misc props: coat stand + wall clock
  {
    // wall clock above the door frame side
    const g = new THREE.Group();
    g.position.set(-0.55, 2.25, -3.47);
    mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 40).rotateX(Math.PI / 2), M.woodGloss, 0, 0, 0.02, { parent: g });
    const face = canvasTexture(256, 256, (c, w2) => {
      c.fillStyle = '#d9cdb1'; c.beginPath(); c.arc(128, 128, 126, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#1a1612'; c.lineWidth = 6;
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        c.beginPath(); c.moveTo(128 + Math.sin(a) * 100, 128 - Math.cos(a) * 100); c.lineTo(128 + Math.sin(a) * 116, 128 - Math.cos(a) * 116); c.stroke();
      }
    });
    mesh(new THREE.CircleGeometry(0.145, 40), new THREE.MeshStandardMaterial({ map: face.tex, roughness: 0.4 }), 0, 0, 0.041, { parent: g });
    const handMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });
    const hh = new THREE.Group(); hh.position.z = 0.045; g.add(hh);
    mesh(new THREE.BoxGeometry(0.008, 0.08, 0.003).translate(0, 0.035, 0), handMat, 0, 0, 0, { parent: hh });
    const mh = new THREE.Group(); mh.position.z = 0.048; g.add(mh);
    mesh(new THREE.BoxGeometry(0.005, 0.12, 0.003).translate(0, 0.055, 0), handMat, 0, 0, 0, { parent: mh });
    hh.rotation.z = -2.1; mh.rotation.z = -5.6;
    scene.add(g);
    H.clock = { hour: hh, minute: mh };
  }

  return H;
}

export { canvasTexture };
