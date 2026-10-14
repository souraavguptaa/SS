// Buildings + props: Bengal houses, thatched hut, para buildings, diya, valve radio, dhak, fairy lights, pandal, boat.
import * as THREE from 'three';
import { cel, ink, RIG } from '../core/cel.js';
import { lathe, ellipsoid, extrudeShape } from './geo.js';
import { glowSprite, sparkleTexture } from '../core/fx.js';
import { mulberry32, lerp, clamp } from '../core/util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

const matCache = new Map();
function M(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, cel(color, opts));
  return matCache.get(key);
}
function box(w, h, d, mat, inkW = 1.6, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (inkW > 0) ink(m, inkW);
  if (parent) parent.add(m);
  return m;
}
function archShape(w, h, r) {
  // rectangle with a semicircular top
  const pts = [[-w / 2, 0], [w / 2, 0], [w / 2, h - r]];
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI; pts.push([Math.cos(a) * r, h - r + Math.sin(a) * r]); }
  pts.push([-w / 2, h - r]);
  return pts;
}

// ---------------- windows / doors ----------------
function windowUnit(parent, x, y, z, { w = 0.9, h = 1.3, shutter = 0x2f7a4a, frame = 0xf4ecd8, lit = false, glowColor = 0xffb050, open = 0.6, grill = true } = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  box(w + 0.16, 0.1, 0.12, M(frame, { shade: 0xa898a8 }), 1.4, g, 0, h / 2 + 0.05, 0.03);
  box(w + 0.22, 0.08, 0.2, M(frame, { shade: 0xa898a8 }), 1.4, g, 0, -h / 2 - 0.04, 0.06);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lit ? new THREE.MeshBasicMaterial({ color: new THREE.Color(glowColor).multiplyScalar(1.4), toneMapped: false }) : M(0x1a1830, { flat: true }));
  glass.position.z = 0.006;
  g.add(glass);
  if (grill) for (let i = 1; i < 5; i++) box(0.025, h, 0.025, M(0x2a2a3a, { flat: true }), 0, g, -w / 2 + (i * w) / 5, 0, 0.0);
  const shutters = [];
  for (const s of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(s * w / 2, 0, 0.04);
    g.add(hinge);
    const leaf = box(w / 2, h, 0.05, M(shutter, { shade: new THREE.Color(shutter).multiplyScalar(0.45) }), 1.3, hinge, -s * w / 4, 0, 0);
    for (let k = -2; k <= 2; k++) box(w / 2 - 0.06, 0.03, 0.06, M(new THREE.Color(shutter).multiplyScalar(0.75).getHex(), {}), 0, leaf, 0, (k * h) / 6, 0.01);
    hinge.rotation.y = s * open * 1.9;
    shutters.push(hinge);
  }
  return { group: g, glass, shutters };
}

