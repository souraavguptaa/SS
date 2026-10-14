// The ten-armed goddess for the finale: built on the human rig, golden-skinned, haloed, holding emblems.
import * as THREE from 'three';
import { cel, ink } from '../core/cel.js';
import { lathe, ellipsoid, extrudeShape } from './geo.js';
import { makeHuman, POSES, pose } from './human.js';
import { glowSprite } from '../core/fx.js';

function emblem(kind, gold) {
  const g = new THREE.Group();
  const add = (geo, mat = gold, w = 1.6) => { const m = new THREE.Mesh(geo, mat); if (w) ink(m, w); g.add(m); return m; };
  if (kind === 'trishul') {
    add(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 8)).position.y = 0.2;
    const prong = (x, h) => { const p = add(new THREE.ConeGeometry(0.03, h, 8)); p.position.set(x, 0.7 + h / 2, 0); return p; };
    prong(0, 0.22); prong(-0.08, 0.16); prong(0.08, 0.16);
    const bar = add(new THREE.TorusGeometry(0.08, 0.012, 6, 16, Math.PI)); bar.position.y = 0.66; bar.rotation.z = Math.PI;
  } else if (kind === 'chakra') {
    const r = add(new THREE.TorusGeometry(0.15, 0.025, 8, 32));
    for (let i = 0; i < 8; i++) { const sp = add(new THREE.CylinderGeometry(0.008, 0.008, 0.28, 5), gold, 0); sp.rotation.z = (i / 8) * Math.PI; }
    add(new THREE.SphereGeometry(0.035, 10, 8));
    g.userData.spin = r;
  } else if (kind === 'conch') {
    const c = add(lathe([[0.001, -0.14], [0.05, -0.1], [0.07, -0.02], [0.06, 0.06], [0.03, 0.12], [0.001, 0.16]], 14, (r, y, a) => r * (1 + 0.15 * Math.sin(a * 3 + y * 30))), cel(0xfff6e8, { shade: 0xc0a8b8, spec: 0.6 }));
    c.rotation.z = 0.6;
  } else if (kind === 'lotus') {
    const pm = cel(0xff7aa8, { shade: 0xa8305a });
    for (let i = 0; i < 8; i++) { const p = add(ellipsoid(0.035, 0.09, 0.015), pm, 1.2); p.rotation.z = (i / 8) * Math.PI * 2; p.position.set(Math.sin((i / 8) * Math.PI * 2) * 0.05, Math.cos((i / 8) * Math.PI * 2) * 0.05, 0); }
    add(new THREE.SphereGeometry(0.03, 10, 8), cel(0xffd23a, { shade: 0xa06a10 }));
  } else if (kind === 'sword') {
    add(new THREE.BoxGeometry(0.035, 0.6, 0.01), cel(0xe8f0ff, { shade: 0x8a9ab8, spec: 1 })).position.y = 0.35;
    add(new THREE.BoxGeometry(0.14, 0.025, 0.03)).position.y = 0.04;
  }
  return g;
}

export function makeGoddess() {
  const gd = makeHuman({ name: 'goddess', crown: true, thirdEye: true, armCount: 10, skin: 0xf2b24a, skinShade: 0xb8642a, saree: 0xd4102a, sareeShade: 0x7a0820, border: 0xffc83a, blouse: 0xc80e28, hair: 0x120c10, iris: 0x1a0c06, ink: 2.4 });
  // elongated, idol-like eyes
  for (const e of gd.J.eyes) { e.eye.scale.set(1.35, 0.8, 1); }
  const gold = cel(0xffc23a, { spec: 0.8, shade: 0xa04a10, emissive: 0x2a1404 });
  const kinds = [['trishul', 'chakra'], ['conch', 'lotus'], ['sword', 'chakra'], ['lotus', 'trishul']];
  const emblems = [];
  for (const a of gd.J.arms) {
    if (a.pair === 0) continue;
    const kind = kinds[(a.pair - 1) % 4][a.s > 0 ? 0 : 1];
    const e = emblem(kind, gold);
    e.position.set(0, -0.07, 0.04);
    e.rotation.x = -0.4;
    a.wr.add(e);
    emblems.push(e);
  }
  // halo (prabhamandal) behind the head
  const halo = new THREE.Group();
  halo.position.set(0, 0.16, -0.22);
  gd.J.head.add(halo);
  const ringM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.15, 0.85, 0.4), toneMapped: false });
  halo.add(new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.018, 8, 80), ringM));
  halo.add(new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.01, 8, 64), ringM));
  const petals = new THREE.Group();
  for (let i = 0; i < 24; i++) {
    const p = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 4), ringM);
    const a = (i / 24) * Math.PI * 2;
    p.position.set(Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0);
    p.rotation.z = a - Math.PI / 2;
    petals.add(p);
  }
  halo.add(petals);
  const haloGlow = glowSprite(0xffb050, 1.3, 0.22);
  halo.add(haloGlow);
  gd.halo = halo; gd.haloPetals = petals; gd.haloGlow = haloGlow; gd.emblems = emblems;
  return gd;
}

// Blessing pose with the eight extra arms fanned like a peacock tail.
export function goddessPose(T, bless = 1) {
  const p = {
    rSh: [-0.35 - 0.2 * bless, 0, 0.45], rEl: [-1.9 * bless - 0.3, 0, 0], rWr: [0.3, 0, 0],
    lSh: [-0.3, 0, 0.35], lEl: [-0.7, 0, 0], lWr: [-0.2, 0, 0],
    face: { smile: 0.75, third: 1, blink: 0 },
    spine: [-0.04, 0, 0], head: [0.06, 0, 0],
  };
  for (let k = 1; k <= 4; k++) {
    const sway = 0.04 * Math.sin(T * 1.2 + k);
    const fan = 0.55 + k * 0.42 + sway;
    p[`l${k}Sh`] = [-0.15 - k * 0.05, 0, fan];
    p[`r${k}Sh`] = [-0.15 - k * 0.05, 0, fan];
    p[`l${k}El`] = [-0.5 - 0.1 * k, 0, 0];
    p[`r${k}El`] = [-0.5 - 0.1 * k, 0, 0];
  }
  return p;
}
