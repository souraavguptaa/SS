// Nature kit: cartoon clouds, Himalayan peaks, kash flowers, water, palms, banana plants, shiuli tree, ground.
import * as THREE from 'three';
import { cel, ink, RIG } from '../core/cel.js';
import { lathe, ellipsoid, weld } from './geo.js';
import { SNOISE, HASH } from '../core/glsl.js';
import { mulberry32, lerp, clamp } from '../core/util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();

// ---------------- clouds ----------------
// A bank of puffy cumulus clusters, all puffs in one InstancedMesh.
export function cloudBank({ clusters = 20, seed = 1, area = [-50, 50, -50, 50], y = [0, 5], size = [3, 8], puffs = [7, 14], lit = 0xffffff, shade = 0xb8b4e0, term = 0.15, rim = 0.5, flatten = 0.25, place } = {}) {
  const rnd = mulberry32(seed);
  const mats = [];
  const centers = [];
  for (let c = 0; c < clusters; c++) {
    let cx = lerp(area[0], area[1], rnd()), cz = lerp(area[2], area[3], rnd()), cy = lerp(y[0], y[1], rnd());
    const R = lerp(size[0], size[1], rnd());
    if (place) { const p = place(c, rnd); if (p) { cx = p[0]; cy = p[1]; cz = p[2]; } }
    centers.push([cx, cy, cz, R]);
    const n = Math.round(lerp(puffs[0], puffs[1], rnd()));
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, el = rnd() * 0.9;
      const d = R * (0.25 + rnd() * 0.55);
      const px = cx + Math.cos(a) * Math.cos(el) * d * 1.35;
      const pz = cz + Math.sin(a) * Math.cos(el) * d;
      const py = cy + Math.sin(el) * d * 0.7;
      const pr = R * (0.32 + rnd() * 0.32) * (1 - 0.35 * (Math.abs(px - cx) / (R * 1.4)));
      mats.push([px, Math.max(py, cy - R * flatten + pr * 0.5), pz, pr]);
    }
    // a flat base puff so the underside reads as a cloud bottom
    mats.push([cx, cy - R * flatten * 0.4, cz, R * 0.55]);
  }
  const geo = new THREE.IcosahedronGeometry(1, 3);
  const mat = cel(lit, { shade, term, rim });
  const mesh = new THREE.InstancedMesh(geo, mat, mats.length);
  mats.forEach(([x, y2, z, r], i) => {
    _m.compose(_p.set(x, y2, z), _q.identity(), _s.set(r * 1.15, r * 0.88, r));
    mesh.setMatrixAt(i, _m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.userData.centers = centers;
  return mesh;
}

// ---------------- mountains ----------------
// Radial mountain with optional 4-fold squareness (Kailash), rock bands and a snow cap. Vertex coloured.
export function peak({ seed = 1, height = 30, radius = 25, square = 0, shape = 'spire', snow = 0.55, bands = false, rock = 0x6a5a7a, rock2 = 0x4a3a5a, snowCol = 0xf2f4ff, segs = 72, rings = 44, roughness = 0.12, gully = false } = {}) {
  const rnd = mulberry32(seed);
  const ph = rnd() * 100;
  const pos = [], col = [], idx = [];
  const cRock = new THREE.Color(rock), cRock2 = new THREE.Color(rock2), cSnow = new THREE.Color(snowCol), c = new THREE.Color();
  const noise = (a, b) => {
    let v = 0, amp = 1, f = 1;
    for (let k = 0; k < 4; k++) { v += amp * Math.sin(a * f * 3.1 + ph + k * 1.7) * Math.cos(b * f * 2.3 + ph * 0.7 + k); amp *= 0.5; f *= 2.1; }
    return v;
  };
  for (let i = 0; i <= rings; i++) {
    const h = i / rings;
    for (let j = 0; j <= segs; j++) {
      const th = (j / segs) * Math.PI * 2;
      let prof;
      if (shape === 'kailash') prof = Math.pow(1 - h, 0.85) * (0.75 + 0.25 * Math.sqrt(Math.max(0, 1 - Math.pow(h / 0.97, 6))));
      else if (shape === 'dome') prof = Math.sqrt(Math.max(0, 1 - h * h));
      else prof = Math.pow(1 - h, 1.35);
      const sq = 1 + square * (Math.pow(Math.abs(Math.cos(th)), 6) + Math.pow(Math.abs(Math.sin(th)), 6) - 0.5) * 0.6;
      const n = noise(th * 2, h * 3) * roughness;
      let r = radius * prof * sq * (1 + n);
      if (gully) r -= radius * 0.06 * Math.exp(-Math.pow((th - Math.PI * 0.5) * 4, 2)) * Math.sin(h * Math.PI);
      const y = h * height + noise(th * 3 + 5, h * 5) * height * 0.02 * (1 - h);
      pos.push(Math.cos(th) * r, y, Math.sin(th) * r);
      // colour: snow line with noise, banded rock
      const snowLine = snow + noise(th * 4, 1.3) * 0.08;
      let rockC = cRock;
      if (bands) rockC = Math.sin(h * 38 + noise(th, h) * 0.6) > 0.25 ? cRock2 : cRock;
      const snowK = clamp((h - snowLine) / 0.03, 0, 1);
      // streaks of snow in gullies below the line
      const streak = clamp((Math.sin(th * 23 + ph) * 0.5 + 0.5) * (h - snowLine + 0.18) * 6 - 0.6, 0, 1) * (h > snowLine - 0.2 ? 1 : 0);
      c.copy(rockC).lerp(cSnow, Math.max(snowK, streak * 0.9));
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) {
    const a = i * (segs + 1) + j, b = a + 1, d = a + segs + 1, e = d + 1;
    idx.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, cel(0xffffff, { vertexColors: true, shade: 0x000000, term: 0.05, rim: 0.4 }));
  m.material.uniforms.uShadeMix.value = 0;
  return m;
}

// ---------------- kash flowers ----------------
// One merged geometry: stalk (green) + feathery plume (white) with a gentle droop.
function kashGeometry(seed = 1) {
  const stalk = lathe([[0.012, 0], [0.01, 0.6], [0.007, 1.1]], 6);
  const plume = lathe([[0.002, 0], [0.035, 0.08], [0.06, 0.24], [0.055, 0.42], [0.03, 0.6], [0.002, 0.72]], 10, (r, y, a) => r * (1 + 0.18 * Math.sin(a * 5 + y * 30)));
  plume.translate(0, 1.05, 0);
  const pp = plume.attributes.position;
  for (let i = 0; i < pp.count; i++) { const y = pp.getY(i) - 1.05; pp.setX(i, pp.getX(i) + y * y * 0.35); }
  plume.computeVertexNormals();
  const colorize = (g, c) => { const n = g.attributes.position.count; const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); };
  colorize(stalk, new THREE.Color(0x7a8a3a));
  colorize(plume, new THREE.Color(0xffffff));
  const merged = mergeGeos([stalk, plume]);
  return merged;
}
export function mergeGeos(geos) {
  let total = 0, itotal = 0;
  for (const g of geos) { total += g.attributes.position.count; itotal += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(total * 3), nrm = new Float32Array(total * 3), col = new Float32Array(total * 3), idx = [];
  let off = 0;
  for (const g of geos) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, off * 3);
    if (g.attributes.normal) nrm.set(g.attributes.normal.array, off * 3);
    if (g.attributes.color) col.set(g.attributes.color.array, off * 3); else col.fill(1, off * 3, (off + n) * 3);
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.array[i] + off); else for (let i = 0; i < n; i++) idx.push(i + off);
    off += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(idx);
  return out;
}

// region(rnd) -> [x, z] or null ; growAt(x, z) -> time this plant blooms (for wave reveals)
export function kashField({ count = 3000, seed = 3, region, height = [0.9, 1.6], tint = 0xfff8ff, shade = 0xb4acd8, sway = 0.07, growAt = null, inkW = 1.4, lean = 0.25 } = {}) {
  const geo = kashGeometry(seed);
  const rnd = mulberry32(seed);
  const mat = cel(tint, { vertexColors: true, shade, rim: 0.8, sway, swayFreq: 1.6, grow: !!growAt, growDur: 0.7, term: 0.1 });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const grow = growAt ? new Float32Array(count) : null;
  for (let i = 0; i < count; i++) {
    let p = null;
    for (let k = 0; k < 20 && !p; k++) p = region(rnd);
    if (!p) p = [0, -1000];
    const s = lerp(height[0], height[1], rnd());
    _e.set((rnd() - 0.5) * lean, rnd() * Math.PI * 2, (rnd() - 0.5) * lean);
    _m.compose(_p.set(p[0], p[2] ?? 0, p[1]), _q.setFromEuler(_e), _s.set(s, s, s));
    mesh.setMatrixAt(i, _m);
    if (grow) grow[i] = growAt(p[0], p[1], rnd);
  }
  if (grow) geo.setAttribute('aGrow', new THREE.InstancedBufferAttribute(grow, 1));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  if (inkW > 0) ink(mesh, inkW, { sway, swayFreq: 1.6, grow: growAt ? mat.uniforms : null });
  mesh.userData.mat = mat;
  return mesh;
}

// ---------------- water ----------------
export function water({ size = [200, 200], deep = 0x0d2a5a, shallow = 0x2a6aa8, line = 0x9fd8ff, glint = 0xfff2c8, glintDir = [0, 0.2, -1], lineScale = 0.6, flow = [0.0, 0.25] } = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: RIG.uTime, uDeep: { value: new THREE.Color(deep) }, uShallow: { value: new THREE.Color(shallow) }, uLine: { value: new THREE.Color(line) },
      uGlint: { value: new THREE.Color(glint) }, uGlintDir: { value: new THREE.Vector3(...glintDir).normalize() }, uScale: { value: lineScale }, uFlow: { value: new THREE.Vector2(...flow) },
      uFogColor: RIG.uFogColor, uFogNear: RIG.uFogNear, uFogFar: RIG.uFogFar, uGlintAmt: { value: 1 },
    },
    vertexShader: `varying vec3 vW; varying vec3 vPv; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vPv = mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `${SNOISE} ${HASH}
      uniform float uTime, uScale, uGlintAmt; uniform vec2 uFlow; uniform vec3 uDeep, uShallow, uLine, uGlint, uGlintDir, uFogColor; uniform float uFogNear, uFogFar;
      varying vec3 vW; varying vec3 vPv;
      void main(){
        vec2 p = vW.xz * uScale + uFlow * uTime;
        float n = snoise(vec3(p * 0.35, uTime * 0.15));
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(V.y, 0.0), 3.0);
        vec3 col = mix(uDeep, uShallow, smoothstep(-0.4, 0.6, n) * 0.5 + fres * 0.6);
        // cel ripple lines
        float r = snoise(vec3(p.x * 0.8, p.y * 2.4, uTime * 0.3));
        float lineW = fwidth(r) * 1.2;
        float lines = smoothstep(0.55 - lineW, 0.55, r) - smoothstep(0.62, 0.62 + lineW, r);
        col = mix(col, uLine, clamp(lines, 0.0, 1.0) * 0.55);
        // glint path toward the light (sun/moon reflection)
        vec3 R = reflect(-V, vec3(0.0, 1.0, 0.0));
        float g = pow(max(dot(R, normalize(uGlintDir)), 0.0), 60.0);
        float sp = step(0.72, snoise(vec3(p * 3.0, uTime * 1.5))) ;
        col += uGlint * (g * 0.8 + g * sp * 3.0) * uGlintAmt;
        float fogF = smoothstep(uFogNear, uFogFar, length(vPv));
        gl_FragColor = vec4(mix(col, uFogColor, fogF), 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1], 1, 1), mat);
  m.rotation.x = -Math.PI / 2;
  m.userData.mat = mat;
  return m;
}