// ---------------- Bengal house (pucca, veranda, flat roof with parapet) ----------------
export function bengalHouse({ wall = 0xf2c46a, wallShade = 0xa86a4a, trim = 0xfff2dc, shutter = 0x2f7a4a, width = 9, depth = 6, height = 3.4, veranda = true, litWindow = -1, seed = 1, floors = 1, door = true } = {}) {
  const g = new THREE.Group();
  const wm = M(wall, { shade: wallShade, rim: 0.2 });
  const tm = M(trim, { shade: 0xb8a8b8 });
  const H = height * floors;
  box(width, H, depth, wm, 2.0, g, 0, H / 2, 0);
  box(width + 0.3, 0.4, depth + 0.3, M(0x9a6a5a, { shade: 0x5a3a4a }), 1.6, g, 0, 0.2, 0);
  // cornice + parapet
  box(width + 0.5, 0.18, depth + 0.5, tm, 1.6, g, 0, H + 0.05, 0);
  for (const [w, d, x, z] of [[width + 0.4, 0.15, 0, depth / 2 + 0.12], [width + 0.4, 0.15, 0, -depth / 2 - 0.12], [0.15, depth + 0.4, width / 2 + 0.12, 0], [0.15, depth + 0.4, -width / 2 - 0.12, 0]]) box(w, 0.7, d, wm, 1.6, g, x, H + 0.5, z);
  for (let i = 0; i < 8; i++) box(0.2, 0.25, 0.2, tm, 1.2, g, -width / 2 - 0.1 + ((width + 0.2) * i) / 7, H + 0.95, depth / 2 + 0.12);
  // floor bands
  for (let f = 1; f < floors; f++) box(width + 0.2, 0.14, depth + 0.2, tm, 1.4, g, 0, f * height, 0);
  const windows = [];
  const front = depth / 2 + 0.01;
  for (let f = 0; f < floors; f++) {
    const nW = Math.max(2, Math.round(width / 2.6));
    for (let i = 0; i < nW; i++) {
      const x = -width / 2 + (width * (i + 0.5)) / nW;
      if (door && f === 0 && i === Math.floor(nW / 2)) continue;
      const idx = windows.length;
      windows.push(windowUnit(g, x, f * height + height * 0.55, front, { shutter, lit: idx === litWindow, open: 0.45 + ((i * 37) % 10) / 30 }));
    }
  }
  let doorObj = null;
  if (door) {
    const dg = new THREE.Group();
    dg.position.set(-width / 2 + (width * (Math.floor(Math.max(2, Math.round(width / 2.6)) / 2) + 0.5)) / Math.max(2, Math.round(width / 2.6)), 0.4, front);
    g.add(dg);
    box(1.6, 2.6, 0.16, tm, 1.6, dg, 0, 1.3, 0.02);
    const dark = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.35), new THREE.MeshBasicMaterial({ color: 0x120c10 }));
    dark.position.set(0, 1.2, 0.05);
    dg.add(dark);
    const leaves = [];
    for (const s of [-1, 1]) {
      const hinge = new THREE.Group();
      hinge.position.set(s * 0.65, 1.2, 0.08);
      dg.add(hinge);
      const leaf = box(0.65, 2.35, 0.07, M(0x7a3a1e, { shade: 0x3a1a1a }), 1.4, hinge, -s * 0.325, 0, 0);
      for (const y of [-0.7, 0, 0.7]) box(0.5, 0.5, 0.03, M(0x8e4a28, { shade: 0x4a2020 }), 0.8, leaf, 0, y, 0.04);
      leaves.push(hinge);
    }
    doorObj = { group: dg, leaves, dark };
  }
  if (veranda) {
    const vz = depth / 2 + 1.3;
    box(width + 0.4, 0.3, 2.8, M(0xc87a5a, { shade: 0x7a3a3a }), 1.6, g, 0, 0.25, depth / 2 + 1.2);
    box(width + 0.4, 0.22, 2.8, tm, 1.6, g, 0, height, depth / 2 + 1.2);
    const n = Math.max(3, Math.round(width / 2.2));
    for (let i = 0; i <= n; i++) {
      const x = -width / 2 + (width * i) / n;
      const col = new THREE.Mesh(lathe([[0.16, 0], [0.13, 0.3], [0.11, 0.5], [0.11, height - 0.6], [0.16, height - 0.35], [0.2, height - 0.1]], 12), tm);
      col.position.set(x, 0.35, depth / 2 + 2.4);
      ink(col, 1.4);
      g.add(col);
    }
  }
  return { group: g, windows, door: doorObj, front };
}

