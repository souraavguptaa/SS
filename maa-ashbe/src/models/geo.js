// Geometry helpers for the hand-built cartoon models.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ink as addInk } from '../core/cel.js';

// Weld seams and recompute smooth normals (drops uv unless keepUv).
export function weld(geo, keepUv = false) {
  if (!keepUv) geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  const g = mergeVertices(geo, 1e-5);
  g.computeVertexNormals();
  return g;
}

// Lathe from [[radius, y], ...] (bottom -> top). rfn(r, y, angle, t) can perturb the radius (pleats, folds).
export function lathe(profile, segs = 32, rfn = null, opts = {}) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y));
  let g = new THREE.LatheGeometry(pts, segs, opts.phiStart ?? 0, opts.phiLength ?? Math.PI * 2);
  if (rfn) {
    const p = g.attributes.position;
    const ys = profile.map((q) => q[1]);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const r = Math.hypot(x, z), a = Math.atan2(x, z); // a = 0 at +Z (front)
      const nr = rfn(r, y, a, (y - y0) / (y1 - y0 || 1));
      const k = r > 1e-6 ? nr / r : 1;
      p.setXYZ(i, x * k, y, z * k);
    }
  }
  if (opts.zScale) g.scale(1, 1, opts.zScale);
  if (opts.keepUv) { g.computeVertexNormals(); return g; }
  return weld(g);
}

// Capsule pointing down -Y from the origin (joint at top), length = distance between sphere centres.
export function limb(r1, r2, len, radial = 14) {
  // tapered capsule via lathe
  const prof = [];
  const n = 6;
  for (let i = n; i >= 0; i--) { const a = (i / n) * (Math.PI / 2); prof.push([Math.cos(a) * r2, -len - Math.sin(a) * r2]); }
  for (let i = 0; i <= n; i++) { const a = (i / n) * (Math.PI / 2); prof.push([Math.cos(a) * r1, Math.sin(a) * r1]); }
  // make the profile strictly bottom -> top
  return lathe(prof, radial);
}

export function ellipsoid(rx, ry, rz, w = 24, h = 16) {
  const g = new THREE.SphereGeometry(1, w, h);
  g.scale(rx, ry, rz);
  return weld(g);
}

// A dynamic flattened tube (ribbon with thickness) whose spine can be rewritten every frame.
// spine: array of THREE.Vector3 (length n). width(t), thick(t) are functions of 0..1.
export class Ribbon {
  constructor(n, width = 0.1, thick = 0.02, radial = 8) {
    this.n = n; this.radial = radial;
    this.width = typeof width === 'function' ? width : () => width;
    this.thick = typeof thick === 'function' ? thick : () => thick;
    const vcount = n * radial + 2;
    const pos = new Float32Array(vcount * 3);
    const idx = [];
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * radial + j, b = i * radial + ((j + 1) % radial), c = (i + 1) * radial + j, d = (i + 1) * radial + ((j + 1) % radial);
        idx.push(a, b, c, b, d, c);
      }
    }
    const capA = n * radial, capB = n * radial + 1;
    for (let j = 0; j < radial; j++) {
      idx.push(capA, (j + 1) % radial, j);
      idx.push(capB, (n - 1) * radial + j, (n - 1) * radial + ((j + 1) % radial));
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(vcount * 3), 3));
    this.geometry.setIndex(idx);
    this._t = new THREE.Vector3(); this._nrm = new THREE.Vector3(); this._b = new THREE.Vector3();
  }
  // spine: Vector3[]; up: preferred "width" direction hint (Vector3) — width spreads along the binormal.
  update(spine, up = new THREE.Vector3(1, 0, 0)) {
    const { n, radial } = this;
    const pos = this.geometry.attributes.position.array;
    const T = this._t, N = this._nrm, B = this._b;
    for (let i = 0; i < n; i++) {
      const p = spine[i];
      const a = spine[Math.max(0, i - 1)], b = spine[Math.min(n - 1, i + 1)];
      T.subVectors(b, a).normalize();
      B.copy(up).addScaledVector(T, -up.dot(T));
      if (B.lengthSq() < 1e-8) B.set(0, 0, 1).addScaledVector(T, -T.z);
      B.normalize();
      N.crossVectors(T, B).normalize();
      const u = i / (n - 1);
      const w = this.width(u) * 0.5, th = this.thick(u) * 0.5;
      for (let j = 0; j < radial; j++) {
        const ang = (j / radial) * Math.PI * 2;
        const cx = Math.cos(ang) * w, cy = Math.sin(ang) * th;
        const k = (i * radial + j) * 3;
        pos[k] = p.x + B.x * cx + N.x * cy;
        pos[k + 1] = p.y + B.y * cx + N.y * cy;
        pos[k + 2] = p.z + B.z * cx + N.z * cy;
      }
    }
    const ca = n * radial * 3, cb = (n * radial + 1) * 3;
    pos[ca] = spine[0].x; pos[ca + 1] = spine[0].y; pos[ca + 2] = spine[0].z;
    pos[cb] = spine[n - 1].x; pos[cb + 1] = spine[n - 1].y; pos[cb + 2] = spine[n - 1].z;
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
  }
}

// Extruded 2D shape (for crowns, emblems, flat ornaments). points: [[x,y],...] closed.
export function extrudeShape(points, depth = 0.02, bevel = 0.004, holes = []) {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 12 });
  g.translate(0, 0, -depth / 2);
  return g;
}

// Torus arc in the XY plane centred at origin (for brows, smiles, lash lines).
export function arc(radius, tube, angle, rot = 0, radial = 6, tubular = 20) {
  const g = new THREE.TorusGeometry(radius, tube, radial, tubular, angle);
  g.rotateZ(rot - angle / 2);
  return g;
}

// Merge every static cel mesh under `root` into one mesh per material (keeps ink outlines). Big draw-call saver.
export function bakeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map();
  const remove = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSprite || o.userData.isInk || o.userData.keep) return;
    if (!o.material || !o.material.isCel || o.material.uniforms.map || !o.visible) return;
    let g = o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
    if (g.index) g = g.toNonIndexed();
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    const inkChild = o.children.find((c) => c.userData.isInk);
    const w = inkChild ? inkChild.material.uniforms.uInk.value : 0;
    const key = o.material.uuid + '|' + w;
    if (!groups.has(key)) groups.set(key, { mat: o.material, w, geos: [] });
    groups.get(key).geos.push(g);
    remove.push(o);
  });
  for (const o of remove) o.parent && o.parent.remove(o);
  for (const { mat, w, geos } of groups.values()) {
    const anyColor = geos.some((g) => g.attributes.color);
    if (anyColor) for (const g of geos) if (!g.attributes.color) { const c = new Float32Array(g.attributes.position.count * 3).fill(1); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, mat);
    if (w > 0) addInk(m, w);
    root.add(m);
  }
  return root;
}