// ---------------- ground ----------------
// Large terrain with patchwork paddy fields + gentle hills (cel banded).
export function ground({ size = 600, seg = 160, fields = true, hill = 2.5, colA = 0x6aa84a, colB = 0x9cc65a, colC = 0x4a8a3a, dry = 0xc8b46a, seed = 2, flatAt = null } = {}) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const cA = new THREE.Color(colA), cB = new THREE.Color(colB), cC = new THREE.Color(colC), cD = new THREE.Color(dry), c = new THREE.Color();
  const h2 = (x, z) => Math.sin(x * 0.021 + seed) * Math.cos(z * 0.017 + seed * 2) + 0.5 * Math.sin(x * 0.05 + z * 0.04);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    let y = h2(x, z) * hill;
    if (flatAt) y *= flatAt(x, z);
    p.setY(i, y);
    // patchwork fields: hashed grid cells rotated
    const u = x * 0.9 + z * 0.4, v = -x * 0.4 + z * 0.9;
    const cx = Math.floor(u / 14), cz = Math.floor(v / 9);
    const hsh = Math.abs(Math.sin(cx * 127.1 + cz * 311.7 + seed) * 43758.5453) % 1;
    if (fields) c.copy(hsh < 0.33 ? cA : hsh < 0.66 ? cB : hsh < 0.9 ? cC : cD);
    else c.copy(cA).lerp(cB, (h2(x * 2, z * 2) + 1) / 2);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, cel(0xffffff, { vertexColors: true, term: 0.2, rim: 0 }));
  m.userData.height = (x, z) => h2(x, z) * hill * (flatAt ? flatAt(x, z) : 1);
  return m;
}