// ---------------- village hut with a do-chala (curved, two-sided) thatched roof ----------------
export function hut({ wall = 0xd6a46a, wallShade = 0x8a5a4a, roof = 0xd8b060, roofShade = 0x8a6a3a, width = 4, depth = 3.2, height = 2.2, lit = false, seed = 1 } = {}) {
  const g = new THREE.Group();
  box(width, height, depth, M(wall, { shade: wallShade }), 1.8, g, 0, height / 2, 0);
  box(width + 0.2, 0.25, depth + 0.2, M(0x8a5a4a, { shade: 0x4a2a3a }), 1.4, g, 0, 0.12, 0);
  // curved roof surface (two slabs)
  const segU = 16, segV = 6, pos = [], idx = [];
  const W = width / 2 + 0.6, D = depth / 2 + 0.6, ridge = height + 1.5;
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= segU; i++) {
      const u = (i / segU) * 2 - 1;
      for (let j = 0; j <= segV; j++) {
        const v = j / segV;
        const droop = 0.45 * u * u; // ends of the ridge droop: the Bengal curve
        const y = ridge - droop - v * (ridge - height - 0.1) - v * v * 0.2 + droop * v * 0.6;
        pos.push(u * W, y, side * v * D);
      }
    }
    for (let i = 0; i < segU; i++) for (let j = 0; j < segV; j++) {
      const a = base + i * (segV + 1) + j, b = a + 1, c = a + segV + 1, d = c + 1;
      if (side > 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  rg.setIndex(idx);
  rg.computeVertexNormals();
  const rm = new THREE.Mesh(rg, M(roof, { shade: roofShade, side: THREE.DoubleSide }));
  ink(rm, 1.8, { raw: true });
  g.add(rm);
  // gable fill
  const gab = new THREE.Mesh(new THREE.ConeGeometry(depth / 2 + 0.1, ridge - height, 3, 1), M(wall, { shade: wallShade }));
  gab.position.y = height + (ridge - height) / 2 - 0.1;
  gab.scale.set(0.02, 1, 1);
  const g1 = gab.clone(); g1.position.x = width / 2 - 0.02;
  const g2 = gab.clone(); g2.position.x = -width / 2 + 0.02;
  g.add(g1, g2);
  // door + a window
  const dm = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.6), new THREE.MeshBasicMaterial({ color: lit ? 0xffa040 : 0x1a1010, toneMapped: false }));
  dm.position.set(0.6, 0.95, depth / 2 + 0.01);
  g.add(dm);
  const wdw = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.5), new THREE.MeshBasicMaterial({ color: lit ? 0xffc060 : 0x1a1010, toneMapped: false }));
  wdw.position.set(-0.9, 1.4, depth / 2 + 0.01);
  g.add(wdw);
  g.userData.lights = [dm, wdw];
  return g;
}

// ---------------- para building (town street) ----------------
export function paraBuilding({ seed = 1, width = 6, depth = 6, floors = 3, wall, shutter, balcony = true } = {}) {
  const rnd = mulberry32(seed);
  const palette = [0xf2b8a0, 0xf6d47a, 0xa8d0e6, 0xb8e0b0, 0xf0a0b0, 0xe8c8f0, 0xf4e2b0];
  const wc = wall ?? palette[Math.floor(rnd() * palette.length)];
  const sc = shutter ?? [0x2f7a4a, 0x2a5a9a, 0x8a3a2a][Math.floor(rnd() * 3)];
  const fh = 3.1;
  const res = bengalHouse({ wall: wc, wallShade: new THREE.Color(wc).multiplyScalar(0.58).getHex(), shutter: sc, width, depth, height: fh, floors, veranda: false, door: true, seed });
  const g = res.group;
  if (balcony) {
    for (let f = 1; f < floors; f++) {
      const y = f * fh;
      box(width * 0.7, 0.15, 1.1, M(0xfff2dc, { shade: 0xb8a8b8 }), 1.4, g, 0, y + 0.1, depth / 2 + 0.55);
      for (let i = 0; i <= 10; i++) box(0.04, 0.8, 0.04, M(0x3a3a4a, { flat: true }), 0, g, -width * 0.35 + (width * 0.7 * i) / 10, y + 0.55, depth / 2 + 1.07);
      box(width * 0.7, 0.06, 0.06, M(0x3a3a4a, { flat: true }), 0, g, 0, y + 0.95, depth / 2 + 1.07);
    }
  }
  return res;
}

