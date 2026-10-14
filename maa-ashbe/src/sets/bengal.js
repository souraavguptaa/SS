// Morning over Bengal: Uma and Singho sweep down a river; kash bursts into bloom in their wake; villages light up.
import * as THREE from 'three';
import { makeSky } from '../core/sky.js';
import { cel, ink, RIG, INK } from '../core/cel.js';
import { ground, water, palm, banana, kashField, cloudBank, strip, flock, leafyTree } from '../models/env.js';
import { hut } from '../models/props.js';
import { makeHuman, blinkAt } from '../models/human.js';
import { makeLion, LION, withGallop } from '../models/lion.js';
import { mountRider, rideFrame } from '../models/rider.js';
import { updatePointPx, pointMaterial, toScreen } from '../core/fx.js';
import { keys, ease, sstep, clamp, lerp, noise1, mulberry32, window4 } from '../core/util.js';
import { beatPulse } from '../core/audio.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export async function buildBengal(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, ctx.aspect, 0.2, 6000);
  const SUN = V(-0.4, 0.55, 0.6).normalize();
  const sky = makeSky({
    zenith: 0x2a6ad0, mid: 0x6aa8e8, horizon: 0xd8eef8, ground: 0x9ab87a, midH: 0.3, horizonSharp: 4,
    sunDir: SUN.toArray(), sunColor: 0xfff0c0, sunGlow: 0.5, sunGlowPow: 120, sunHalo: 0.12, sunHaloPow: 8, sunDisc: 1, sunSize: 0.04,
    clouds: 0.6, cloudLit: 0xffffff, cloudShade: 0xb8c8e8, cloudHigh: 0.12, cloudScale: 1.6, cloudCover: 0.3,
  });
  scene.add(sky);
  // river course (the flight follows it)
  const riverPts = [[0, 120], [6, 60], [-10, 0], [8, -60], [-6, -130], [10, -200], [-4, -280], [6, -360], [0, -460]];
  const g = ground({ size: 1400, seg: 220, fields: true, hill: 2.0, colA: 0x5aa83a, colB: 0x9ccc4a, colC: 0x3a8a3a, dry: 0xd8c46a, seed: 7,
    flatAt: (x, z) => clamp(Math.abs(x - riverX(z)) / 40, 0.0, 1) });
  function riverX(z) { // approximate river centre x for a given z
    for (let i = 1; i < riverPts.length; i++) {
      const [x0, z0] = riverPts[i - 1], [x1, z1] = riverPts[i];
      if (z <= z0 && z >= z1) { const u = (z0 - z) / (z0 - z1); return x0 + (x1 - x0) * (u * u * (3 - 2 * u)); }
    }
    return 0;
  }
  scene.add(g);
  const rv = new THREE.Mesh(strip(riverPts, 16, 300, 0.25), water({ size: [1, 1] }).material);
  const wm = rv.material;
  wm.uniforms.uDeep.value.set(0x2a6ab0); wm.uniforms.uShallow.value.set(0x5aa8e0); wm.uniforms.uLine.value.set(0xd8f4ff);
  wm.uniforms.uGlint.value.set(0xffffff); wm.uniforms.uGlintDir.value.copy(SUN);
  scene.add(rv);
  // banks: kash fields that bloom as the riders pass (z decreasing over time)
  const S = 22; // riders' speed m/s along -z
  const Z0 = 100;
  const kash = kashField({
    count: 7000, seed: 13, height: [1.0, 1.7], tint: 0xffffff, shade: 0xb8b8e0, inkW: 1.0, sway: 0.09,
    region: (r) => { const z = Z0 + 20 - r() * 420; const side = r() < 0.5 ? -1 : 1; const d = 9 + Math.pow(r(), 1.5) * 34; return [riverX(z) + side * d, z, 0.2]; },
    growAt: (x, z, r) => (Z0 - z) / S + Math.abs(x - riverX(z)) * 0.012 + r() * 0.25,
  });
  scene.add(kash);
  // villages
  const rnd = mulberry32(5);
  const huts = [];
  for (let i = 0; i < 26; i++) {
    const z = Z0 - 30 - i * 15 - rnd() * 8;
    const side = i % 2 ? 1 : -1;
    const h = hut({ seed: i, wall: 0xd8a870, roof: 0xd8b060, roofShade: 0x9a7a4a });
    h.position.set(riverX(z) + side * (48 + rnd() * 30), 0, z);
    h.rotation.y = side > 0 ? -Math.PI / 2 + (rnd() - 0.5) * 0.6 : Math.PI / 2 + (rnd() - 0.5) * 0.6;
    h.userData.at = (Z0 - z) / S + 0.4;
    scene.add(h); huts.push(h);
  }
  for (let i = 0; i < 70; i++) {
    const z = Z0 + 40 - rnd() * 520;
    const side = rnd() < 0.5 ? -1 : 1;
    const p = palm({ seed: i + 10, height: 7 + rnd() * 5, lean: (rnd() - 0.5) * 0.5, leaf: 0x2f8a3a, leafShade: 0x1a4a3a });
    p.position.set(riverX(z) + side * (42 + rnd() * 60), 0, z);
    scene.add(p);
  }
  for (let i = 0; i < 18; i++) {
    const z = Z0 - rnd() * 480, side = rnd() < 0.5 ? -1 : 1;
    const t = leafyTree({ seed: i + 3, height: 4 + rnd() * 2, spread: 3 + rnd() * 1.5, leaf: 0x3a8a3a, shade: 0x1a4a3a });
    t.position.set(riverX(z) + side * (60 + rnd() * 50), 0, z);
    scene.add(t);
  }
  const skyClouds = cloudBank({ clusters: 22, seed: 9, area: [-500, 500, -900, 200], y: [70, 110], size: [20, 40], puffs: [8, 12], lit: 0xffffff, shade: 0xb4c4e8, term: 0.2, rim: 0.3 });
  scene.add(skyClouds);
  const birds = flock(36, { size: 0.9 });
  scene.add(birds.group);

  const lion = makeLion();
  const uma = makeHuman({ name: 'uma', crown: true, thirdEye: true });
  scene.add(lion.root);
  mountRider(uma, lion);

  // sparkle trail
  const NT = 300, tr = mulberry32(19);
  const tGeo = new THREE.BufferGeometry();
  const tPos = new Float32Array(NT * 3), tCol = new Float32Array(NT * 3), tSz = new Float32Array(NT), tSd = new Float32Array(NT), tOff = [];
  for (let i = 0; i < NT; i++) { tCol.set([1.0, 0.8, 0.35], i * 3); tSz[i] = 0.07 + tr() * 0.1; tSd[i] = tr(); tOff.push([tr() - 0.5, tr() - 0.5, tr() - 0.5]); }
  tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
  tGeo.setAttribute('aColor', new THREE.BufferAttribute(tCol, 3));
  tGeo.setAttribute('aSize', new THREE.BufferAttribute(tSz, 1));
  tGeo.setAttribute('aSeed', new THREE.BufferAttribute(tSd, 1));
  const trail = new THREE.Points(tGeo, pointMaterial({ twinkle: 0.4, maxPx: 30 }));
  trail.frustumCulled = false;
  scene.add(trail);

  // path: dive from the clouds, then low over the river
  const path = (t) => {
    const z = Z0 + 30 - t * S;
    const dive = 1 - sstep(0, 2.2, t);
    const y = 4.5 + dive * dive * 70 + Math.sin(t * 1.3) * 0.8;
    return V(riverX(z) + Math.sin(t * 0.7) * 3, y, z);
  };
  function place(t, T) {
    const p = path(t), p2 = path(t + 0.05);
    const dir = V().subVectors(p2, p).normalize();
    const lp = withGallop(LION.leap, T * 2.4, 0.45);
    lp.root = [p.x, p.y - 0.95, p.z, Math.atan2(dir.x, dir.z)];
    lp.rootRx = -Math.asin(clamp(dir.y, -1, 1));
    lp.rootRz = -Math.cos(t * 0.7) * 0.15;
    lp.wind = [-dir.x * 4, 0.3, -dir.z * 4];
    lp.face = { blink: blinkAt(T, 7) };
    lion.setPose(lp);
    rideFrame(uma, lion, T, { wind: [-dir.x * 5, 0.5, -dir.z * 5], extra: { lSh: [-1.6, 0, 1.2], lEl: [-0.3, 0, 0] }, face: { smile: 1 } });
    lion.animate(T); uma.animate(T);
    const arr = tGeo.attributes.position.array;
    for (let i = 0; i < NT; i++) {
      const back = (i / NT) * 1.4, pp = path(t - back), sp = 0.3 + back * 2.2;
      arr[i * 3] = pp.x + tOff[i][0] * sp; arr[i * 3 + 1] = pp.y + tOff[i][1] * sp - back * 0.8; arr[i * 3 + 2] = pp.z + tOff[i][2] * sp;
    }
    tGeo.attributes.position.needsUpdate = true;
    return { p, dir };
  }
  function rig(T, lt) {
    RIG.uLightDir.value.copy(SUN);
    RIG.uLightColor.value.setRGB(1.0, 0.97, 0.9);
    RIG.uShadowTint.value.setRGB(0.5, 0.52, 0.72);
    RIG.uRimColor.value.setRGB(1, 1, 1);
    RIG.uRimStrength.value = 0.25;
    RIG.uFogColor.value.setRGB(0.75, 0.86, 0.95);
    RIG.uFogNear.value = 150; RIG.uFogFar.value = 1300;
    INK.uInkColor.value.setRGB(0.08, 0.08, 0.16);
    INK.uInkRef.value = 12;
    kash.userData.mat.uniforms.uGrowT.value = lt;
    trail.material.uniforms.uTime.value = T;
    updatePointPx(trail.material, camera, ctx.H);
  }
  function lights(lt) {
    for (const h of huts) { const on = sstep(h.userData.at, h.userData.at + 0.3, lt); for (const l of h.userData.lights) l.material.color.setRGB(0.1 + 1.2 * on, 0.06 + 0.75 * on, 0.04 + 0.25 * on); }
  }
  function birdsAt(lt, origin) {
    birds.update(lt, (i, t) => {
      const r = mulberry32(i + 1);
      const ox = (r() - 0.5) * 30, oz = r() * 30, delay = r() * 0.8;
      const k = Math.max(0, t - 1.0 - delay);
      const pos = V(origin.x + ox + k * 3, 1 + k * 4 + Math.sin(k * 3 + i) * 0.4, origin.z - oz - k * 6);
      return { pos, yaw: Math.PI + 0.4, flap: Math.sin(t * 14 + i) * 0.7 * (k > 0 ? 1 : 0.1) };
    });
  }
  const look = (extra = {}) => ({ bloom: 0.45, bloomThreshold: 1.0, streak: 0.2, streakThreshold: 1.2, vignette: 0.3, sat: 1.15, contrast: 1.05, lift: [0.0, 0.0, 0.02], ...extra });

  const shots = {
    bloom(lt, T, dur) {
      rig(T, lt);
      const { p, dir } = place(lt, T);
      lights(lt);
      birdsAt(lt, V(riverX(Z0 - 120) + 25, 0, Z0 - 120));
      camera.fov = 36; camera.updateProjectionMatrix();
      const settle = sstep(1.5, 3.5, lt);
      const cam = V(p.x + lerp(-6, -9, settle), p.y + lerp(6, 1.6, settle), p.z + lerp(14, 9, settle));
      camera.position.copy(cam);
      camera.lookAt(p.x + 2 * settle, p.y + 0.3, p.z - 6 * settle);
      wm.uniforms.uGlintAmt.value = 0.6;
      const sp = toScreen(V().copy(camera.position).addScaledVector(SUN, 3000), camera);
      return look({ flare: sp ? 0.25 : 0, flarePos: sp || [0.5, 0.5] });
    },
    villages(lt, T, dur) {
      const t2 = lt + 8;
      rig(T, t2);
      const { p } = place(t2, T);
      lights(t2);
      birdsAt(t2, V(riverX(Z0 - 200) - 30, 0, Z0 - 200));
      camera.fov = 34; camera.updateProjectionMatrix();
      // fly-by: camera waits on the bank, the riders sweep past and away down the river
      const pm = path(8 + dur * 0.55);
      camera.position.set(pm.x + 9, 2.4, pm.z - 4);
      camera.lookAt(p.x, p.y + 0.4, p.z);
      wm.uniforms.uGlintAmt.value = 0.4;
      return look();
    },
  };
  return { scene, camera, sky, shots, uma, lion };
}
