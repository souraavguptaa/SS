// Parametric cel-shaded cartoon human (Uma, Ma, the Dhaki, townsfolk, and the ten-armed goddess).
// Faces +Z, Y up, root at the feet. Poses are plain objects that can be blended.
import * as THREE from 'three';
import { cel, ink, glow } from '../core/cel.js';
import { glowSprite } from '../core/fx.js';
import { lathe, limb, ellipsoid, Ribbon, extrudeShape, arc, weld as weldGeo } from './geo.js';
import { lerp, clamp, noise1 } from '../core/util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function stripeTexture(base, border, edge = 0.1, extra = null) {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 8, 128);
  g.fillStyle = border;
  const e = Math.round(edge * 128);
  // flattened tube cross-section: edges at v = 0, 0.5, 1
  g.fillRect(0, 0, 8, e); g.fillRect(0, 64 - e, 8, 2 * e); g.fillRect(0, 128 - e, 8, e);
  if (extra) { g.fillStyle = extra; g.fillRect(0, e + 2, 8, 3); g.fillRect(0, 64 - e - 5, 8, 3); g.fillRect(0, 64 + e + 2, 8, 3); g.fillRect(0, 128 - e - 5, 8, 3); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}

export function checkTexture(a = '#c81e1e', b = '#f4efe6', n = 8) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = b; g.fillRect(0, 0, 64, 64);
  g.fillStyle = a;
  const s = 64 / n;
  for (let i = 0; i < n; i += 2) { g.fillRect(i * s, 0, s * 0.6, 64); g.fillRect(0, i * s, 64, s * 0.6); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Adds uv to a Ribbon (u along, v around) so stripe textures can mark the borders.
function ribbonUV(r) {
  const { n, radial } = r;
  const uv = new Float32Array((n * radial + 2) * 2);
  for (let i = 0; i < n; i++) for (let j = 0; j < radial; j++) { uv[(i * radial + j) * 2] = i / (n - 1); uv[(i * radial + j) * 2 + 1] = j / radial; }
  r.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

const DEFAULTS = {
  skin: 0xd9935e, skinShade: 0x9a4f3a, hair: 0x16110f, hairShade: 0x0a0608,
  outfit: 'saree', saree: 0xc8102e, sareeShade: 0x7a0a2a, border: 0xffc23a, blouse: 0xb5102a,
  kurta: 0xf08a1c, dhoti: 0xf6f1e4,
  hairStyle: 'long', crown: false, thirdEye: false, glasses: false, mustache: false, bindi: 0xd4121e, sindoor: true,
  shankha: true, bangles: 0xffc23a, shawl: null, iris: 0x2a1408, height: 1, armCount: 2, earrings: true, necklace: true,
  ink: 2.2, lips: 0x8e2a2a, blush: 0xe87a6a, nosering: false, grey: false, headScale: 1.12,
};

export function makeHuman(options = {}) {
  const o = { ...DEFAULTS, ...options };
  const root = new THREE.Group();
  root.name = o.name || 'human';
  const J = {};
  const M = {};
  const parts = []; // meshes for global material tweaks
  const W = o.ink;

  // ---- materials ----
  M.skin = cel(o.skin, { shade: o.skinShade, rim: 0.5, term: 0.3 });
  M.hair = cel(o.hair, { shade: o.hairShade, spec: 0.25, rim: 0.35 });
  M.saree = cel(o.saree, { shade: o.sareeShade });
  M.border = cel(o.border, { spec: 0.6, shade: new THREE.Color(o.border).multiplyScalar(0.55) });
  M.blouse = cel(o.blouse, { shade: new THREE.Color(o.blouse).multiplyScalar(0.55) });
  M.white = cel(0xfffdf6, { shade: 0xc9c2d8 });
  M.eyeWhite = cel(0xf2eee8, { flat: true });
  M.iris = cel(o.iris, { shade: new THREE.Color(o.iris).multiplyScalar(0.6), rim: 0 });
  M.pupil = cel(0x050302, { flat: true });
  M.dark = cel(0x1a0b08, { flat: true });
  M.lips = cel(o.lips, { shade: new THREE.Color(o.lips).multiplyScalar(0.6) });
  M.mouth = cel(0x3a0a0e, { flat: true });
  M.teeth = cel(0xffffff, { flat: true });
  M.gold = cel(0xffc23a, { spec: 0.7, shade: 0xa04a10, rim: 1 });
  M.red = cel(0xd4121e, { shade: 0x80081a });
  M.sindoor = cel(0xe0101c, { flat: true });
  M.shell = cel(0xfaf6ea, { shade: 0xb8b0c8, spec: 0.8 });
  M.highlight = cel(0xffffff, { flat: true });
  M.blush = cel(o.blush, { flat: true, opacity: 0.45, depthWrite: false });
  M.kurta = cel(o.kurta, { shade: new THREE.Color(o.kurta).multiplyScalar(0.55) });
  M.dhoti = cel(o.dhoti, { shade: 0xb0a8c4 });
  M.glass = cel(0x2a1a14, { flat: true });

  const add = (parent, geo, mat, w = W, name) => {
    const m = new THREE.Mesh(geo, mat);
    if (w > 0) ink(m, w);
    if (name) m.name = name;
    parent.add(m);
    parts.push(m);
    return m;
  };
  const grp = (parent, x = 0, y = 0, z = 0, name) => { const g = new THREE.Group(); g.position.set(x, y, z); if (name) g.name = name; parent.add(g); return g; };

  const hs = o.headScale;
  const hipH = 0.86;
  J.base = grp(root, 0, 0, 0, 'base');
  J.hips = grp(J.base, 0, hipH, 0, 'hips');
  J.spine = grp(J.hips, 0, 0.0, 0, 'spine');
  J.chest = grp(J.spine, 0, 0.18, 0, 'chest');
  J.neck = grp(J.chest, 0, 0.27, 0, 'neck');
  J.head = grp(J.neck, 0, 0.075, 0, 'head');

  // ---- torso ----
  const torsoProf = [[0.115, -0.2], [0.122, -0.12], [0.148, 0.02], [0.156, 0.13], [0.148, 0.2], [0.105, 0.255], [0.06, 0.275], [0.045, 0.28]];
  const torsoR = (y) => { for (let i = 1; i < torsoProf.length; i++) if (y <= torsoProf[i][1]) { const [r0, y0] = torsoProf[i - 1], [r1, y1] = torsoProf[i]; return lerp(r0, r1, (y - y0) / (y1 - y0)); } return 0.05; };
  const torsoMat = o.outfit === 'dhoti' ? M.kurta : M.blouse;
  if (o.outfit === 'dhoti') {
    // kurta: torso + flared tunic skirt
    add(J.chest, lathe(torsoProf, 28, null, { zScale: 0.74 }), M.kurta);
    add(J.hips, lathe([[0.2, -0.42], [0.18, -0.3], [0.15, -0.1], [0.13, 0.05], [0.12, 0.1]], 28, (r, y, a) => r + 0.006 * Math.sin(a * 10) * (1 - (y + 0.42) / 0.5), { zScale: 0.82 }), M.kurta);
  } else {
    add(J.chest, lathe(torsoProf, 28, null, { zScale: 0.72 }), torsoMat);
  }
  // neck
  add(J.neck, limb(0.044, 0.046, 0.07, 12).translate(0, 0.07, 0), M.skin, W * 0.8);

  // ---- head ----
  const R = 0.14;
  const headC = V(0, 0.14, 0);
  J.face = grp(J.head, headC.x, headC.y, headC.z, 'face');
  J.face.scale.setScalar(hs);
  // skull + jaw as a lathe so the chin narrows
  const headGeo = lathe([[0.001, -0.165], [0.045, -0.158], [0.085, -0.13], [0.118, -0.08], [0.138, -0.02], [0.141, 0.04], [0.134, 0.09], [0.11, 0.13], [0.07, 0.152], [0.001, 0.158]], 32, null, { zScale: 1.0 });
  J.skull = add(J.face, headGeo, M.skin, W, 'skull');
  // surface helper: yaw a (+ = character's left = +x), pitch b (+ up)
  const onHead = (a, b, out = 0) => {
    const y = Math.sin(b) * 0.15;
    const rr = (y < -0.08 ? lerp(0.118, 0.085, (-0.08 - y) / 0.05) : y > 0.09 ? lerp(0.134, 0.11, (y - 0.09) / 0.04) : 0.14) + out;
    const p = V(Math.sin(a) * Math.cos(b) * rr / Math.cos(b), y, Math.cos(a) * rr);
    const n = V(Math.sin(a), Math.sin(b) * 0.6, Math.cos(a)).normalize();
    return { p, n };
  };
  const placeOn = (obj, a, b, out = 0) => {
    const { p, n } = onHead(a, b, out);
    obj.position.copy(p);
    obj.quaternion.setFromUnitVectors(V(0, 0, 1), n);
    return obj;
  };

  // ears
  for (const s of [1, -1]) {
    const ear = add(J.face, ellipsoid(0.018, 0.034, 0.014), M.skin, W * 0.7);
    ear.position.set(s * 0.138, -0.015, -0.005);
    ear.rotation.y = s * 0.3;
    if (o.earrings) {
      const er = grp(J.face, s * 0.142, -0.06, 0.0);
      add(er, new THREE.SphereGeometry(0.006, 8, 6), M.gold, 0).position.y = 0.002;
      add(er, lathe([[0.017, -0.034], [0.016, -0.026], [0.011, -0.014], [0.005, -0.006], [0.001, -0.004]], 12), M.gold, W * 0.5);
      for (let k = 0; k < 5; k++) { const d = add(er, new THREE.SphereGeometry(0.0035, 6, 4), M.gold, 0); const a = (k / 5) * Math.PI * 2; d.position.set(Math.cos(a) * 0.015, -0.038, Math.sin(a) * 0.015); }
      J['earring' + (s > 0 ? 'L' : 'R')] = er;
    }
  }
  // nose
  const nose = add(J.face, ellipsoid(0.0105, 0.016, 0.013), M.skin, 0);
  placeOn(nose, 0, -0.17, -0.004);
  for (const s of [1, -1]) { const nos = add(J.face, ellipsoid(0.0035, 0.0025, 0.002), M.dark, 0); placeOn(nos, s * 0.035, -0.235, 0.004); }
  if (o.nosering) {
    const nr = add(J.face, new THREE.TorusGeometry(0.011, 0.0018, 6, 20), M.gold, 0);
    placeOn(nr, 0.1, -0.25, 0.006);
    nr.rotateY(1.2);
  }

  // eyes
  J.eyes = [];
  for (const s of [1, -1]) {
    const eye = grp(J.face, 0, 0, 0, 'eye');
    placeOn(eye, s * 0.38, 0.02, -0.006);
    const lid = grp(eye, 0, 0, 0); // scaled for blinks
    add(lid, ellipsoid(0.031, 0.036, 0.014), M.eyeWhite, W * 0.45);
    const iris = grp(lid, 0, 0, 0.009);
    add(iris, ellipsoid(0.0195, 0.024, 0.007), M.iris, 0);
    add(iris, ellipsoid(0.0105, 0.0135, 0.0045), M.pupil, 0).position.z = 0.004;
    add(iris, new THREE.SphereGeometry(0.0055, 8, 6), M.highlight, 0).position.set(s * 0.007, 0.009, 0.008);
    add(iris, new THREE.SphereGeometry(0.0028, 6, 4), M.highlight, 0).position.set(-s * 0.006, -0.008, 0.008);
    // upper lash / kajal line with a winged flick
    const lash = grp(eye, 0, 0, 0.004);
    add(lash, arc(0.034, 0.0048, 2.5, Math.PI / 2), M.dark, 0);
    const wing = add(lash, new THREE.ConeGeometry(0.004, 0.022, 6), M.dark, 0);
    wing.position.set(s * 0.034, 0.006, 0); wing.rotation.z = -s * 1.1;
    const lower = add(eye, arc(0.033, 0.0018, 1.6, -Math.PI / 2), M.dark, 0);
    lower.position.z = 0.003;
    // brow
    const brow = grp(J.face, 0, 0, 0, 'brow');
    placeOn(brow, s * 0.36, 0.33, 0.0);
    add(brow, arc(0.042, 0.0045, 1.25, Math.PI / 2 + s * 0.08), M.dark, 0).position.y = -0.03;
    J.eyes.push({ eye, lid, iris, lash, brow, s });
  }
  // blush
  for (const s of [1, -1]) { const b = add(J.face, ellipsoid(0.022, 0.012, 0.004), M.blush, 0); placeOn(b, s * 0.52, -0.2, 0.001); }

  // mouth
  J.mouth = grp(J.face, 0, 0, 0, 'mouth');
  placeOn(J.mouth, 0, -0.42, -0.003);
  J.smile = add(J.mouth, arc(0.026, 0.0032, 1.9, -Math.PI / 2), M.lips, 0);
  J.smile.position.y = 0.012;
  J.mouthOpen = grp(J.mouth, 0, 0.003, 0.0);
  add(J.mouthOpen, ellipsoid(0.022, 0.016, 0.008), M.mouth, W * 0.4);
  add(J.mouthOpen, ellipsoid(0.017, 0.004, 0.006), M.teeth, 0).position.set(0, 0.011, 0.004);
  add(J.mouthOpen, ellipsoid(0.012, 0.006, 0.006), M.lips, 0).position.set(0, -0.008, 0.004);

  // bindi / third eye
  if (o.thirdEye) {
    J.third = grp(J.face, 0, 0, 0, 'third');
    placeOn(J.third, 0, 0.5, -0.003);
    add(J.third, ellipsoid(0.011, 0.024, 0.004), M.gold, 0);
    J.thirdIris = add(J.third, ellipsoid(0.0065, 0.016, 0.004), cel(0xd4121e, { emissive: 0x000000 }), 0);
    J.thirdIris.position.z = 0.002;
    J.thirdGlow = glowSprite(0xff7a30, 0.08, 0.8);
    J.thirdGlow.position.z = 0.012;
    J.third.add(J.thirdGlow);
  } else if (o.bindi) {
    const b = add(J.face, ellipsoid(0.011, 0.011, 0.003), cel(o.bindi, { flat: true }), 0);
    placeOn(b, 0, 0.5, -0.001);
  }
  if (o.mustache) {
    const mu = grp(J.face, 0, 0, 0);
    placeOn(mu, 0, -0.3, -0.004);
    for (const s of [1, -1]) {
      const m = add(mu, ellipsoid(0.03, 0.009, 0.008), M.hair, W * 0.5);
      m.position.set(s * 0.024, 0, 0); m.rotation.z = s * -0.3;
    }
  }
  if (o.glasses) {
    J.glasses = grp(J.face, 0, 0, 0, 'glasses');
    for (const s of [1, -1]) {
      const g = grp(J.glasses, 0, 0, 0);
      placeOn(g, s * 0.38, 0.0, 0.03);
      add(g, new THREE.TorusGeometry(0.04, 0.0035, 6, 28), M.glass, 0);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.039, 24), new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.12, depthWrite: false }));
      g.add(lens);
      J['lens' + (s > 0 ? 'L' : 'R')] = lens;
      const temple = add(J.glasses, new THREE.CylinderGeometry(0.0025, 0.0025, 0.13, 5), M.glass, 0);
      temple.rotation.x = Math.PI / 2; temple.position.set(s * 0.132, 0.01, 0.02);
    }
    const bridge = add(J.glasses, new THREE.CylinderGeometry(0.003, 0.003, 0.04, 5), M.glass, 0);
    bridge.rotation.z = Math.PI / 2; placeOn(bridge, 0, 0.05, 0.03);
  }

  // ---- hair ----
  // A shell that follows the head shape; vertices inside the face region are tucked under the skin so the
  // visible hairline is a clean cartoon curve framing the face.
  const headProf = [[0.001, -0.165], [0.045, -0.158], [0.085, -0.13], [0.118, -0.08], [0.138, -0.02], [0.141, 0.04], [0.134, 0.09], [0.11, 0.13], [0.07, 0.152], [0.001, 0.158]];
  const dense = [];
  for (let i = 0; i < headProf.length - 1; i++) for (let k = 0; k < 3; k++) { const t = k / 3; dense.push([lerp(headProf[i][0], headProf[i + 1][0], t), lerp(headProf[i][1], headProf[i + 1][1], t)]); }
  dense.push(headProf[headProf.length - 1]);
  const male = o.hairStyle === 'short';
  const hairY = (t) => {
    if (male) return t <= 1.15 ? 0.105 - 0.03 * t * t : lerp(0.065, -0.07, Math.min(1, (t - 1.15) / (Math.PI - 1.15)));
    return t <= 1.3 ? 0.085 - 0.036 * t * t : lerp(0.024, -0.135, Math.min(1, (t - 1.3) / (Math.PI - 1.3)));
  };
  let shell = new THREE.LatheGeometry(dense.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4) * 1.075, y * 1.045 + 0.008)), 56);
  {
    const sp = shell.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i);
      const t = Math.abs(Math.atan2(x, z));
      // gentle center parting dip + volume at the crown
      if (y < hairY(t)) sp.setXYZ(i, x * 0.86, y, z * 0.86);
      else if (!male) sp.setXYZ(i, x * (1 + 0.02 * Math.min(1, (y - hairY(t)) * 20)), y, z * (1 + 0.02 * Math.min(1, (y - hairY(t)) * 20)));
    }
  }
  shell = weldGeo(shell);
  J.hairCap = add(J.face, shell, M.hair, W);
  if (o.sindoor && o.hairStyle !== 'short') {
    const part = add(J.face, new THREE.TorusGeometry(0.17, 0.0042, 5, 16, 0.42), M.sindoor, 0);
    part.rotation.y = Math.PI / 2;
    part.rotation.z = Math.PI / 2 - 0.14;
    part.position.set(0, 0.0, -0.02);
  }
  if (o.hairStyle === 'bun') {
    const nape = add(J.face, ellipsoid(0.132, 0.12, 0.11), M.hair, W);
    nape.position.set(0, -0.05, -0.065);
    const bun = add(J.face, ellipsoid(0.072, 0.066, 0.06), M.hair, W);
    bun.position.set(0, 0.04, -0.15);
    J.bun = bun;
  }
  J.ribbons = [];
  const mkRibbon = (n, w, th, mat, parent) => {
    const r = new Ribbon(n, w, th, 8);
    ribbonUV(r);
    const m = new THREE.Mesh(r.geometry, mat);
    m.frustumCulled = false;
    ink(m, W * 0.9, { raw: true });
    (parent || J.face).add(m);
    parts.push(m);
    r.mesh = m;
    return r;
  };
  if (o.hairStyle === 'long') {
    J.hairMain = mkRibbon(14, (u) => lerp(0.27, 0.1, u * u) , (u) => lerp(0.06, 0.03, u), M.hair, J.head);
    J.hairL = mkRibbon(10, (u) => lerp(0.07, 0.02, u), 0.03, M.hair, J.head);
    J.hairR = mkRibbon(10, (u) => lerp(0.07, 0.02, u), 0.03, M.hair, J.head);
  }

  // ---- crown (mukut) ----
  if (o.crown) {
    J.crown = grp(J.face, 0, 0.108, -0.028, 'crown');
    J.crown.rotation.x = -0.22;
    const band = add(J.crown, lathe([[0.152, -0.02], [0.158, -0.005], [0.155, 0.012], [0.146, 0.026]], 32, null, { zScale: 1.02 }), M.gold, W * 0.8);
    // front fan ornament
    const fan = [];
    const spikes = 7;
    for (let i = 0; i <= spikes * 2; i++) {
      const a = Math.PI * (0.08 + 0.84 * (i / (spikes * 2)));
      const r = i % 2 === 0 ? 0.2 : 0.14;
      fan.push([Math.cos(a) * r * 0.9, Math.sin(a) * r * 1.15]);
    }
    fan.push([-0.17 * 0.9, 0.0], [0.17 * 0.9, 0.0]);
    fan.sort(() => 0);
    const fanPts = [[0.165, 0.0]];
    for (let i = 0; i <= spikes * 2; i++) { const a = Math.PI * (0.08 + 0.84 * (i / (spikes * 2))); const r = i % 2 === 0 ? 0.21 : 0.15; fanPts.push([Math.cos(a) * r * 0.85, Math.sin(a) * r * 1.2]); }
    fanPts.push([-0.165, 0.0]);
    const front = add(J.crown, extrudeShape(fanPts, 0.012, 0.004), M.gold, W * 0.8);
    front.position.set(0, 0.005, 0.1);
    front.scale.set(1.05, 1.25, 1);
    front.rotation.x = -0.1;
    const jewel = add(J.crown, ellipsoid(0.024, 0.032, 0.012), cel(0xd4121e, { spec: 1.0, shade: 0x700818 }), W * 0.5);
    jewel.position.set(0, 0.1, 0.118);
    for (const s of [1, -1]) {
      const j2 = add(J.crown, ellipsoid(0.013, 0.013, 0.008), cel(0x18a050, { spec: 1.0, shade: 0x0a5028 }), 0);
      j2.position.set(s * 0.075, 0.06, 0.112);
    }
    const halo = add(J.crown, new THREE.TorusGeometry(0.13, 0.006, 6, 40, Math.PI), M.gold, 0);
    halo.position.set(0, 0.06, 0.108);
  }
  if (o.necklace) {
    const nk = add(J.chest, new THREE.TorusGeometry(0.075, 0.009, 8, 32), M.gold, W * 0.6);
    nk.rotation.x = Math.PI / 2 + 0.55; nk.position.set(0, 0.215, 0.035);
    const pend = add(J.chest, ellipsoid(0.02, 0.026, 0.008), M.gold, W * 0.5);
    pend.position.set(0, 0.16, 0.11);
  }

  // ---- arms ----
  J.arms = [];
  const armPairs = Math.max(1, Math.round(o.armCount / 2));
  for (let pair = 0; pair < armPairs; pair++) {
    for (const s of [1, -1]) {
      const sh = grp(J.chest, s * 0.16, 0.2 - pair * 0.004, -pair * 0.02, 'shoulder');
      const upper = add(sh, limb(0.043, 0.036, 0.25, 12), o.outfit === 'dhoti' ? M.kurta : M.skin, W);
      if (o.outfit !== 'dhoti' && pair === 0) add(sh, limb(0.052, 0.046, 0.08, 12), torsoMat, W); // short blouse sleeve
      const el = grp(sh, 0, -0.25, 0, 'elbow');
      add(el, limb(0.036, 0.03, 0.22, 12), M.skin, W);
      const wr = grp(el, 0, -0.225, 0, 'wrist');
      const palm = add(wr, ellipsoid(0.034, 0.048, 0.02), M.skin, W * 0.8);
      palm.position.y = -0.045;
      const thumb = add(wr, ellipsoid(0.012, 0.024, 0.012), M.skin, W * 0.6);
      thumb.position.set(s * -0.028, -0.03, 0.012); thumb.rotation.z = s * 0.5;
      if (o.shankha && pair === 0) {
        add(el, new THREE.TorusGeometry(0.036, 0.009, 8, 20), M.shell, W * 0.5).position.y = -0.2;
        add(el, new THREE.TorusGeometry(0.035, 0.007, 8, 20), M.red, W * 0.4).position.y = -0.18;
        el.children[el.children.length - 1].rotation.x = Math.PI / 2;
        el.children[el.children.length - 2].rotation.x = Math.PI / 2;
      } else if (o.bangles) {
        const b = add(el, new THREE.TorusGeometry(0.034, 0.007, 8, 20), M.gold, W * 0.4);
        b.position.y = -0.19; b.rotation.x = Math.PI / 2;
      }
      J.arms.push({ sh, el, wr, s, pair, palm });
    }
  }

  // ---- lower body ----
  J.legs = [];
  for (const s of [1, -1]) {
    const hip = grp(J.hips, s * 0.085, -0.02, 0, 'hip');
    const thighMat = o.outfit === 'dhoti' ? M.dhoti : M.saree;
    const thigh = add(hip, limb(o.outfit === 'dhoti' ? 0.09 : 0.1, 0.075, 0.38, 12), thighMat, W);
    const knee = grp(hip, 0, -0.4, 0, 'knee');
    const shin = add(knee, limb(0.06, 0.045, 0.36, 12), o.outfit === 'dhoti' ? M.skin : M.saree, W);
    const ankle = grp(knee, 0, -0.38, 0, 'ankle');
    const foot = add(ankle, ellipsoid(0.045, 0.03, 0.085), M.skin, W * 0.8);
    foot.position.set(0, -0.03, 0.045);
    if (o.outfit === 'saree') {
      const hem = add(knee, lathe([[0.1, -0.38], [0.095, -0.3]], 16, null), M.border, W * 0.6);
      hem.visible = true;
    }
    J.legs.push({ hip, thigh, knee, shin, ankle, foot, s });
  }
  if (o.outfit === 'dhoti') {
    const pleatD = (r, y, a, t) => r + 0.01 * Math.sin(a * 18) * Math.exp(-a * a * 4) * (1 - t) + 0.003 * Math.sin(a * 5 + y * 7);
    J.skirt = add(J.hips, lathe([[0.17, -0.8], [0.172, -0.6], [0.16, -0.42], [0.13, -0.25], [0.11, -0.05], [0.1, 0.02]], 32, pleatD, { zScale: 0.8 }), M.dhoti, W, 'dhoti');
    J.skirtBorder = add(J.hips, lathe([[0.176, -0.805], [0.173, -0.77]], 32, (r, y, a) => pleatD(r, y, a, 0) + 0.003), cel(0xc8102e, { shade: 0x7a0a2a }), W * 0.6, 'dhotiBorder');
  }
  if (o.outfit === 'saree') {
    // standing skirt (pleated in front), with border at the hem
    const pleat = (r, y, a, t) => r + 0.012 * Math.sin(a * 22) * Math.exp(-a * a * 3) * (1 - t) + 0.004 * Math.sin(a * 7 + y * 9);
    J.skirt = add(J.hips, lathe([[0.3, -0.86], [0.28, -0.62], [0.235, -0.38], [0.18, -0.15], [0.14, 0.0], [0.125, 0.05]], 40, pleat, { zScale: 0.86 }), M.saree, W, 'skirt');
    J.skirtBorder = add(J.hips, lathe([[0.305, -0.865], [0.3, -0.79], [0.285, -0.75]], 40, (r, y, a, t) => pleat(r, y, a, 0) + 0.004), M.border, W * 0.7, 'skirtBorder');
    // pallu across the chest (static band)
    const sash = [];
    for (let i = 0; i < 14; i++) {
      const u = i / 13;
      const y = lerp(-0.17, 0.25, u);
      const a = lerp(0.75, -1.05, u);
      const r = torsoR(y) * 1.08 + 0.008;
      sash.push(V(Math.sin(a) * r, y, Math.cos(a) * r * 0.74 + 0.004));
    }
    J.sash = new Ribbon(14, (u) => lerp(0.2, 0.13, u), 0.014, 8);
    ribbonUV(J.sash);
    M.pallu = cel(0xffffff, { map: stripeTexture(new THREE.Color(o.saree).getStyle(), new THREE.Color(o.border).getStyle(), 0.09), shade: o.sareeShade, side: THREE.DoubleSide });
    J.sash.mesh = new THREE.Mesh(J.sash.geometry, M.pallu);
    ink(J.sash.mesh, W * 0.8, { raw: true });
    J.chest.add(J.sash.mesh);
    J.sash.update(sash, V(0.4, 0.6, 0.2).normalize());
    // pallu drape hanging over the left shoulder down the back (dynamic)
    J.drape = new Ribbon(16, (u) => lerp(0.15, 0.24, u), 0.016, 8);
    ribbonUV(J.drape);
    J.drape.mesh = new THREE.Mesh(J.drape.geometry, M.pallu);
    J.drape.mesh.frustumCulled = false;
    ink(J.drape.mesh, W * 0.8, { raw: true });
    J.chest.add(J.drape.mesh);
  }
  if (o.outfit === 'saree') {
    const lc = document.createElement('canvas'); lc.width = 64; lc.height = 4;
    const lg = lc.getContext('2d');
    lg.fillStyle = new THREE.Color(o.saree).getStyle(); lg.fillRect(0, 0, 64, 4);
    lg.fillStyle = new THREE.Color(o.border).getStyle(); lg.fillRect(56, 0, 8, 4);
    const lt = new THREE.CanvasTexture(lc); lt.colorSpace = THREE.SRGBColorSpace; lt.magFilter = THREE.NearestFilter;
    M.lap = cel(0xffffff, { map: lt, shade: o.sareeShade });
    J.lap = new Ribbon(12, (u) => lerp(0.46, 0.4, u), (u) => lerp(0.24, 0.07, u), 10);
    ribbonUV(J.lap);
    J.lap.mesh = new THREE.Mesh(J.lap.geometry, M.lap);
    J.lap.mesh.frustumCulled = false;
    ink(J.lap.mesh, W * 0.9, { raw: true });
    J.hips.add(J.lap.mesh);
    J.lap.mesh.visible = false;
  }
  if (o.shawl) {
    M.shawl = cel(o.shawl, { shade: new THREE.Color(o.shawl).multiplyScalar(0.5) });
    const shawlGeo = lathe([[0.25, -0.16], [0.245, -0.05], [0.235, 0.06], [0.215, 0.15], [0.16, 0.23], [0.09, 0.275], [0.07, 0.285]], 36, (r, y, a) => r + 0.007 * Math.sin(a * 9 + y * 20), { zScale: 0.82, phiStart: 0.32, phiLength: Math.PI * 2 - 0.64 });
    M.shawl.side = THREE.DoubleSide;
    J.shawl = add(J.chest, shawlGeo, M.shawl, W, 'shawl');
  }

  // ---- state + pose application ----
  const tmpQ = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const setRot = (obj, r, mirror = 1) => { if (!r) return; obj.rotation.set(r[0], (r[1] || 0) * mirror, (r[2] || 0) * mirror); };

  const state = { wind: V(0, 0, 0), t: 0, sit: false, gust: 1 };

  function setPose(p) {
    if (p.root) { root.position.set(p.root[0], p.root[1], p.root[2]); root.rotation.y = p.root[3] || 0; }
    J.hips.position.y = hipH + (p.hipsY || 0);
    J.hips.position.z = p.hipsZ || 0;
    setRot(J.hips, p.hips || [0, 0, 0]);
    setRot(J.spine, p.spine || [0, 0, 0]);
    setRot(J.chest, p.chest || [0, 0, 0]);
    setRot(J.neck, p.neck || [0, 0, 0]);
    setRot(J.head, p.head || [0, 0, 0]);
    for (const a of J.arms) {
      const side = a.s > 0 ? 'l' : 'r';
      const key = a.pair === 0 ? side : side + a.pair;
      const sh = p[key + 'Sh'] || (a.pair > 0 ? [0, 0, 0.3 + a.pair * 0.5] : [0, 0, 0.08]);
      const el = p[key + 'El'] || [-0.15, 0, 0];
      const wr = p[key + 'Wr'] || [0, 0, 0];
      setRot(a.sh, sh, a.s);
      setRot(a.el, el, a.s);
      setRot(a.wr, wr, a.s);
    }
    state.sit = !!p.sit;
    for (const l of J.legs) {
      const side = l.s > 0 ? 'l' : 'r';
      setRot(l.hip, p[side + 'Hip'] || [0, 0, 0], l.s);
      setRot(l.knee, p[side + 'Knee'] || [0, 0, 0], l.s);
      setRot(l.ankle, p[side + 'Ank'] || [0, 0, 0], l.s);
    }
    if (J.skirt) {
      J.skirt.visible = J.skirtBorder.visible = !p.sit;
      for (const l of J.legs) { l.thigh.visible = !!p.sit; l.shin.visible = !!p.sit; l.knee.children.forEach((c) => { if (c !== l.ankle) c.visible = !!p.sit; }); }
      // skirt sways a little with the hips
      J.skirt.rotation.set(-(p.hips?.[0] || 0) * 0.3 + (p.skirtSway || 0), 0, (p.skirtSwayZ || 0));
      J.skirtBorder.rotation.copy(J.skirt.rotation);
    }
    const f = p.face || {};
    const blink = clamp(f.blink ?? 0, 0, 1);
    for (const e of J.eyes) {
      const sq = (f.squint ?? 0) * 0.35;
      e.lid.scale.set(1, Math.max(0.06, 1 - blink * 0.95 - sq), 1);
      e.lash.position.y = (1 - Math.max(0.06, 1 - blink * 0.95 - sq)) * 0.034 * -1 + 0.0;
      e.lash.scale.y = 1 - blink * 0.6;
      e.iris.position.x = clamp(f.lookX ?? 0, -1, 1) * 0.009 * (1);
      e.iris.position.y = clamp(f.lookY ?? 0, -1, 1) * 0.008;
      const bu = f.browUp ?? 0, bt = (f.browTilt ?? 0) * e.s;
      e.brow.children[0].position.y = -0.03 + bu * 0.018;
      e.brow.children[0].rotation.z = Math.PI / 2 + e.s * 0.08 - Math.PI / 2 + bt * 0.35;
    }
    const smile = f.smile ?? 0.3;
    J.smile.scale.set(1 + smile * 0.15, smile >= 0 ? 0.25 + smile * 0.9 : smile * 0.9, 1);
    const open = clamp(f.open ?? 0, 0, 1);
    J.mouthOpen.visible = open > 0.02;
    J.mouthOpen.scale.set(0.7 + open * 0.4, open, 1);
    if (J.third) {
      const g = clamp(f.third ?? 0, 0, 1);
      J.thirdIris.material.uniforms.uEmissive.value.setRGB(1.0 * g, 0.35 * g, 0.08 * g);
      J.thirdGlow.material.opacity = g;
      J.thirdGlow.visible = g > 0.01;
    }
    if (p.wind) state.wind.set(...p.wind);
    state.gust = p.gust ?? 1;
  }

  // Secondary motion: hair + pallu drape follow wind and gravity. Call every frame after setPose.
  const wLocal = V(), gLocal = V(), tmp = V();
  const invQ = new THREE.Quaternion();
  function toLocal(parent, worldVec, out) {
    parent.getWorldQuaternion(invQ).invert();
    return out.copy(worldVec).applyQuaternion(invQ);
  }
  function animate(t) {
    state.t = t;
    root.updateMatrixWorld(true);
    const wind = state.wind;
    const windMag = wind.length();
    if (J.hairMain) {
      toLocal(J.head, wind, wLocal);
      toLocal(J.head, V(0, -1, 0), gLocal);
      const hair = (rib, start, len, phase, spread) => {
        const pts = [];
        const n = rib.n;
        for (let i = 0; i < n; i++) {
          const u = i / (n - 1);
          const flow = V().copy(gLocal).multiplyScalar(1 - Math.min(windMag, 1.5) * 0.4).addScaledVector(wLocal, 0.9 * u / Math.max(1, windMag * 0.6));
          if (flow.lengthSq() < 1e-6) flow.set(0, -1, 0);
          flow.normalize();
          const p = V().copy(start);
          // start going backwards, then follow the flow
          p.addScaledVector(V(spread, -0.25, -1).normalize(), Math.min(u, 0.15) * len);
          p.addScaledVector(flow, Math.max(0, u - 0.15) * len);
          const wave = Math.sin(t * (2.2 + Math.min(windMag, 2) * 2.5) - u * 7 + phase) * (0.015 + 0.06 * Math.min(windMag, 1.5)) * u * state.gust;
          const wave2 = Math.cos(t * 1.7 - u * 4 + phase * 2) * 0.03 * u * Math.min(windMag, 1.5);
          p.x += wave; p.y += wave2; p.z += wave * 0.4;
          pts.push(p);
        }
        rib.update(pts, V(1, 0, 0));
      };
      const base = V(0, 0.2, -0.12);
      hair(J.hairMain, base, 0.95, 0, 0);
      hair(J.hairL, V(0.1, 0.17, -0.1), 0.75, 1.3, 0.5);
      hair(J.hairR, V(-0.1, 0.17, -0.1), 0.75, 2.1, -0.5);
    }
    if (J.lap) {
      J.lap.mesh.visible = state.sit;
      if (state.sit) {
        const inv = new THREE.Matrix4().copy(J.hips.matrixWorld).invert();
        const k = [V(), V()], a = [V(), V()];
        J.legs.forEach((l, i) => { l.knee.getWorldPosition(k[i]).applyMatrix4(inv); l.ankle.getWorldPosition(a[i]).applyMatrix4(inv); });
        const knee = V().addVectors(k[0], k[1]).multiplyScalar(0.5);
        const ank = V().addVectors(a[0], a[1]).multiplyScalar(0.5);
        const hip = V(0, 0.02, -0.04);
        const curve = new THREE.CatmullRomCurve3([hip, V().lerpVectors(hip, knee, 0.5).add(V(0, 0.06, 0)), knee.clone().add(V(0, 0.07, 0.07)), V().lerpVectors(knee, ank, 0.5).add(V(0, 0, 0.09)), ank.clone().add(V(0, -0.04, 0.1))]);
        const pts = [];
        for (let i = 0; i < J.lap.n; i++) pts.push(curve.getPoint(i / (J.lap.n - 1)));
        J.lap.update(pts, V(1, 0, 0));
      }
    }
    if (J.drape) {
      toLocal(J.chest, wind, wLocal);
      toLocal(J.chest, V(0, -1, 0), gLocal);
      const pts = [];
      const n = J.drape.n;
      const start = V(0.12, 0.25, 0.04);
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        const p = V().copy(start);
        // over the shoulder to the back
        const over = Math.min(u / 0.2, 1);
        p.add(V(0.03 * over, 0.03 * Math.sin(over * Math.PI), -0.17 * over));
        const flow = V().copy(gLocal).multiplyScalar(1 - Math.min(windMag, 1.5) * 0.4).addScaledVector(wLocal, 0.8 * u);
        flow.normalize();
        p.addScaledVector(flow, Math.max(0, u - 0.2) * 0.9);
        const wave = Math.sin(t * (2.0 + windMag * 3) - u * 5) * (0.01 + 0.06 * Math.min(windMag, 1.5)) * u * state.gust;
        p.x += wave; p.z += Math.cos(t * 1.7 - u * 4) * 0.01 * u;
        pts.push(p);
      }
      J.drape.update(pts, V(1, 0.2, 0).normalize());
    }
  }

  // global material helpers
  function setDesat(v) { for (const m of Object.values(M)) if (m.uniforms?.uDesat) m.uniforms.uDesat.value = v; }
  function setRim(v) { for (const m of Object.values(M)) if (m.uniforms?.uRim) m.uniforms.uRim.value = v; }
  function setEmissive(c) { for (const m of Object.values(M)) if (m.uniforms?.uEmissive && m !== M.highlight) m.uniforms.uEmissive.value.copy(c); }

  const api = { root, J, M, parts, setPose, animate, setDesat, setRim, setEmissive, state };
  setPose(POSES.stand);
  return api;
}