// ---------------- diya (clay lamp) ----------------
export function diya({ scale = 1 } = {}) {
  const g = new THREE.Group();
  const bowl = new THREE.Mesh(lathe([[0.001, 0], [0.05, 0.005], [0.075, 0.025], [0.085, 0.045], [0.07, 0.05], [0.04, 0.03], [0.001, 0.028]], 18, (r, y, a) => r * (1 + 0.25 * Math.max(0, Math.cos(a)) ** 8)), M(0xb4542a, { shade: 0x5a2420 }));
  ink(bowl, 1.4);
  g.add(bowl);
  const flame = new THREE.Group();
  flame.position.set(0, 0.06, 0.07);
  g.add(flame);
  const core = new THREE.Mesh(lathe([[0.001, 0], [0.012, 0.012], [0.014, 0.03], [0.007, 0.055], [0.001, 0.075]], 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.25, 0.95, 0.45), toneMapped: false }));
  flame.add(core);
  const halo = glowSprite(0xff9a30, 0.22, 0.55);
  halo.position.y = 0.035;
  flame.add(halo);
  g.scale.setScalar(scale);
  return { group: g, flame, halo, core };
}
export function flicker(d, t, seed = 0, amt = 1) {
  const f = 1 + amt * (0.12 * Math.sin(t * 13 + seed) + 0.07 * Math.sin(t * 23.7 + seed * 2) + 0.05 * Math.sin(t * 41.3));
  d.flame.scale.set(1, f, 1);
  d.flame.rotation.z = 0.08 * Math.sin(t * 5.3 + seed) * amt;
  d.halo.material.opacity = 0.75 + 0.25 * (f - 1) * 4;
  return f;
}

// ---------------- vintage valve radio ----------------
export function radio() {
  const g = new THREE.Group();
  const wood = M(0x7a3e1e, { shade: 0x3a1a1a, spec: 0.3 });
  const W = 0.62, H = 0.42, D = 0.26;
  const shape = archShape(W, H, W / 2 * 0.85);
  const body = new THREE.Mesh(extrudeShape(shape, D, 0.02), wood);
  ink(body, 2);
  g.add(body);
  // speaker cloth (arched inset)
  const cloth = new THREE.Mesh(extrudeShape(archShape(W * 0.72, H * 0.62, W * 0.72 / 2 * 0.95), 0.02, 0.0), M(0xd8b07a, { shade: 0x8a6a4a }));
  cloth.position.set(0, H * 0.3, D / 2 + 0.005);
  ink(cloth, 1.2);
  g.add(cloth);
  for (let i = 0; i < 5; i++) box(0.012, H * 0.5, 0.012, M(0x5a2e1a, { flat: true }), 0, g, -0.16 + i * 0.08, H * 0.58, D / 2 + 0.02);
  // dial window
  const dialBg = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.62, 0.075), new THREE.MeshBasicMaterial({ color: 0x2a1a10, toneMapped: false }));
  dialBg.position.set(0, H * 0.17, D / 2 + 0.012);
  g.add(dialBg);
  const dial = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.6, 0.06), new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false }));
  dial.position.set(0, H * 0.17, D / 2 + 0.014);
  g.add(dial);
  const needle = box(0.006, 0.055, 0.004, M(0xd01010, { flat: true }), 0, g, -0.12, H * 0.17, D / 2 + 0.018);
  for (let i = 0; i < 9; i++) box(0.003, 0.02, 0.003, M(0x3a2010, { flat: true }), 0, g, -0.16 + i * 0.04, H * 0.17 + 0.012, D / 2 + 0.016);
  for (const s of [-1, 1]) {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.04, 16), M(0x2a1a14, { shade: 0x100808, spec: 0.5 }));
    k.rotation.x = Math.PI / 2;
    k.position.set(s * 0.2, H * 0.08, D / 2 + 0.02);
    ink(k, 1.2);
    g.add(k);
  }
  const eye = glowSprite(0x40ff80, 0.06, 0.0);
  eye.position.set(0, H * 0.82, D / 2 + 0.03);
  g.add(eye);
  const glow = glowSprite(0xffb050, 0.4, 0.0);
  glow.position.set(0, H * 0.25, D / 2 + 0.05);
  g.add(glow);
  function setOn(v, t = 0) {
    dial.material.color.setRGB(1.15 * v, 0.75 * v, 0.28 * v);
    eye.material.color.setRGB(0.25 * v, 1.2 * v, 0.5 * v);
    glow.material.color.setRGB(1.0, 0.62, 0.25).multiplyScalar(0.2 * v);
    needle.position.x = -0.12 + v * 0.06 + 0.01 * Math.sin(t * 0.7);
  }
  setOn(0);
  return { group: g, setOn, needle };
}

