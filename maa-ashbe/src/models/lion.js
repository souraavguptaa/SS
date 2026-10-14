// Singho: a friendly cartoon lion with a flame-shaped mane. Faces +Z, Y up, root at the ground under the body.
import * as THREE from 'three';
import { cel, ink } from '../core/cel.js';
import { lathe, limb, ellipsoid, Ribbon } from './geo.js';
import { lerp, clamp, mulberry32 } from '../core/util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function makeLion(opts = {}) {
  const W = opts.ink ?? 2.4;
  const root = new THREE.Group();
  root.name = 'lion';
  root.rotation.order = 'YXZ';
  const J = {};
  const M = {
    coat: cel(0xeaa23a, { shade: 0x9a4a2a, rim: 0.8 }),
    belly: cel(0xf8dc9c, { shade: 0xc48a5a }),
    maneOuter: cel(0xc2410c, { shade: 0x6e1a10 }),
    maneMid: cel(0xf06a14, { shade: 0x9a2a10 }),
    maneInner: cel(0xffb22a, { shade: 0xc0601a }),
    nose: cel(0x5a2420, { shade: 0x2a0e0c, spec: 0.8 }),
    eyeWhite: cel(0xf2eee6, { flat: true }),
    iris: cel(0x8ab83a, { shade: 0x4a7020, rim: 0 }),
    pupil: cel(0x050302, { flat: true }),
    dark: cel(0x241008, { flat: true }),
    mouth: cel(0x5a0e14, { flat: true }),
    tongue: cel(0xe86a7a, { shade: 0xa03a4a }),
    teeth: cel(0xffffff, { shade: 0xd0d0e0 }),
    claw: cel(0xfff4e0, { flat: true }),
    highlight: cel(0xffffff, { flat: true }),
    gold: cel(0xffc23a, { spec: 1.2, shade: 0xa04a10 }),
  };
  const parts = [];
  const add = (parent, geo, mat, w = W) => { const m = new THREE.Mesh(geo, mat); if (w > 0) ink(m, w); parent.add(m); parts.push(m); return m; };
  const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

  J.body = grp(root, 0, 0.95, 0);
  // torso: lathe along Z (build along Y then rotate)
  const torso = lathe([[0.02, -0.82], [0.2, -0.78], [0.31, -0.62], [0.34, -0.35], [0.31, -0.05], [0.33, 0.25], [0.37, 0.5], [0.33, 0.7], [0.2, 0.82], [0.02, 0.86]], 32, null);
  torso.rotateX(Math.PI / 2);
  torso.scale(1, 1.0, 1);
  add(J.body, torso, M.coat);
  const belly = add(J.body, ellipsoid(0.22, 0.2, 0.62), M.belly, W * 0.6);
  belly.position.set(0, -0.15, 0.05);
  // shoulders + haunches
  for (const s of [1, -1]) {
    add(J.body, ellipsoid(0.17, 0.27, 0.24), M.coat, W).position.set(s * 0.2, 0.0, 0.5);
    add(J.body, ellipsoid(0.17, 0.27, 0.27), M.coat, W).position.set(s * 0.19, 0.02, -0.52);
  }

  // ---- legs ----
  J.legs = [];
  const legDefs = [
    { name: 'FL', x: 0.2, z: 0.52, front: true, s: 1 }, { name: 'FR', x: -0.2, z: 0.52, front: true, s: -1 },
    { name: 'BL', x: 0.19, z: -0.55, front: false, s: 1 }, { name: 'BR', x: -0.19, z: -0.55, front: false, s: -1 },
  ];
  for (const d of legDefs) {
    const hip = grp(J.body, d.x, -0.08, d.z);
    add(hip, limb(0.12, 0.085, 0.42, 12), M.coat);
    const knee = grp(hip, 0, -0.43, 0);
    add(knee, limb(0.08, 0.07, 0.36, 12), M.coat);
    const ankle = grp(knee, 0, -0.37, 0);
    const paw = add(ankle, ellipsoid(0.095, 0.06, 0.12), M.belly, W);
    paw.position.set(0, -0.03, 0.05);
    for (let k = -1; k <= 1; k++) {
      const toe = add(ankle, ellipsoid(0.03, 0.028, 0.032), M.belly, W * 0.6);
      toe.position.set(k * 0.05, -0.04, 0.15);
    }
    J.legs.push({ ...d, hip, knee, ankle });
  }

  // ---- neck + head ----
  J.neck = grp(J.body, 0, 0.22, 0.72);
  add(J.neck, ellipsoid(0.22, 0.26, 0.24), M.coat, W).position.set(0, 0.06, 0.04);
  J.head = grp(J.neck, 0, 0.26, 0.16);
  add(J.head, ellipsoid(0.24, 0.23, 0.24), M.coat, W);
  // muzzle
  for (const s of [1, -1]) add(J.head, ellipsoid(0.1, 0.085, 0.09), M.belly, W * 0.7).position.set(s * 0.075, -0.08, 0.2);
  const chin = add(J.head, ellipsoid(0.08, 0.06, 0.08), M.belly, W * 0.7);
  chin.position.set(0, -0.15, 0.17);
  const nose = add(J.head, ellipsoid(0.07, 0.05, 0.05), M.nose, W * 0.6);
  nose.position.set(0, -0.015, 0.27);
  nose.rotation.x = 0.3;
  // whisker dots
  for (const s of [1, -1]) for (let k = 0; k < 3; k++) add(J.head, new THREE.SphereGeometry(0.008, 6, 4), M.dark, 0).position.set(s * (0.06 + k * 0.025), -0.07 - (k % 2) * 0.02, 0.28 - k * 0.02);
  // eyes
  J.eyes = [];
  for (const s of [1, -1]) {
    const eye = grp(J.head, s * 0.1, 0.07, 0.19);
    eye.rotation.y = s * 0.35;
    const lid = grp(eye);
    add(lid, ellipsoid(0.055, 0.06, 0.025), M.eyeWhite, W * 0.6);
    const iris = grp(lid, 0, 0, 0.016);
    add(iris, ellipsoid(0.035, 0.042, 0.012), M.iris, 0);
    add(iris, ellipsoid(0.018, 0.026, 0.008), M.pupil, 0).position.z = 0.006;
    add(iris, new THREE.SphereGeometry(0.009, 8, 6), M.highlight, 0).position.set(s * 0.012, 0.016, 0.012);
    const brow = add(eye, ellipsoid(0.07, 0.022, 0.03), M.coat, W * 0.6);
    brow.position.set(0, 0.06, 0.0); brow.rotation.z = s * 0.25;
    J.eyes.push({ eye, lid, iris, brow, s });
  }
  // ears
  for (const s of [1, -1]) {
    const ear = add(J.head, ellipsoid(0.07, 0.07, 0.035), M.coat, W);
    ear.position.set(s * 0.17, 0.2, -0.02);
    add(ear, ellipsoid(0.04, 0.04, 0.02), M.belly, 0).position.z = 0.02;
  }
  // jaw (opens for the roar)
  J.jaw = grp(J.head, 0, -0.12, 0.05);
  add(J.jaw, ellipsoid(0.12, 0.05, 0.15), M.belly, W * 0.7).position.set(0, -0.03, 0.1);
  J.mouthIn = add(J.head, ellipsoid(0.1, 0.07, 0.08), M.mouth, 0);
  J.mouthIn.position.set(0, -0.13, 0.18);
  const tongue = add(J.jaw, ellipsoid(0.07, 0.02, 0.09), M.tongue, 0);
  tongue.position.set(0, -0.005, 0.11);
  for (const s of [1, -1]) {
    const fang = add(J.head, new THREE.ConeGeometry(0.018, 0.05, 8), M.teeth, W * 0.4);
    fang.rotation.x = Math.PI; fang.position.set(s * 0.05, -0.11, 0.24);
    const lf = add(J.jaw, new THREE.ConeGeometry(0.015, 0.04, 8), M.teeth, W * 0.4);
    lf.position.set(s * 0.045, 0.01, 0.2);
  }

  // ---- mane: flame petals radiating from behind the face ----
  J.mane = grp(J.head, 0, 0.0, -0.04);
  J.manePetals = [];
  const rnd = mulberry32(17);
  // rings of flame petals: (tilt back from the face plane, radius, length, width, material)
  const layers = [
    { n: 15, tilt: 1.15, r: 0.12, len: 0.3, w: 0.1, mat: M.maneOuter, z: -0.16 },
    { n: 18, tilt: 0.75, r: 0.18, len: 0.34, w: 0.1, mat: M.maneOuter, z: -0.08 },
    { n: 16, tilt: 0.42, r: 0.19, len: 0.27, w: 0.09, mat: M.maneMid, z: -0.02 },
    { n: 13, tilt: 0.15, r: 0.18, len: 0.17, w: 0.075, mat: M.maneInner, z: 0.03 },
  ];
  const petalGeo = {};
  for (const L of layers) {
    const key = L.len + ':' + L.w;
    petalGeo[key] = petalGeo[key] || (() => {
      const g = lathe([[0.001, 0.0], [L.w * 0.75, L.len * 0.12], [L.w, L.len * 0.35], [L.w * 0.7, L.len * 0.65], [L.w * 0.25, L.len * 0.9], [0.001, L.len]], 10, null);
      g.scale(1, 1, 0.55);
      return g;
    })();
    for (let i = 0; i < L.n; i++) {
      const a = (i / L.n) * Math.PI * 2 + rnd() * 0.15 + L.tilt;
      const holder = grp(J.mane, 0, 0, L.z);
      holder.rotation.z = a;
      const pivot = grp(holder, 0, L.r, 0);
      const petal = add(pivot, petalGeo[key], L.mat, W * 0.8);
      const base = -L.tilt - 0.2 - rnd() * 0.25;
      petal.rotation.x = base;
      petal.rotation.z = (rnd() - 0.5) * 0.3;
      J.manePetals.push({ pivot, petal, a, base, len: L.len, ph: rnd() * 6.28 });
    }
  }
  // mane continues down the back of the neck
  for (let i = 0; i < 9; i++) {
    const u = i / 8;
    for (const s of [-1, 0, 1]) {
      const holder = grp(J.neck, s * 0.1 * (1 - u * 0.5), 0.28 - u * 0.25, -0.05 - u * 0.12);
      const petal = add(holder, petalGeo['0.3:0.1'] || petalGeo[Object.keys(petalGeo)[0]], s === 0 ? M.maneOuter : M.maneMid, W * 0.8);
      petal.rotation.set(-2.0 - u * 0.4, 0, s * 0.7);
      petal.scale.setScalar(0.9 - u * 0.25);
    }
  }
  // chest ruff
  for (let i = 0; i < 5; i++) {
    const p = add(J.neck, ellipsoid(0.07, 0.12, 0.05), M.maneMid, W * 0.7);
    p.position.set((i - 2) * 0.07, -0.05 - Math.abs(i - 2) * 0.02, 0.2);
    p.rotation.x = 0.4;
  }

  // ---- tail ----
  J.tail = new Ribbon(14, (u) => lerp(0.07, 0.035, u), (u) => lerp(0.07, 0.035, u), 8);
  J.tailMesh = new THREE.Mesh(J.tail.geometry, M.coat);
  J.tailMesh.frustumCulled = false;
  ink(J.tailMesh, W * 0.8, { raw: true });
  J.body.add(J.tailMesh);
  J.tuft = grp(J.body);
  for (let i = 0; i < 6; i++) {
    const tp = add(J.tuft, new THREE.ConeGeometry(0.055, 0.2, 8), i % 2 ? M.maneOuter : M.maneMid, W * 0.7);
    tp.rotation.x = Math.PI / 2 + (i - 2.5) * 0.12;
    tp.rotation.z = (i - 2.5) * 0.2;
    tp.position.z = -0.06;
  }

  const state = { wind: V(0, 0, 0), roar: 0, t: 0, tailLift: 0.3, maneFlare: 0 };
  const setRot = (o, r, m = 1) => { if (r) o.rotation.set(r[0], (r[1] || 0) * m, (r[2] || 0) * m); };

  function setPose(p) {
    if (p.root) { root.position.set(p.root[0], p.root[1], p.root[2]); root.rotation.set(p.rootRx || 0, p.root[3] || 0, p.rootRz || 0); }
    J.body.position.y = 0.95 + (p.bodyY || 0);
    setRot(J.body, p.body || [0, 0, 0]);
    setRot(J.neck, p.neck || [0, 0, 0]);
    setRot(J.head, p.head || [0, 0, 0]);
    for (const L of J.legs) {
      const k = L.name;
      setRot(L.hip, p[k + 'hip'] || [0, 0, 0]);
      setRot(L.knee, p[k + 'knee'] || [0, 0, 0]);
      setRot(L.ankle, p[k + 'ankle'] || [0, 0, 0]);
    }
    const f = p.face || {};
    const blink = clamp(f.blink ?? 0, 0, 1);
    for (const e of J.eyes) {
      e.lid.scale.y = Math.max(0.06, 1 - blink * 0.95);
      e.iris.position.x = (f.lookX ?? 0) * 0.014;
      e.iris.position.y = (f.lookY ?? 0) * 0.012;
      e.brow.position.y = 0.06 + (f.browUp ?? 0) * 0.025 - blink * 0.01;
    }
    const roar = clamp(p.roar ?? 0, 0, 1);
    state.roar = roar;
    J.jaw.rotation.x = 0.55 * roar;
    J.mouthIn.scale.set(1, 0.2 + roar * 1.2, 1);
    J.mouthIn.visible = roar > 0.03;
    state.maneFlare = p.maneFlare ?? roar;
    if (p.wind) state.wind.set(...p.wind);
    state.tailLift = p.tailLift ?? 0.3;
  }

  const wL = V(), gL = V(), q = new THREE.Quaternion();
  function animate(t) {
    state.t = t;
    root.updateMatrixWorld(true);
    // mane sway / flare
    J.body.getWorldQuaternion(q).invert();
    wL.copy(state.wind).applyQuaternion(q);
    const wm = Math.min(state.wind.length(), 2);
    for (const m of J.manePetals) {
      const sway = Math.sin(t * (3 + wm * 4) + m.ph) * (0.04 + 0.08 * wm);
      m.petal.rotation.x = m.base - state.maneFlare * 0.45 - wm * 0.12 + sway;
      const s = 1.12 + state.maneFlare * 0.25;
      m.pivot.scale.set(s, s, s);
    }
    // tail: arcs up then follows the wind
    gL.set(0, -1, 0).applyQuaternion(q);
    const pts = [];
    const base = V(0, 0.12, -0.8);
    for (let i = 0; i < 14; i++) {
      const u = i / 13;
      const p = V().copy(base);
      p.z -= u * 0.75;
      p.y += Math.sin(u * Math.PI) * 0.25 * state.tailLift + (u * u) * (0.25 * state.tailLift - 0.25);
      p.addScaledVector(wL, u * u * 0.4);
      p.x += Math.sin(t * 2.4 - u * 4) * 0.08 * u;
      pts.push(p);
    }
    J.tail.update(pts, V(1, 0, 0));
    J.tuft.position.copy(pts[13]);
    const dir = V().subVectors(pts[13], pts[11]).normalize();
    J.tuft.quaternion.setFromUnitVectors(V(0, 0, -1), dir);
  }

  setPose(LION.stand);
  return { root, J, M, parts, setPose, animate, state };
}