// ---------------- poses ----------------
export const POSES = {
  stand: { face: { smile: 0.3 } },
  sitLedge: {
    sit: true, hipsY: -0.42, hipsZ: 0.0,
    lHip: [-1.45, 0, 0.12], rHip: [-1.45, 0, 0.12], lKnee: [1.35, 0, 0], rKnee: [1.5, 0, 0],
    lSh: [-0.25, 0, 0.18], rSh: [-0.3, 0, 0.22], lEl: [-0.7, 0, 0], rEl: [-0.6, 0, 0],
    spine: [0.08, 0, 0], head: [0.05, 0, 0],
  },
  sitChair: {
    sit: true, hipsY: -0.4,
    lHip: [-1.5, 0, 0.06], rHip: [-1.5, 0, 0.06], lKnee: [1.5, 0, 0], rKnee: [1.5, 0, 0],
    lSh: [-0.35, 0, 0.12], rSh: [-0.35, 0, 0.12], lEl: [-1.1, 0, 0], rEl: [-1.1, 0, 0],
    spine: [0.18, 0, 0], chest: [0.12, 0, 0], head: [-0.05, 0, 0],
  },
  rideSide: {
    sit: true, hipsY: -0.38,
    lHip: [-1.35, 0.25, 0.35], rHip: [-1.25, 0.15, 0.2], lKnee: [1.25, 0, 0], rKnee: [1.45, 0, 0],
    lSh: [-0.2, 0, 0.35], rSh: [-2.6, 0, 0.35], lEl: [-0.5, 0, 0], rEl: [-0.2, 0, 0],
    spine: [-0.05, 0, 0], head: [-0.1, 0, 0],
  },
  armsOpen: { lSh: [-0.6, 0, 0.95], rSh: [-0.6, 0, 0.95], lEl: [-0.3, 0, 0], rEl: [-0.3, 0, 0] },
  embrace: { lSh: [-1.35, -0.45, 0.25], rSh: [-1.35, -0.45, 0.25], lEl: [-1.0, 0.5, 0], rEl: [-1.0, 0.5, 0], spine: [0.08, 0, 0] },
};