// ---------------- dhak drum with a kash plume ----------------
export function dhak() {
  const g = new THREE.Group();
  const barrel = new THREE.Mesh(lathe([[0.2, -0.36], [0.235, -0.2], [0.25, 0], [0.235, 0.2], [0.2, 0.36]], 24), M(0x8a3a1a, { shade: 0x3a1414, spec: 0.3 }));
  barrel.rotation.z = Math.PI / 2;
  ink(barrel, 2);
  g.add(barrel);
  for (const x of [-0.24, -0.08, 0.08, 0.24]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.245 - Math.abs(x) * 0.15, 0.012, 6, 28), M(x % 0.16 === 0 ? 0xf4e8d0 : 0xd8b02a, { shade: 0x8a6a3a }));
    band.rotation.y = Math.PI / 2;
    band.position.x = x;
    g.add(band);
  }
  for (const s of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.02, 24), M(0xf2e2c0, { shade: 0xa8987a }));
    head.rotation.z = Math.PI / 2;
    head.position.x = s * 0.365;
    ink(head, 1.4);
    g.add(head);
    // lacing
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 4), M(0xf4ecd8, { flat: true }));
      l.position.set(s * 0.22, Math.cos(a) * 0.22, Math.sin(a) * 0.22);
      l.rotation.z = Math.PI / 2 + s * 0.12;
      g.add(l);
    }
  }
  // kash plume crown on top of the drum
  const plume = new THREE.Group();
  plume.position.set(0.0, 0.25, 0);
  g.add(plume);
  const pm = M(0xdcd6e6, { shade: 0x9a92b8, rim: 0.25 });
  const pg = lathe([[0.002, 0], [0.03, 0.06], [0.05, 0.2], [0.04, 0.38], [0.018, 0.52], [0.002, 0.6]], 8, (r, y, a) => r * (1 + 0.25 * Math.sin(a * 5 + y * 40)));
  const n = 15;
  for (let i = 0; i < n; i++) {
    const a = -1.2 + (2.4 * i) / (n - 1);
    const p = new THREE.Mesh(pg, pm);
    p.rotation.z = a;
    p.rotation.x = (i % 3 - 1) * 0.25;
    p.scale.setScalar(0.85 + 0.3 * Math.sin(i * 2.3));
    ink(p, 1.0);
    plume.add(p);
  }
  const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.1, 8), M(0xd8b02a, { shade: 0x7a5a1a }));
  holder.position.y = -0.02;
  plume.add(holder);
  return { group: g, plume };
}

