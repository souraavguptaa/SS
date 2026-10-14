// Puja evening in the para: dhakis strike, fairy lights cascade down the street, the pandal blazes, the crowd dances.
import * as THREE from 'three';
import { makeSky } from '../core/sky.js';
import { cel, ink, RIG, INK } from '../core/cel.js';
import { paraBuilding, bulbStrings, pandal, dhak } from '../models/props.js';
import { lathe, bakeStatic } from '../models/geo.js';
import { makeHuman, POSES, pose, blinkAt, checkTexture } from '../models/human.js';
import { makeLion, LION, withGallop } from '../models/lion.js';
import { mountRider, rideFrame } from '../models/rider.js';
import { glowSprite, pointMaterial, updatePointPx, particleRain } from '../core/fx.js';
import { keys, ease, sstep, clamp, lerp, noise1, mulberry32, window4 } from '../core/util.js';
import { beatPulse, hitPulse, beatIndex, AUDIO } from '../core/audio.js';
import { makeGoddess, goddessPose } from '../models/goddess.js';
import { cloudBank } from '../models/env.js';
import { goldText, textPlane } from '../core/text.js';
import { starField, morphCloud, sparkleTexture } from '../core/fx.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PAL = [[1.6, 0.25, 0.2], [0.3, 1.5, 0.35], [0.35, 0.5, 1.7], [1.6, 1.3, 0.25], [1.5, 0.3, 1.3], [1.6, 0.8, 0.25]];

function makeDhaki(seed, kurta = 0xf08a1c) {
  const d = makeHuman({ name: 'dhaki', outfit: 'dhoti', kurta, hairStyle: 'short', mustache: true, sindoor: false, bindi: null, shankha: false, bangles: null, earrings: false, necklace: false, skin: 0xa86a42, skinShade: 0x6a3a2a, lips: 0x6a2a22 });
  const drum = dhak();
  drum.group.position.set(0.26, 0.04, 0.2);
  drum.group.rotation.y = -0.7;
  drum.group.scale.setScalar(0.95);
  d.J.hips.add(drum.group);
  const gam = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.035, 8, 24), cel(0xffffff, { map: (() => { const t = checkTexture(); t.repeat.set(4, 1); return t; })(), shade: 0x8a7a8a }));
  gam.rotation.x = Math.PI / 2 + 0.3;
  gam.position.set(0, 0.25, 0.01);
  ink(gam, 1.4);
  d.J.chest.add(gam);
  const sticks = [];
  for (const a of d.J.arms.filter((x) => x.pair === 0)) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.012, 0.42, 6), cel(0x8a5a2a, { shade: 0x3a2010 }));
    st.position.set(0, -0.09, 0.16);
    st.rotation.x = Math.PI / 2 - 0.3;
    ink(st, 1.0);
    a.wr.add(st);
    sticks.push(st);
  }
  return { ...d, drum };
}

function drumPose(T, phase = 0) {
  const k = beatPulse(T + 0.05 + phase, 0.14);
  const k2 = beatPulse(T + 0.05 + phase + 0.31, 0.14);
  return {
    rSh: [-0.45 - 0.75 * (1 - k), 0, 0.32], rEl: [-1.55 + 0.75 * k, 0, 0], rWr: [0.4 - 0.6 * k, 0, 0],
    lSh: [-0.45 - 0.7 * (1 - k2), 0, 0.3], lEl: [-1.5 + 0.7 * k2, 0, 0], lWr: [0.4 - 0.6 * k2, 0, 0],
    spine: [0.08 + 0.05 * k, 0, 0], head: [-0.08 + 0.1 * k, 0.1 * Math.sin(T * 2 + phase * 5), 0],
    hipsY: -0.03 * k, lKnee: [0.15 * k, 0, 0], rKnee: [0.15 * k, 0, 0],
  };
}