// ---------------- trees ----------------
function frondGeometry(len = 2.4, width = 0.5, droop = 0.9) {
  // a leaf strip along +Z that droops; zigzag edges suggest leaflets
  const segs = 16, pos = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const z = u * len, y = -droop * u * u * len * 0.45;
    const w = width * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (i % 2 === 0 ? 1 : 0.62);
    pos.push(-w, y, z, 0, y + 0.04, z, w, y, z);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 3;
    idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const leafMatCache = {};
export function palm({ seed = 1, height = 7, lean = 0.25, leaf = 0x3f8f3a, leafShade = 0x1f4a3a, trunk = 0x8a6a4a, sway = 0.0 } = {}) {
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(lean * 0.3 * height, height * 0.35, 0), V(lean * 0.8 * height, height * 0.7, 0), V(lean * height, height, 0)]);
  const tube = new THREE.TubeGeometry(curve, 24, 0.16, 8, false);
  // taper
  const tp = tube.attributes.position;
  const cp = new THREE.Vector3();
  for (let i = 0; i < tp.count; i++) {
    const seg = Math.floor(i / 9) / 24;
    curve.getPointAt(Math.min(seg, 1), cp);
    const x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i);
    const k = lerp(1.25, 0.65, seg) * (1 + 0.08 * Math.sin(seg * 60));
    tp.setXYZ(i, cp.x + (x - cp.x) * k, y, cp.z + (z - cp.z) * k);
  }
  tube.computeVertexNormals();
  const tm = new THREE.Mesh(tube, cel(trunk, { shade: 0x4a3040 }));
  ink(tm, 1.8);
  g.add(tm);
  const top = curve.getPointAt(1);
  const crown = new THREE.Group();
  crown.position.copy(top);
  g.add(crown);
  const key = leaf + ':' + leafShade;
  const lm = leafMatCache[key] || (leafMatCache[key] = cel(leaf, { shade: leafShade, side: THREE.DoubleSide, rim: 0.4, sway }));
  const n = 9;
  for (let i = 0; i < n; i++) {
    const fg = frondGeometry(2.2 + rnd() * 0.8, 0.42, 0.8 + rnd() * 0.5);
    const f = new THREE.Mesh(fg, lm);
    ink(f, 1.4);
    f.rotation.y = (i / n) * Math.PI * 2 + rnd() * 0.3;
    f.rotation.x = -0.35 + rnd() * 0.3;
    crown.add(f);
  }
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), cel(0x5a7a2a, { shade: 0x2a3a1a }));
    c.position.set(Math.cos(i * 1.6) * 0.18, -0.2, Math.sin(i * 1.6) * 0.18);
    ink(c, 1.2);
    crown.add(c);
  }
  g.userData.crown = crown;
  return g;
}