export const LION = {
  stand: { face: {} },
  sleep: {
    bodyY: -0.52,
    FLhip: [-1.35, 0, 0], FLknee: [1.2, 0, 0], FLankle: [0.15, 0, 0],
    FRhip: [-1.35, 0, 0], FRknee: [1.2, 0, 0], FRankle: [0.15, 0, 0],
    BLhip: [-1.25, 0, -0.25], BLknee: [2.2, 0, 0], BLankle: [-0.9, 0, 0],
    BRhip: [-1.25, 0, 0.25], BRknee: [2.2, 0, 0], BRankle: [-0.9, 0, 0],
    neck: [0.55, 0, 0], head: [0.2, 0.25, 0.12], face: { blink: 1 }, tailLift: -0.1,
  },
  sitUp: {
    bodyY: -0.25, body: [-0.35, 0, 0],
    FLhip: [0.3, 0, 0], FLknee: [0.0, 0, 0], FRhip: [0.3, 0, 0], FRknee: [0, 0, 0],
    BLhip: [-1.3, 0, -0.2], BLknee: [2.3, 0, 0], BLankle: [-1.0, 0, 0],
    BRhip: [-1.3, 0, 0.2], BRknee: [2.3, 0, 0], BRankle: [-1.0, 0, 0],
    neck: [0.2, 0, 0], head: [0.15, 0, 0],
  },
  roar: {
    bodyY: -0.1, body: [-0.15, 0, 0],
    FLhip: [0.2, 0, 0], FRhip: [0.2, 0, 0], BLhip: [-0.4, 0, 0], BLknee: [0.7, 0, 0], BRhip: [-0.4, 0, 0], BRknee: [0.7, 0, 0],
    neck: [-0.45, 0, 0], head: [-0.35, 0, 0], roar: 1, face: { blink: 0.5, browUp: -0.5 }, tailLift: 1,
  },
  leap: {
    body: [-0.2, 0, 0],
    FLhip: [-1.4, 0, 0], FLknee: [0.3, 0, 0], FLankle: [0.4, 0, 0],
    FRhip: [-1.25, 0, 0], FRknee: [0.5, 0, 0], FRankle: [0.4, 0, 0],
    BLhip: [1.1, 0, 0], BLknee: [0.2, 0, 0], BLankle: [0.6, 0, 0],
    BRhip: [1.25, 0, 0], BRknee: [0.1, 0, 0], BRankle: [0.6, 0, 0],
    neck: [-0.1, 0, 0], head: [0.1, 0, 0], tailLift: 0.6,
  },
  crouch: {
    bodyY: -0.3, body: [0.12, 0, 0],
    FLhip: [-0.5, 0, 0], FLknee: [1.0, 0, 0], FLankle: [-0.4, 0, 0],
    FRhip: [-0.5, 0, 0], FRknee: [1.0, 0, 0], FRankle: [-0.4, 0, 0],
    BLhip: [-0.9, 0, 0], BLknee: [1.7, 0, 0], BLankle: [-0.8, 0, 0],
    BRhip: [-0.9, 0, 0], BRknee: [1.7, 0, 0], BRankle: [-0.8, 0, 0],
    neck: [0.1, 0, 0], head: [-0.15, 0, 0], tailLift: 0.8,
  },
};