// Instanced crowd of simple dancing townsfolk.
function makeCrowd(count, spots, seed = 3) {
  const rnd = mulberry32(seed);
  const bodyGeo = lathe([[0.2, 0], [0.19, 0.4], [0.15, 0.75], [0.17, 0.95], [0.13, 1.1], [0.06, 1.16]], 12);
  const headGeo = new THREE.IcosahedronGeometry(0.12, 2);
  const armGeo = lathe([[0.035, -0.5], [0.04, -0.05], [0.045, 0.0]], 6);
  const mats = { body: cel(0xffffff), head: cel(0xffffff, { term: 0.2 }), hair: cel(0x16110f, { spec: 0.2 }), arm: cel(0xffffff) };
  const body = new THREE.InstancedMesh(bodyGeo, mats.body, count);
  const head = new THREE.InstancedMesh(headGeo, mats.head, count);
  const hair = new THREE.InstancedMesh(headGeo, mats.hair, count);
  const arms = new THREE.InstancedMesh(armGeo, mats.arm, count * 2);
  for (const m of [body, head, hair, arms]) { m.frustumCulled = false; ink(m, 1.6); }
  const cloth = [0xc8102e, 0xf2b62a, 0x2a6ad8, 0xe84a8a, 0x2aa86a, 0xf06a1c, 0x8a3ad0, 0xffffff];
  const skins = [0xd9935e, 0xc4875a, 0xa86a42, 0xe0a06a];
  const people = [];
  for (let i = 0; i < count; i++) {
    const [x, z] = spots(i, rnd);
    const c = new THREE.Color(cloth[Math.floor(rnd() * cloth.length)]);
    const sk = new THREE.Color(skins[Math.floor(rnd() * skins.length)]);
    body.setColorAt(i, c); head.setColorAt(i, sk); hair.setColorAt(i, new THREE.Color(1, 1, 1));
    arms.setColorAt(i * 2, sk); arms.setColorAt(i * 2 + 1, sk);
    people.push({ x, z, s: 0.85 + rnd() * 0.3, ph: rnd() * 6.28, yaw: (rnd() - 0.5) * 1.2, dance: rnd() });
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  function update(T, { lookUp = 0, faceYaw = 0, armsUp = 0.5 } = {}) {
    for (let i = 0; i < count; i++) {
      const P = people[i];
      const bob = Math.abs(Math.sin(T * Math.PI * (AUDIO.tempo / 60) + P.ph)) * 0.06 * (0.4 + P.dance);
      const sway = Math.sin(T * 2.2 + P.ph) * 0.12 * P.dance;
      const yaw = P.yaw + faceYaw;
      e.set(0, yaw, sway * 0.4); q.setFromEuler(e);
      m.compose(p.set(P.x, bob, P.z), q, sc.set(P.s, P.s, P.s)); body.setMatrixAt(i, m);
      e.set(-lookUp * 0.6, yaw, sway * 0.3); q.setFromEuler(e);
      const hy = 1.26 * P.s + bob;
      m.compose(p.set(P.x, hy, P.z), q, sc.set(P.s, P.s * 1.05, P.s)); head.setMatrixAt(i, m);
      m.compose(p.set(P.x - Math.sin(yaw) * 0.02 * P.s, hy + 0.035 * P.s, P.z - Math.cos(yaw) * 0.02 * P.s), q, sc.set(P.s * 1.05, P.s * 1.0, P.s * 1.05)); hair.setMatrixAt(i, m);
      for (const s of [-1, 1]) {
        const beat = 0.5 + 0.5 * Math.sin(T * Math.PI * (AUDIO.tempo / 60) + P.ph + (s > 0 ? 0 : 1.2));
        const up = clamp(armsUp * (0.55 + 0.6 * P.dance) * (0.7 + 0.3 * beat), 0, 1);
        e.set(-0.25 * up, yaw, s * (0.18 + up * 2.55)); q.setFromEuler(e);
        const ox = Math.cos(yaw) * s * 0.17 * P.s, oz = -Math.sin(yaw) * s * 0.17 * P.s;
        m.compose(p.set(P.x + ox, (1.02 * P.s) + bob, P.z + oz), q, sc.set(P.s, P.s, P.s));
        arms.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), m);
      }
    }
    for (const mm of [body, head, hair, arms]) mm.instanceMatrix.needsUpdate = true;
  }
  const group = new THREE.Group();
  group.add(body, head, hair, arms);
  return { group, update, people };
}