export function banana({ seed = 1, scale = 1, leaf = 0x5aaa3a, shade = 0x2a5a3a } = {}) {
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  const stem = new THREE.Mesh(lathe([[0.14, 0], [0.12, 0.8], [0.09, 1.4]], 10), cel(0x7aa04a, { shade: 0x3a5a3a }));
  ink(stem, 1.4);
  g.add(stem);
  const lm = cel(leaf, { shade, side: THREE.DoubleSide, rim: 0.4 });
  for (let i = 0; i < 6; i++) {
    const L = 1.6 + rnd() * 0.6;
    const pts = [];
    for (let k = 0; k <= 10; k++) { const u = k / 10; const w = Math.sin(Math.PI * Math.min(1, u * 1.05)) * 0.32; pts.push([u, w]); }
    const geo = new THREE.BufferGeometry();
    const pos = [], idx = [];
    pts.forEach(([u, w], k) => { const z = u * L, y = Math.sin(u * 2.4) * 0.5 - u * u * 0.9; pos.push(-w, y - w * 0.15, z, 0, y + 0.03, z, w, y - w * 0.15, z); });
    for (let k = 0; k < 10; k++) { const a = k * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const f = new THREE.Mesh(geo, lm);
    ink(f, 1.3);
    f.position.y = 1.2 + rnd() * 0.3;
    f.rotation.y = (i / 6) * Math.PI * 2 + rnd() * 0.4;
    f.rotation.x = -0.6 + rnd() * 0.4;
    g.add(f);
  }
  g.scale.setScalar(scale);
  return g;
}

// Round leafy tree (shiuli / generic) built from cel blobs; optional little white flowers.
export function leafyTree({ seed = 1, height = 4, spread = 2.2, leaf = 0x3a7a3a, shade = 0x1a3a3a, trunk = 0x6a4a3a, flowers = 0 } = {}) {
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  const tr = new THREE.Mesh(lathe([[0.26, 0], [0.18, height * 0.4], [0.14, height * 0.75]], 10), cel(trunk, { shade: 0x3a2a3a }));
  ink(tr, 1.6);
  g.add(tr);
  const lm = cel(leaf, { shade, rim: 0.5, term: 0.05 });
  const blobs = [];
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2, r = rnd() * spread * 0.6;
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), lm);
    const s = spread * (0.45 + rnd() * 0.3);
    b.scale.set(s, s * 0.8, s);
    b.position.set(Math.cos(a) * r, height * 0.75 + rnd() * spread * 0.6, Math.sin(a) * r);
    ink(b, 1.8);
    g.add(b);
    blobs.push(b);
  }
  if (flowers > 0) {
    const fg = new THREE.CircleGeometry(0.06, 5);
    const fm = cel(0xffffff, { flat: true, side: THREE.DoubleSide });
    const fl = new THREE.InstancedMesh(fg, fm, flowers);
    const cm = new THREE.InstancedMesh(new THREE.CircleGeometry(0.025, 6), cel(0xff7a1a, { flat: true, side: THREE.DoubleSide }), flowers);
    for (let i = 0; i < flowers; i++) {
      const b = blobs[Math.floor(rnd() * blobs.length)];
      const d = V(rnd() - 0.5, rnd() - 0.3, rnd() - 0.5).normalize();
      _p.set(b.position.x + d.x * b.scale.x * 1.01, b.position.y + d.y * b.scale.y * 1.01, b.position.z + d.z * b.scale.z * 1.01);
      _q.setFromUnitVectors(V(0, 0, 1), d);
      _m.compose(_p, _q, _s.set(1, 1, 1));
      fl.setMatrixAt(i, _m);
      _p.addScaledVector(d, 0.005);
      _m.compose(_p, _q, _s.set(1, 1, 1));
      cm.setMatrixAt(i, _m);
    }
    g.add(fl, cm);
  }
  return g;
}