// Blend two poses (deep, numeric).
export function mixPose(a, b, t) {
  const out = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const va = a[k], vb = b[k];
    if (va === undefined) { out[k] = t > 0.5 ? vb : undefined; if (Array.isArray(vb)) out[k] = vb.map((x) => x * t); else if (typeof vb === 'number') out[k] = vb * t; else if (typeof vb === 'object') out[k] = mixPose({}, vb, t); continue; }
    if (vb === undefined) { if (Array.isArray(va)) out[k] = va.map((x) => x * (1 - t)); else if (typeof va === 'number') out[k] = va * (1 - t); else if (typeof va === 'object') out[k] = mixPose(va, {}, t); else out[k] = t > 0.5 ? undefined : va; continue; }
    if (Array.isArray(va)) out[k] = va.map((x, i) => x + ((vb[i] ?? 0) - x) * t);
    else if (typeof va === 'number') out[k] = va + (vb - va) * t;
    else if (typeof va === 'boolean') out[k] = t > 0.5 ? vb : va;
    else if (typeof va === 'object') out[k] = mixPose(va, vb, t);
    else out[k] = t > 0.5 ? vb : va;
  }
  return out;
}

// Keyframed pose track: kf = [[t, pose, easeFn?], ...]
export function poseAt(t, kf, easeFn = (x) => x * x * (3 - 2 * x)) {
  if (t <= kf[0][0]) return kf[0][1];
  for (let i = 1; i < kf.length; i++) {
    if (t <= kf[i][0]) {
      const u = (t - kf[i - 1][0]) / (kf[i][0] - kf[i - 1][0] || 1);
      return mixPose(kf[i - 1][1], kf[i][1], (kf[i][2] || easeFn)(u));
    }
  }
  return kf[kf.length - 1][1];
}

// Merge pose objects (later wins) including nested face.
export function pose(...ps) {
  const out = {};
  for (const p of ps) for (const [k, v] of Object.entries(p || {})) out[k] = k === 'face' ? { ...(out.face || {}), ...v } : v;
  return out;
}

// Deterministic blink track.
export function blinkAt(t, seed = 0) {
  const period = 3.1 + (seed % 3) * 0.7;
  const ph = ((t + seed * 1.37) % period + period) % period;
  return ph < 0.14 ? Math.sin((ph / 0.14) * Math.PI) : 0;
}