// ---------------- fairy lights ----------------
// strings: [{ a:[x,y,z], b:[x,y,z], sag, n }]. Returns { mesh, set(t, fn(i, s, u, t) -> [r,g,b]) }
export function bulbStrings(strings, { size = 0.07, wire = true } = {}) {
  let total = 0;
  for (const s of strings) total += s.n;
  const geo = new THREE.IcosahedronGeometry(size, 1);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const mesh = new THREE.InstancedMesh(geo, mat, total);
  const meta = [];
  const group = new THREE.Group();
  let k = 0;
  for (let si = 0; si < strings.length; si++) {
    const s = strings[si];
    const A = V(...s.a), B = V(...s.b);
    const pts = [];
    for (let i = 0; i < s.n; i++) {
      const u = (i + 0.5) / s.n;
      const p = V().lerpVectors(A, B, u);
      p.y -= s.sag * 4 * u * (1 - u);
      pts.push(p);
      _m.makeTranslation(p.x, p.y, p.z);
      mesh.setMatrixAt(k, _m);
      mesh.setColorAt(k, new THREE.Color(1, 1, 1));
      meta.push({ s: si, u, i });
      k++;
    }
    if (wire) {
      const curve = new THREE.CatmullRomCurve3([A, ...pts, B]);
      const w = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.012, 4, false), M(0x1a1420, { flat: true }));
      group.add(w);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  group.add(mesh);
  const c = new THREE.Color();
  function set(t, fn) {
    for (let i = 0; i < meta.length; i++) {
      const [r, g2, b] = fn(i, meta[i].s, meta[i].u, t, meta[i].i);
      c.setRGB(r, g2, b);
      mesh.setColorAt(i, c);
    }
    mesh.instanceColor.needsUpdate = true;
  }
  return { group, mesh, set, count: total };
}

// ---------------- pandal ----------------
export function pandal({ width = 16, height = 13 } = {}) {
  const g = new THREE.Group();
  const gold = M(0xf2b62a, { shade: 0x9a4a1a, spec: 0.6, rim: 0.6 });
  const red = M(0xc8102e, { shade: 0x6a0820 });
  const cream = M(0xfff0d0, { shade: 0xc0a8a8 });
  const maroon = M(0x7a1030, { shade: 0x3a0818 });
  // side towers
  for (const s of [-1, 1]) {
    const tw = new THREE.Group();
    tw.position.x = s * (width / 2 - 1.6);
    g.add(tw);
    box(3.2, height * 0.62, 3.0, cream, 2, tw, 0, height * 0.31, 0);
    box(3.5, 0.4, 3.3, gold, 1.6, tw, 0, height * 0.62, 0);
    const dome = new THREE.Mesh(lathe([[1.5, 0], [1.6, 0.4], [1.4, 1.2], [0.9, 2.0], [0.35, 2.6], [0.06, 3.2]], 20), gold);
    dome.position.y = height * 0.62 + 0.2;
    ink(dome, 1.8);
    tw.add(dome);
    for (let i = 0; i < 3; i++) box(0.9, 1.5, 0.1, red, 1.2, tw, (i - 1) * 1.0, height * 0.4, 1.52);
  }
  // central arch facade
  const archOuter = archShape(width * 0.55, height * 0.95, width * 0.275);
  const archInner = archShape(width * 0.36, height * 0.62, width * 0.18).reverse();
  const facade = new THREE.Mesh(extrudeShape(archOuter, 1.0, 0.05, [archInner]), red);
  facade.position.z = 1.0;
  ink(facade, 2);
  g.add(facade);
  const trimArch = new THREE.Mesh(extrudeShape(archShape(width * 0.4, height * 0.66, width * 0.2), 0.3, 0.03, [archShape(width * 0.36, height * 0.62, width * 0.18).reverse()]), gold);
  trimArch.position.z = 1.55;
  ink(trimArch, 1.6);
  g.add(trimArch);
  // top finial / shikhara
  const top = new THREE.Mesh(lathe([[1.6, 0], [1.4, 0.8], [1.0, 1.8], [0.5, 2.6], [0.12, 3.4], [0.02, 3.8]], 20), gold);
  top.position.set(0, height * 0.93, 1.0);
  ink(top, 1.8);
  g.add(top);
  // glowing interior
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.36, height * 0.62), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.95, 0.45), toneMapped: false }));
  inner.position.set(0, height * 0.31, 0.2);
  g.add(inner);
  const innerGlow = glowSprite(0xffb050, width * 0.9, 0.5);
  innerGlow.position.set(0, height * 0.35, 1.0);
  g.add(innerGlow);
  // bulbs along the arch + towers
  const pts = [];
  for (let i = 0; i <= 60; i++) { const a = (i / 60) * Math.PI; pts.push([Math.cos(a) * width * 0.285, height * 0.95 - width * 0.275 + Math.sin(a) * width * 0.285, 2.1]); }
  for (let i = 0; i <= 30; i++) { const a = (i / 30) * Math.PI; pts.push([Math.cos(a) * width * 0.21, height * 0.62 - width * 0.18 + Math.sin(a) * width * 0.21, 1.9]); }
  for (const s of [-1, 1]) for (let i = 0; i < 20; i++) pts.push([s * (width / 2 - 1.6) + s * 1.65, (i / 19) * height * 0.6, 1.6], [s * (width / 2 - 1.6) - s * 1.65, (i / 19) * height * 0.6, 1.6]);
  const bm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.09, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), pts.length);
  pts.forEach((p, i) => { _m.makeTranslation(p[0], p[1], p[2]); bm.setMatrixAt(i, _m); bm.setColorAt(i, new THREE.Color(1.6, 1.1, 0.5)); });
  bm.instanceMatrix.needsUpdate = true;
  bm.frustumCulled = false;
  g.add(bm);
  // flags
  for (const s of [-1, 1]) {
    const pole = box(0.08, 3, 0.08, maroon, 1, g, s * (width / 2 - 1.6), height * 0.62 + 3.6, 0);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), M(0xff7a1a, { side: THREE.DoubleSide, shade: 0xa03a10 }));
    flag.position.set(s * (width / 2 - 1.6) + 0.6, height * 0.62 + 4.6, 0);
    ink(flag, 1.2, { raw: true });
    g.add(flag);
  }
  g.userData.bulbs = bm;
  g.userData.inner = inner;
  g.userData.innerGlow = innerGlow;
  return g;
}