export async function buildTown(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, ctx.aspect, 0.1, 3000);
  const sky = makeSky({
    zenith: 0x120a3a, mid: 0x4a2270, horizon: 0xff7a4a, ground: 0x1a0e20, midH: 0.18, horizonSharp: 3.5,
    stars: 0.5, starScale: 360, starDensity: 0.08, starHorizon: 0.3,
    clouds: 0.6, cloudLit: 0xff9a6a, cloudShade: 0x5a2a6a, cloudHigh: 0.14, cloudScale: 1.3, cloudCover: 0.3,
  });
  scene.add(sky);

  // street
  const road = new THREE.Mesh(new THREE.PlaneGeometry(12, 220), cel(0x4a4458, { shade: 0x2a2438 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -60);
  scene.add(road);
  for (const s of [-1, 1]) {
    const walk = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 220), cel(0x8a7a8a, { shade: 0x4a3a5a }));
    walk.position.set(s * 7.5, 0.1, -60);
    ink(walk, 1.2);
    scene.add(walk);
  }
  // buildings
  const rnd = mulberry32(8);
  const fronts = [];
  for (const s of [-1, 1]) {
    let z = 12;
    let k = 0;
    while (z > -110) {
      const w = 7 + rnd() * 3;
      const floors = 2 + Math.floor(rnd() * 2);
      const b = paraBuilding({ seed: 30 + k * 7 + (s > 0 ? 100 : 0), width: w, depth: 7, floors });
      b.group.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
      b.group.position.set(s * (9 + 3.5), 0, z - w / 2);
      // a few lit windows
      b.windows.forEach((wn, i) => { if ((i + k) % 3 === 0) wn.glass.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 0.75, 0.35), toneMapped: false }); });
      bakeStatic(b.group);
      scene.add(b.group);
      fronts.push({ s, z: z - w / 2, w, h: floors * 3.1 });
      z -= w + 0.4;
      k++;
    }
  }
  // fairy-light strings zig-zagging across the street
  const strings = [];
  for (let i = 0; i < 22; i++) {
    const z = 6 - i * 4.2;
    const y = 6.2 + (i % 3) * 0.6;
    strings.push({ a: [-8.6, y, z], b: [8.6, y + 0.4, z - 2.1], sag: 1.2, n: 30 });
  }
  for (let i = 0; i < 10; i++) { const z = 4 - i * 9; strings.push({ a: [-8.7, 9.5, z], b: [-8.7, 1.2, z - 0.1], sag: 0.05, n: 18 }, { a: [8.7, 9.5, z - 4], b: [8.7, 1.2, z - 4.1], sag: 0.05, n: 18 }); }
  const lights = bulbStrings(strings, { size: 0.08 });
  scene.add(lights.group);
  // pandal at the end of the street
  const pdl = pandal({ width: 18, height: 14 });
  pdl.position.set(0, 0, -96);
  bakeStatic(pdl);
  scene.add(pdl);
  // lamp posts
  const lamps = [];
  for (let i = 0; i < 8; i++) {
    const s = i % 2 ? 1 : -1, z = 2 - i * 12;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 6, 8), cel(0x2a2a3a, { flat: true }));
    pole.position.set(s * 6.3, 3, z);
    scene.add(pole);
    const lamp = glowSprite(0xffb060, 2.2, 0.7);
    lamp.position.set(s * 6.0, 6.0, z);
    scene.add(lamp);
    lamps.push(lamp);
  }
  // dhakis
  const dhakis = [makeDhaki(1, 0xf08a1c), makeDhaki(2, 0xf2c41a), makeDhaki(3, 0xe8442a)];
  const DPOS = [[0, 0, 0, 0.15], [-2.2, 0, -1.6, 0.35], [2.3, 0, -1.4, -0.3]];
  dhakis.forEach((d, i) => { d.root.position.set(DPOS[i][0], 0, DPOS[i][2]); d.root.rotation.y = DPOS[i][3]; scene.add(d.root); });
  // crowd
  const crowd = makeCrowd(46, (i, r) => {
    const z = -3 - r() * 26, side = r() < 0.5 ? -1 : 1;
    return [side * (1.2 + r() * 4.8), z];
  });
  scene.add(crowd.group);
  // dhunuchi smoke + embers held up by two dancers
  const smoke = particleRain({ count: 220, box: [0.5, 0.2, 0.5], center: [0, 0, 0], seed: 4, size: [0.12, 0.3], color: [0.35, 0.33, 0.4], fall: -0.6, height: 3.5, wind: [0.15, 0, 0], spin: 0.25 });
  scene.add(smoke);
  const embers = [glowSprite(0xff6a20, 0.9, 1.2), glowSprite(0xff6a20, 0.9, 1.2)];
  embers.forEach((e) => scene.add(e));

  // riders overhead
  const lion = makeLion();
  const uma = makeHuman({ name: 'uma', crown: true, thirdEye: true });
  scene.add(lion.root);
  mountRider(uma, lion);
  const NT = 260, tr = mulberry32(21);
  const tGeo = new THREE.BufferGeometry();
  const tPos = new Float32Array(NT * 3), tCol = new Float32Array(NT * 3), tSz = new Float32Array(NT), tSd = new Float32Array(NT), tOff = [];
  for (let i = 0; i < NT; i++) { tCol.set([1.0, 0.8, 0.35], i * 3); tSz[i] = 0.08 + tr() * 0.12; tSd[i] = tr(); tOff.push([tr() - 0.5, tr() - 0.5, tr() - 0.5]); }
  tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
  tGeo.setAttribute('aColor', new THREE.BufferAttribute(tCol, 3));
  tGeo.setAttribute('aSize', new THREE.BufferAttribute(tSz, 1));
  tGeo.setAttribute('aSeed', new THREE.BufferAttribute(tSd, 1));
  const trail = new THREE.Points(tGeo, pointMaterial({ twinkle: 0.4, maxPx: 34 }));
  trail.frustumCulled = false;
  scene.add(trail);
  const fly = (t) => V(Math.sin(t * 0.6) * 1.5, 8.5 + Math.sin(t) * 0.5 - t * 0.4, 14 - t * 15);

  function rig(T) {
    RIG.uLightDir.value.set(-0.35, 0.7, 0.6).normalize();
    RIG.uLightColor.value.setRGB(0.72, 0.6, 0.78);
    RIG.uShadowTint.value.setRGB(0.28, 0.2, 0.42);
    RIG.uRimColor.value.setRGB(1.0, 0.7, 0.35);
    RIG.uRimStrength.value = 0.5;
    RIG.uFogColor.value.setRGB(0.22, 0.1, 0.2);
    RIG.uFogNear.value = 40; RIG.uFogFar.value = 260;
    RIG.uP1Pos.value.set(0, 6, -2); RIG.uP1Color.value.setRGB(0.6, 0.42, 0.22); RIG.uP1Range.value = 14;
    RIG.uP2Pos.value.set(0, 7, -96 + 6); RIG.uP2Color.value.setRGB(0.55, 0.36, 0.18); RIG.uP2Range.value = 26;
    INK.uInkColor.value.setRGB(0.07, 0.02, 0.07);
    INK.uInkRef.value = 8;
    for (const p of [smoke, trail]) { p.material.uniforms.uTime.value = T; updatePointPx(p.material, camera, ctx.H); }
  }
  // lights: string i turns on at onAt(i); colours chase on the beat
  function setLights(T, onAt, pandalOn) {
    const b = beatIndex(T);
    lights.set(T, (i, si, u, t, k) => {
      const on = sstep(onAt(si), onAt(si) + 0.12, T);
      const c = PAL[(k + si + b) % PAL.length];
      const tw = 0.75 + 0.25 * Math.sin(t * 7 + k * 1.7);
      return [c[0] * on * tw + 0.02, c[1] * on * tw + 0.02, c[2] * on * tw + 0.02];
    });
    const bm = pdl.userData.bulbs;
    const pc = new THREE.Color();
    for (let i = 0; i < bm.count; i++) { const on = sstep(pandalOn + (i % 40) * 0.01, pandalOn + 0.2 + (i % 40) * 0.01, T); pc.setRGB(0.05 + 1.5 * on, 0.04 + 1.05 * on, 0.02 + 0.45 * on); bm.setColorAt(i, pc); }
    bm.instanceColor.needsUpdate = true;
    const po = sstep(pandalOn, pandalOn + 0.6, T);
    pdl.userData.inner.material.color.setRGB(0.15 + 1.25 * po, 0.1 + 0.85 * po, 0.05 + 0.35 * po);
    pdl.userData.innerGlow.material.color.setRGB(1, 0.69, 0.31).multiplyScalar(0.22 * po);
  }
  function poseDhakis(T, active = 1) {
    dhakis.forEach((d, i) => {
      const dp = active ? drumPose(T, i * 0.11) : {};
      d.setPose(pose(POSES.stand, dp, { root: [DPOS[i][0], 0, DPOS[i][2], DPOS[i][3]], face: { blink: blinkAt(T, i + 2), smile: 0.8, open: 0.3 * beatPulse(T, 0.2) } }));
      d.drum.plume.rotation.z = 0.12 * Math.sin(T * 9 + i) * active + 0.15 * beatPulse(T, 0.12) * active;
      d.animate(T);
    });
  }
  function dancers(T) {
    const p0 = crowd.people[0], p1 = crowd.people[1];
    for (const [k, P] of [[0, p0], [1, p1]]) {
      const h = V(P.x + Math.sin(T * 2 + k) * 0.3, 2.0 * P.s + 0.3 * Math.sin(T * 3 + k), P.z);
      embers[k].position.copy(h);
      embers[k].material.opacity = 0.7 + 0.3 * Math.sin(T * 11 + k);
    }
    smoke.position.copy(embers[0].position);
  }
  function riders(T, t) {
    const p = fly(t), p2 = fly(t + 0.05);
    const dir = V().subVectors(p2, p).normalize();
    const lp = withGallop(LION.leap, T * 2.4, 0.45);
    lp.root = [p.x, p.y - 0.95, p.z, Math.atan2(dir.x, dir.z)];
    lp.rootRx = -Math.asin(clamp(dir.y, -1, 1));
    lp.wind = [-dir.x * 4, 0.3, -dir.z * 4];
    lp.face = { blink: blinkAt(T, 7) };
    lion.setPose(lp);
    rideFrame(uma, lion, T, { wind: [-dir.x * 5, 0.5, -dir.z * 5], extra: { lSh: [-1.8, 0, 1.0] } });
    lion.animate(T); uma.animate(T);
    const arr = tGeo.attributes.position.array;
    for (let i = 0; i < NT; i++) { const back = (i / NT) * 1.5, pp = fly(t - back), sp = 0.4 + back * 2.5; arr[i * 3] = pp.x + tOff[i][0] * sp; arr[i * 3 + 1] = pp.y + tOff[i][1] * sp - back; arr[i * 3 + 2] = pp.z + tOff[i][2] * sp; }
    tGeo.attributes.position.needsUpdate = true;
    return p;
  }
  // ---------------- finale: night town, the goddess, the title ----------------
  const night = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), cel(0x0e0a1c, { flat: true }));
  night.rotation.x = -Math.PI / 2; night.position.y = -0.05;
  scene.add(night);
  const cityN = 5200, cr = mulberry32(77);
  const cPos = new Float32Array(cityN * 3), cCol = new Float32Array(cityN * 3), cSz = new Float32Array(cityN), cSd = new Float32Array(cityN);
  for (let i = 0; i < cityN; i++) {
    let x, z;
    do { x = (cr() - 0.5) * 1100; z = 150 - cr() * 900; } while (Math.abs(x) < 16 && z > -110);
    const cl = Math.floor(cr() * 40), ox = Math.sin(cl * 12.9) * 380, oz = -200 + Math.cos(cl * 7.7) * 300;
    if (cr() < 0.6) { x = ox + (cr() - 0.5) * 90; z = oz + (cr() - 0.5) * 90; }
    cPos.set([x, 0.5 + cr() * 10, z], i * 3);
    const warm = cr();
    const c = warm < 0.8 ? [1.0, 0.65 + cr() * 0.25, 0.3] : PAL[Math.floor(cr() * PAL.length)].map((v) => v * 0.7);
    cCol.set(c, i * 3); cSz[i] = 0.4 + cr() * 0.8; cSd[i] = cr();
  }
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.BufferAttribute(cPos, 3));
  cg.setAttribute('aColor', new THREE.BufferAttribute(cCol, 3));
  cg.setAttribute('aSize', new THREE.BufferAttribute(cSz, 1));
  cg.setAttribute('aSeed', new THREE.BufferAttribute(cSd, 1));
  const city = new THREE.Points(cg, pointMaterial({ twinkle: 0.35, maxPx: 14 }));
  city.frustumCulled = false;
  scene.add(city);
  const goddess = makeGoddess();
  const GS = 46, GP = V(0, 26, -300);
  goddess.root.scale.setScalar(GS);
  goddess.root.position.copy(GP);
  scene.add(goddess.root);
  goddess.setPose(pose(POSES.stand, goddessPose(0, 1), { root: undefined }));
  goddess.root.updateMatrixWorld(true);
  // stardust that converges into her form: sample her surface
  const ends = [], starts = [], dl = [], sz = [], co = [], sd = [];
  const gr = mulberry32(5);
  const meshes = [];
  goddess.root.traverse((o) => { if (o.isMesh && !o.userData.isInk && o.geometry.attributes.position) meshes.push(o); });
  const vtmp = V();
  for (let i = 0; i < 6000; i++) {
    const m = meshes[Math.floor(gr() * meshes.length)];
    const pa = m.geometry.attributes.position;
    vtmp.fromBufferAttribute(pa, Math.floor(gr() * pa.count)).applyMatrix4(m.matrixWorld);
    ends.push(vtmp.x, vtmp.y, vtmp.z);
    const a = gr() * Math.PI * 2, r = 120 + gr() * 260;
    starts.push(GP.x + Math.cos(a) * r, 40 + gr() * 160, GP.z + Math.sin(a) * r * 0.5 + 60);
    dl.push(gr() * 0.4); sz.push(0.3 + gr() * 0.6); co.push(0.35, 0.26 + gr() * 0.08, 0.1 + gr() * 0.1); sd.push(gr());
  }
  const dust = morphCloud({ starts, ends, delays: dl, sizes: sz, colors: co, seeds: sd });
  scene.add(dust);
  const gClouds = cloudBank({ clusters: 30, seed: 61, size: [20, 34], puffs: [8, 12], lit: 0xffc896, shade: 0x5a3070, term: 0.1, rim: 0.8,
    place: (i, r) => [(r() - 0.5) * 380, 20 + r() * 14, GP.z + 50 - r() * 110] });
  scene.add(gClouds);
  const pillar = glowSprite(0xffc060, 150, 0);
  pillar.position.set(GP.x, 50, GP.z - 20);
  scene.add(pillar);
  const t1 = goldText('মা আসবে', { font: 'Galada', size: 260, pad: 90, strokeW: 16, glowBlur: 40 });
  const t2 = goldText('সুর থেকে সুস্থতা', { font: 'Baloo Da 2', weight: '800', size: 120, pad: 60, strokeW: 10, glowBlur: 24, fill: ['#ffffff', '#ffe9b0', '#ffc860'] });
  const t3 = goldText('শুভ শারদীয়া', { font: 'Galada', size: 150, pad: 60, strokeW: 10, glowBlur: 28, fill: ['#fff6c8', '#ffd25a', '#ff9a3a'] });
  const titles = [textPlane(t1, 1.05), textPlane(t2, 0.34), textPlane(t3, 0.42)];
  titles.forEach((m) => { m.material.depthTest = false; m.renderOrder = 50; scene.add(m); });
  const bandTex = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 128; const g = c.getContext('2d'); const gr2 = g.createLinearGradient(0, 0, 0, 128); gr2.addColorStop(0, 'rgba(8,4,20,0)'); gr2.addColorStop(0.35, 'rgba(8,4,20,0.85)'); gr2.addColorStop(0.65, 'rgba(8,4,20,0.85)'); gr2.addColorStop(1, 'rgba(8,4,20,0)'); g.fillStyle = gr2; g.fillRect(0, 0, 4, 128); const t = new THREE.CanvasTexture(c); return t; })();
  const band = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.5), new THREE.MeshBasicMaterial({ map: bandTex, transparent: true, depthTest: false, depthWrite: false }));
  band.renderOrder = 49; scene.add(band);
  function hideFinale() { band.visible = false; goddess.root.visible = false; dust.visible = false; gClouds.visible = false; pillar.visible = false; titles.forEach((m) => (m.visible = false)); city.visible = false; night.visible = false; }
  function nightSky(T) {
    RIG.uFogColor.value.setRGB(0.04, 0.03, 0.1);
    RIG.uFogNear.value = 250; RIG.uFogFar.value = 2600;
    sky.set('uZenith', 0x050720); sky.set('uMid', 0x141a4a); sky.set('uHorizon', 0x4a2a5a); sky.set('uStars', 1.0); sky.set('uClouds', 0.0);
    city.visible = true; night.visible = true;
    city.material.uniforms.uTime.value = T; updatePointPx(city.material, camera, ctx.H);
  }
  function duskSky() { sky.set('uZenith', 0x120a3a); sky.set('uMid', 0x4a2270); sky.set('uHorizon', 0xff7a4a); sky.set('uStars', 0.5); sky.set('uClouds', 0.6); }
  function calmPandal() { pdl.userData.inner.material.color.setRGB(0.9, 0.62, 0.28); pdl.userData.innerGlow.material.color.setRGB(1, 0.69, 0.31).multiplyScalar(0.06); }
  function goddessFrame(T, reveal, bless) {
    calmPandal();
    goddess.root.visible = reveal > 0.001;
    goddess.setPose(pose(POSES.stand, goddessPose(T, bless), { root: undefined, face: { blink: blinkAt(T, 9) * 0.6, smile: 0.6 + 0.3 * bless, third: reveal } }));
    goddess.root.scale.setScalar(GS * (0.92 + 0.08 * reveal));
    goddess.animate(T);
    goddess.setEmissive(new THREE.Color(0.07, 0.045, 0.015).multiplyScalar(0.6 + 0.4 * reveal));
    goddess.setRim(0.6);
    goddess.haloPetals.rotation.z = T * 0.15;
    goddess.haloGlow.material.opacity = 0.6 * reveal;
    for (const e of goddess.emblems) if (e.userData.spin) e.rotation.z = T * 2;
    gClouds.visible = true;
  }

  const look = (extra = {}) => ({ bloom: 0.7, bloomRadius: 0.45, bloomThreshold: 0.98, streak: 0.35, streakThreshold: 1.1, vignette: 0.45, sat: 1.15, contrast: 1.07, lift: [0.02, 0.0, 0.03], ...extra });

  const shots = {
    dhak(lt, T, dur) {
      rig(T);
      hideFinale(); duskSky();
      lion.root.visible = false; trail.visible = false;
      const t0 = T - lt; // shot start in global time
      setLights(T, (si) => t0 + 1.0 + si * 0.09, t0 + 99);
      poseDhakis(T, sstep(0.6, 1.0, lt));
      crowd.update(T, { armsUp: 0.2 });
      dancers(T);
      camera.fov = 30; camera.updateProjectionMatrix();
      camera.position.set(1.7 - lt * 0.1, 1.62, 2.3 - lt * 0.12);
      camera.lookAt(0.0, 1.3, 0);
      return look({ exposure: 1 + 0.1 * beatPulse(T, 0.15) });
    },
    lights(lt, T, dur) {
      rig(T);
      hideFinale(); duskSky();
      lion.root.visible = false; trail.visible = false;
      const t0 = T - lt;
      // cascade down the street: each string lights a moment after the previous one, then the pandal blazes
      setLights(T, (si) => (si < 22 ? t0 + 0.15 * si : t0 + 0.15 * ((si - 22) * 2)), t0 + dur * 0.62);
      poseDhakis(T);
      crowd.update(T, { armsUp: 0.5 });
      dancers(T);
      camera.fov = 34; camera.updateProjectionMatrix();
      const u = ease.inOut2(clamp(lt / dur, 0, 1));
      camera.position.set(0.5, lerp(2.2, 3.2, u), lerp(9, -2, u));
      camera.lookAt(0, lerp(3.5, 5.5, u), -80);
      return look({ flash: 0.12 * window4(lt - dur * 0.62, 0, 0.1, 0.15, 0.6), flashColor: [1, 0.85, 0.5] });
    },
    crowd(lt, T, dur) {
      rig(T);
      hideFinale(); duskSky();
      lion.root.visible = true; trail.visible = true;
      setLights(T, () => -1e9, -1e9);
      poseDhakis(T);
      const p = riders(T, lt);
      const up = sstep(0.4, 1.4, lt);
      crowd.update(T, { lookUp: up, armsUp: 0.6 + 0.6 * up });
      dancers(T);
      camera.fov = 36; camera.updateProjectionMatrix();
      camera.position.set(2.2, 1.35, 5.0 - lt * 0.4);
      camera.lookAt(lerp(0.5, p.x, 0.35), lerp(4.5, p.y, 0.35), -40);
      return look();
    },
    rise(lt, T, dur) {
      rig(T); hideFinale(); nightSky(T);
      goddessFrame(T, 0, 0); goddess.root.visible = false;
      lion.root.visible = false; trail.visible = false;
      setLights(T, () => -1e9, -1e9);
      poseDhakis(T);
      crowd.update(T, { armsUp: 0.8 });
      dancers(T);
      const u = ease.inOut3(clamp(lt / dur, 0, 1));
      camera.fov = 36; camera.updateProjectionMatrix();
      camera.position.set(lerp(1.5, 0, u), lerp(2.2, 60, u), lerp(6, 70, u));
      camera.lookAt(0, lerp(4, 30, u), lerp(-60, -300, u));
      pillar.visible = true; pillar.material.color.setRGB(1, 0.75, 0.35).multiplyScalar(0.12 * sstep(dur * 0.5, dur, lt));
      INK.uInkMin.value = 0.4;
      return look({ bloom: 0.8 });
    },
    goddess(lt, T, dur) {
      rig(T); hideFinale(); nightSky(T);
      lion.root.visible = false; trail.visible = false;
      setLights(T, () => -1e9, -1e9);
      poseDhakis(T);
      crowd.update(T, { lookUp: 1, armsUp: 1 });
      dancers(T);
      const form = sstep(0.0, 2.2, lt);
      const reveal = sstep(1.9, 2.5, lt);
      dust.visible = reveal < 1;
      dust.material.uniforms.uProg.value = form;
      dust.material.uniforms.uSwirl.value = 30;
      dust.material.uniforms.uOpacity.value = 1 - reveal;
      dust.material.uniforms.uTime.value = T; updatePointPx(dust.material, camera, ctx.H);
      goddessFrame(T, reveal, sstep(3.0, 4.5, lt));
      pillar.visible = true; pillar.material.color.setRGB(1, 0.75, 0.35).multiplyScalar(0.04 + 0.12 * window4(lt, 1.6, 2.2, 2.4, 3.6));
      const u = ease.inOut2(clamp(lt / dur, 0, 1));
      camera.fov = lerp(40, 34, u); camera.updateProjectionMatrix();
      camera.position.set(lerp(-5, -2.5, u), lerp(2.5, 5, u), lerp(-38, -58, u));
      camera.lookAt(0, lerp(52, 80, u), -300);
      RIG.uRimColor.value.setRGB(1.0, 0.8, 0.45); RIG.uRimStrength.value = 0.45;
      RIG.uLightDir.value.set(0.2, 0.4, 1.0).normalize(); RIG.uLightColor.value.setRGB(1.0, 0.85, 0.65);
      INK.uInkMin.value = 0.5;
      return look({ bloom: 0.6, streak: 0.25, flash: 0.25 * window4(lt, 1.9, 2.2, 2.25, 2.9), flashColor: [1, 0.85, 0.55] });
    },
    title(lt, T, dur) {
      rig(T); hideFinale(); nightSky(T);
      lion.root.visible = false; trail.visible = false;
      setLights(T, () => -1e9, -1e9);
      poseDhakis(T);
      crowd.update(T, { lookUp: 1, armsUp: 1 });
      goddessFrame(T, 1, 1);
      pillar.visible = true; pillar.material.color.setRGB(1, 0.75, 0.35).multiplyScalar(0.03);
      camera.fov = 34; camera.updateProjectionMatrix();
      camera.position.set(-2, 26 + lt * 0.4, -70 - lt * 0.8);
      camera.lookAt(0, 76 + lt * 0.5, -300);
      RIG.uRimColor.value.setRGB(1.0, 0.8, 0.45); RIG.uRimStrength.value = 0.45;
      RIG.uLightDir.value.set(0.2, 0.4, 1.0).normalize(); RIG.uLightColor.value.setRGB(1.0, 0.85, 0.65);
      INK.uInkMin.value = 0.5;
      // titles float in front of the camera
      camera.updateMatrixWorld();
      const fwd = V(0, 0, -1).applyQuaternion(camera.quaternion), upv = V(0, 1, 0).applyQuaternion(camera.quaternion);
      const place = (m, d, y, a) => { m.visible = a > 0.01; m.position.copy(camera.position).addScaledVector(fwd, d).addScaledVector(upv, y); m.quaternion.copy(camera.quaternion); m.material.opacity = a; };
      place(band, 5.2, -0.82, 0.55 * sstep(0.2, 1.0, lt));
      place(titles[0], 5, -0.62, sstep(0.3, 1.3, lt));
      place(titles[1], 5, -1.17, sstep(1.4, 2.2, lt));
      place(titles[2], 5, 1.22, sstep(2.2, 3.0, lt));
      return look({ bloom: 0.6, streak: 0.25, fade: sstep(dur - 1.0, dur, lt) });
    },
  };
  return { scene, camera, sky, shots, uma, lion };
}