// Add a gallop cycle on top of a base pose (element-wise for joint arrays).
export function withGallop(base, phase, amt = 1) {
  const g = gallop(phase, amt);
  const out = { ...base };
  const rest = gallop(0.0, 0);
  for (const [k, v] of Object.entries(g)) {
    if (Array.isArray(v)) { const b = base[k] || [0, 0, 0]; const r0 = rest[k] || [0, 0, 0]; out[k] = b.map((x, i) => x + (v[i] - r0[i])); }
    else out[k] = (base[k] || 0) + v;
  }
  return out;
}

// Rotary gallop cycle (phase 0..1) blended into a pose.
export function gallop(phase, amt = 1) {
  const s = (o) => Math.sin((phase + o) * Math.PI * 2);
  const c = (o) => Math.cos((phase + o) * Math.PI * 2);
  return {
    body: [s(0) * 0.08 * amt, 0, 0], bodyY: c(0) * 0.06 * amt,
    FLhip: [-0.2 - s(0.0) * 0.9 * amt, 0, 0], FLknee: [0.3 + Math.max(0, c(0.0)) * 1.0 * amt, 0, 0],
    FRhip: [-0.2 - s(0.1) * 0.9 * amt, 0, 0], FRknee: [0.3 + Math.max(0, c(0.1)) * 1.0 * amt, 0, 0],
    BLhip: [0.1 + s(0.5) * 0.8 * amt, 0, 0], BLknee: [0.4 + Math.max(0, -c(0.5)) * 0.9 * amt, 0, 0], BLankle: [0.3, 0, 0],
    BRhip: [0.1 + s(0.6) * 0.8 * amt, 0, 0], BRknee: [0.4 + Math.max(0, -c(0.6)) * 0.9 * amt, 0, 0], BRankle: [0.3, 0, 0],
    neck: [s(0.25) * 0.08 * amt, 0, 0],
  };
}