// ---------------- country boat ----------------
export function boat({ color = 0x6a3a1e } = {}) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(lathe([[0.001, -2.2], [0.35, -1.6], [0.55, -0.6], [0.6, 0], [0.55, 0.6], [0.35, 1.6], [0.001, 2.2]], 16, null), M(color, { shade: 0x2a1410 }));
  hull.rotation.x = Math.PI / 2;
  hull.scale.set(1, 1, 0.5);
  hull.position.y = 0.15;
  ink(hull, 1.6);
  g.add(hull);
  // upturned ends
  for (const s of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 8), M(color, { shade: 0x2a1410 }));
    tip.position.set(0, 0.5, s * 2.0);
    tip.rotation.x = -s * 0.5;
    ink(tip, 1.2);
    g.add(tip);
  }
  // cane canopy (chhai)
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.4, 16, 1, true, -Math.PI / 2, Math.PI), M(0xc8a060, { shade: 0x7a5a3a, side: THREE.DoubleSide }));
  canopy.rotation.x = Math.PI / 2;
  canopy.rotation.z = Math.PI / 2;
  canopy.position.y = 0.4;
  ink(canopy, 1.4, { raw: true });
  g.add(canopy);
  return g;
}

// ---------------- tulsi mancha (holy basil altar) ----------------
export function tulsiMancha() {
  const g = new THREE.Group();
  const tm = M(0xf2e8d4, { shade: 0xb0a0a8 });
  box(0.8, 0.5, 0.8, tm, 1.4, g, 0, 0.25, 0);
  const top = new THREE.Mesh(lathe([[0.3, 0], [0.34, 0.3], [0.42, 0.55], [0.46, 0.6]], 4), M(0xd8603a, { shade: 0x7a2a2a }));
  top.position.y = 0.5;
  top.rotation.y = Math.PI / 4;
  ink(top, 1.4);
  g.add(top);
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), M(0x3a8a3a, { shade: 0x1a4a2a }));
    b.position.set(Math.cos(i) * 0.12, 1.2 + (i % 3) * 0.14, Math.sin(i * 1.7) * 0.12);
    ink(b, 1.0);
    g.add(b);
  }
  return g;
}