// Simple grass tufts / bushes as cel blobs
export function bush({ seed = 1, size = 1, color = 0x4a8a3a, shade = 0x1a4a3a } = {}) {
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  const m = cel(color, { shade, rim: 0.4 });
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), m);
    const s = size * (0.4 + rnd() * 0.3);
    b.scale.set(s, s * 0.75, s);
    b.position.set((rnd() - 0.5) * size, s * 0.4, (rnd() - 0.5) * size);
    ink(b, 1.4);
    g.add(b);
  }
  return g;
}

// Flat strip following a curve on the ground (rivers, roads). pts: [[x, z], ...]
export function strip(pts, width = 10, segs = 200, y = 0) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, y, z)));
  const pos = [], uv = [], idx = [];
  const p = new THREE.Vector3(), t = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    curve.getPointAt(u, p); curve.getTangentAt(u, t);
    const nx = -t.z, nz = t.x;
    const w = width * (0.85 + 0.15 * Math.sin(u * 17));
    pos.push(p.x + nx * w / 2, y, p.z + nz * w / 2, p.x - nx * w / 2, y, p.z - nz * w / 2);
    uv.push(u, 0, u, 1);
    if (i < segs) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.userData.curve = curve;
  return g;
}

// Flock of simple flapping birds (egrets). Returns { mesh, update(t, fn(i) -> {pos, yaw}) }
export function flock(count = 40, { color = 0xffffff, shade = 0xa8b0d0, size = 0.6 } = {}) {
  const g = new THREE.BufferGeometry();
  // body + two wings as one geometry; wings flap via per-frame instance matrices (scale.y trick) -> use two meshes
  const wing = new THREE.BufferGeometry();
  wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.25, 0, 0, -0.25, 1, 0, -0.1, 0, 0, -0.25, 0, 0, 0.25, -1, 0, -0.1], 3));
  wing.computeVertexNormals();
  const mat = cel(color, { shade, side: THREE.DoubleSide, rim: 0.3 });
  const L = new THREE.InstancedMesh(wing, mat, count * 2);
  L.frustumCulled = false;
  const body = new THREE.InstancedMesh(new THREE.ConeGeometry(0.12, 0.7, 6).rotateX(Math.PI / 2), mat, count);
  body.frustumCulled = false;
  const group = new THREE.Group();
  group.add(L, body);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), qa = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(size, size, size), pp = new THREE.Vector3();
  function update(t, fn) {
    for (let i = 0; i < count; i++) {
      const { pos, yaw, flap } = fn(i, t);
      e.set(0, yaw, 0); q.setFromEuler(e);
      m.compose(pos, q, s); body.setMatrixAt(i, m);
      for (const side of [0, 1]) {
        e.set(0, yaw, (side ? -1 : 1) * flap); qa.setFromEuler(e);
        // wing geometry already mirrored (both wings in one geo): use flap as a roll on alternate instances
        m.compose(pos, qa, s);
        L.setMatrixAt(i * 2 + side, m);
      }
    }
    body.instanceMatrix.needsUpdate = true;
    L.instanceMatrix.needsUpdate = true;
  }
  return { group, update };
}
