// Kailash at night: crescent moon, aurora, cloud sea. Uma waits on a ledge; the call arrives; Singho roars.
import * as THREE from 'three';
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
import { makeSky } from '../core/sky.js';
import { cel, ink, RIG, INK } from '../core/cel.js';
import { peak, cloudBank } from '../models/env.js';
import { makeHuman, POSES, pose, poseAt, blinkAt, mixPose } from '../models/human.js';
import { makeLion, LION } from '../models/lion.js';
import { lightRibbon, noteStream } from '../models/magic.js';
import { particleRain, updatePointPx, glowSprite, pointMaterial, toScreen } from '../core/fx.js';
import { keys, ease, sstep, clamp, lerp, noise1, mulberry32, window4, spring } from '../core/util.js';
import { beatPulse, hitPulse, energy } from '../core/audio.js';
import { mountRider, rideFrame } from '../models/rider.js';
import { gallop, withGallop } from '../models/lion.js';

function rock(seed, sx, sy, sz, { color = 0x5a4a6a, snow = 0xd2d8f2, snowAbove = 0.45 } = {}) {
  let g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position;
  const rnd = mulberry32(seed);
  const jit = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!jit.has(k)) jit.set(k, 0.8 + rnd() * 0.35);
    const f = jit.get(k);
    p.setXYZ(i, p.getX(i) * f * sx, p.getY(i) * f * sy, p.getZ(i) * f * sz);
  }
  g.computeVertexNormals();
  // per-face colour: snow on up-facing facets
  const n = g.attributes.normal, col = new Float32Array(p.count * 3);
  const cR = new THREE.Color(color), cS = new THREE.Color(snow);
  for (let f = 0; f < p.count; f += 3) {
    const ny = (n.getY(f) + n.getY(f + 1) + n.getY(f + 2)) / 3;
    const c = ny > snowAbove + (rnd() - 0.5) * 0.15 ? cS : cR;
    for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (f + j) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, cel(0xffffff, { vertexColors: true, shade: 0x000000, rim: 0.4 }));
  m.material.uniforms.uShadeMix.value = 0;
  ink(m, 2.0);
  return m;
}

export async function buildKailash(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, ctx.aspect, 0.1, 4000);
  const sky = makeSky({
    zenith: 0x030720, mid: 0x0b1846, horizon: 0x26407a, ground: 0x0a1230, midH: 0.28, horizonSharp: 5,
    stars: 0.9, starScale: 360, starDensity: 0.1, starHorizon: 0.05, starTwinkle: 0.6,
    aurora: 0.9, aurA: 0x2cffa0, aurB: 0xa040ff, aurLow: 0.12, aurHigh: 0.6,
    moonDir: [-0.28, 0.24, -1], moonSize: 0.05, moonGlow: 1.0, moonColor: 0xfff0d0, moonPhase: 0.62,
  });
  scene.add(sky);

  // ---- mountains ----
  const kailash = peak({ seed: 7, height: 200, radius: 92, square: 1.0, shape: 'kailash', snow: 0.66, bands: true, rock: 0x6a5274, rock2: 0x463864, snowCol: 0xd6dcf4, gully: true, roughness: 0.05, segs: 96, rings: 56 });
  kailash.position.set(60, -70, -430);
  kailash.rotation.y = 0.3;
  scene.add(kailash);
  const rnd = mulberry32(31);
  const peaks = [];
  for (let i = 0; i < 16; i++) {
    const a = -1.9 + (i / 15) * 3.8 + (rnd() - 0.5) * 0.2;
    const d = 330 + rnd() * 420;
    const p = peak({ seed: 100 + i, height: 70 + rnd() * 90, radius: 45 + rnd() * 45, shape: 'spire', snow: 0.45 + rnd() * 0.15, roughness: 0.16, rock: 0x5a4a72, rock2: 0x3a3060, snowCol: 0xd0d6f0, segs: 48, rings: 30 });
    p.position.set(Math.sin(a) * d + 40, -75 - rnd() * 10, -Math.cos(a) * d - 120);
    if (Math.abs(p.position.x - kailash.position.x) < 130 && p.position.z < -300) p.position.x += 220 * Math.sign(p.position.x - kailash.position.x || 1);
    scene.add(p);
    peaks.push(p);
  }
  // near ridge behind the ledge
  for (let i = 0; i < 5; i++) {
    const p = peak({ seed: 300 + i, height: 26 + rnd() * 18, radius: 22 + rnd() * 10, shape: 'spire', snow: 0.35, roughness: 0.2, rock: 0x4a3e62, rock2: 0x3a3058, segs: 40, rings: 24 });
    p.position.set(-30 + i * 22 + rnd() * 8, -40, -70 - rnd() * 40);
    scene.add(p);
  }

  // ---- cloud sea below ----
  const clouds = cloudBank({ clusters: 46, seed: 4, area: [-700, 700, -900, 160], y: [-62, -48], size: [22, 48], puffs: [8, 13], lit: 0xb4bee8, shade: 0x3a4486, term: 0.25 });
  scene.add(clouds);
  const clouds2 = cloudBank({ clusters: 14, seed: 9, area: [-120, 60, -60, 60], y: [-24, -14], size: [7, 14], puffs: [7, 11], lit: 0xbcc4ec, shade: 0x404a8a, term: 0.25 });
  scene.add(clouds2);

  // ---- ledge ----
  const ledge = new THREE.Group();
  scene.add(ledge);
  const R1 = rock(3, 2.7, 1.25, 2.3); R1.position.set(0.7, -0.9, 0.0); ledge.add(R1);
  const R2 = rock(5, 2.3, 2.2, 2.4); R2.position.set(2.8, -1.4, -1.6); ledge.add(R2);
  const R3 = rock(8, 3.4, 5.5, 3.2); R3.position.set(1.2, -5.6, -0.6); ledge.add(R3);
  const R4 = rock(11, 1.5, 1.0, 1.5); R4.position.set(-1.5, -1.2, 1.1); ledge.add(R4);
  const R5 = rock(13, 1.2, 1.6, 1.2); R5.position.set(4.2, -0.6, -2.8); ledge.add(R5);

  // ---- characters ----
  const uma = makeHuman({ name: 'uma', crown: true, thirdEye: true });
  uma.root.name = 'uma';
  scene.add(uma.root);
  const lion = makeLion();
  scene.add(lion.root);

  // ---- snow ----
  const snow = particleRain({ count: 1400, box: [40, 26, 40], center: [0, 8, 0], seed: 5, size: [0.03, 0.09], color: [0.5, 0.55, 0.65], fall: 0.9, height: 26, wind: [-0.6, 0, 0.2], spin: 0.5 });
  snow.name = 'snow';
  scene.add(snow);

  // ---- the call: ribbon of melody arriving from the south (-X), spiralling around Uma ----
  const rp = [];
  for (let i = 0; i <= 24; i++) { const u = i / 24; rp.push([lerp(-150, -5, u), lerp(-46, 0.9, Math.pow(u, 0.7)), lerp(-90, -0.5, u) + Math.sin(u * 6) * 12 * (1 - u)]); }
  for (let i = 1; i <= 18; i++) { const a = i * 0.5; const rr = lerp(2.2, 1.0, i / 18); rp.push([Math.cos(a + Math.PI) * rr + 0.2, 0.9 + i * 0.05, Math.sin(a + Math.PI) * rr + 0.1]); }
  const ribbon = lightRibbon(rp, { radius: 0.04, segments: 900, intensity: 0.8 });
  ribbon.name = 'ribbon';
  scene.add(ribbon);
  const notes = noteStream(ribbon.userData.curve, { count: 30, size: 0.42, spread: 1.0, speed: 0.12 });
  notes.group.name = 'notes';
  scene.add(notes.group);
  const ribbonGlow = glowSprite(0xffc060, 1.4, 0);
  ribbonGlow.name = 'ribbonGlow';
  scene.add(ribbonGlow);
  const auraGlow = glowSprite(0xffb040, 2.4, 0);
  auraGlow.name = 'auraGlow';
  scene.add(auraGlow);

  // ---- roar shockwave ----
  const shock = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 64), new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  scene.add(shock);
  const burstN = 260, bRnd = mulberry32(77);
  const bGeo = new THREE.BufferGeometry();
  const bDirs = [];
  const bPos = new Float32Array(burstN * 3), bCol = new Float32Array(burstN * 3), bSz = new Float32Array(burstN), bSd = new Float32Array(burstN);
  for (let i = 0; i < burstN; i++) {
    const a = bRnd() * Math.PI * 2, el = bRnd() * 1.2 - 0.2;
    bDirs.push([Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el), 2 + bRnd() * 6]);
    bCol.set([0.9, 0.95, 1.0], i * 3); bSz[i] = 0.05 + bRnd() * 0.1; bSd[i] = bRnd();
  }
  bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
  bGeo.setAttribute('aColor', new THREE.BufferAttribute(bCol, 3));
  bGeo.setAttribute('aSize', new THREE.BufferAttribute(bSz, 1));
  bGeo.setAttribute('aSeed', new THREE.BufferAttribute(bSd, 1));
  const burst = new THREE.Points(bGeo, pointMaterial({ twinkle: 0.2 }));
  burst.frustumCulled = false;
  scene.add(burst);

  // leap path: off the ledge, a dive over the cloud sea, then away into the distance
  const leapCurve = new THREE.CatmullRomCurve3([V3(2.5, 0.62, -1.55), V3(-4, 3.2, -1.8), V3(-14, 1.0, -1.0), V3(-30, -8, 3), V3(-55, -10, 8), V3(-95, -2, 14), V3(-160, 14, 22)]);
  const trail = lightRibbon(leapCurve.getPoints(80).map((p) => [p.x, p.y + 0.9, p.z]), { radius: 0.12, segments: 400, intensity: 1.0, color: 0xffb03a });
  trail.name = 'trail';
  scene.add(trail);

  // placement: Uma sits at the ledge edge facing south (-X); Singho sleeps behind her.
  const UMA_POS = [0.2, 0.36, 0.1];
  const LION_POS = [2.5, 0.62, -1.55];

  function rig(T) {
    RIG.uLightDir.value.set(-0.55, 0.6, 0.45).normalize();
    RIG.uLightColor.value.setRGB(0.86, 0.9, 1.0);
    RIG.uShadowTint.value.setRGB(0.3, 0.34, 0.72);
    RIG.uRimColor.value.setRGB(0.45, 1.0, 0.85);
    RIG.uRimStrength.value = 0.42;
    RIG.uFogColor.value.setRGB(0.04, 0.07, 0.2);
    RIG.uFogNear.value = 90; RIG.uFogFar.value = 1100;
    INK.uInkColor.value.setRGB(0.03, 0.02, 0.1);
    for (const p of [snow, burst]) { p.material.uniforms.uTime.value = T; updatePointPx(p.material, camera, ctx.H); }
    ribbon.material.uniforms.uTime.value = T;
  }
  const baseLook = { bloom: 0.7, bloomRadius: 0.5, bloomThreshold: 0.98, streak: 0.4, streakThreshold: 1.1, vignette: 0.45, sat: 1.12, contrast: 1.06, lift: [0.01, 0.015, 0.05] };

  function sitUma(T, extra = {}) {
    uma.setPose(pose(POSES.sitLedge, { root: [...UMA_POS, -Math.PI / 2], wind: [0.3, 0.05, 0.6], face: { blink: blinkAt(T, 1), smile: 0.15, lookX: -0.2 } }, extra));
    uma.animate(T);
  }
  function sleepLion(T) {
    const breathe = Math.sin(T * 1.6) * 0.02;
    lion.setPose({ ...LION.sleep, root: [...LION_POS, -Math.PI / 2 + 0.25], bodyY: -0.52 + breathe, wind: [0.2, 0, 0.4] });
    lion.animate(T);
  }
  function unmount() { if (uma.root.parent !== scene) { scene.add(uma.root); uma.root.scale.setScalar(1); } }
  function hideMagic() {
    unmount(); trail.visible = false;
    ribbon.visible = false; notes.group.visible = false; ribbonGlow.visible = false; auraGlow.visible = false; shock.visible = false; burst.visible = false;
  }

  const shots = {
    reveal(lt, T, dur) {
      rig(T); hideMagic();
      camera.fov = 30; camera.updateProjectionMatrix();
      const u = ease.inOut3(clamp(lt / dur, 0, 1));
      const p0 = new THREE.Vector3(-70, 38, 110), p1 = new THREE.Vector3(-9.5, 2.3, 9.0);
      camera.position.lerpVectors(p0, p1, u);
      const tgt = new THREE.Vector3().lerpVectors(new THREE.Vector3(40, 30, -400), new THREE.Vector3(0.5, 1.0, -2.0), ease.inOut2(clamp(lt / dur, 0, 1)));
      camera.lookAt(tgt);
      sitUma(T, { face: { lookX: -0.3, smile: 0.1 } });
      sleepLion(T);
      return { ...baseLook, fade: 0 };
    },
    uma(lt, T, dur) {
      rig(T); hideMagic();
      camera.fov = 24; camera.updateProjectionMatrix();
      const push = ease.inOut2(clamp(lt / dur, 0, 1));
      camera.position.set(lerp(-2.0, -1.7, push), 1.4, lerp(3.1, 2.7, push));
      camera.lookAt(0.25, 1.15, -0.2);
      const sigh = window4(lt, 1.0, 1.8, 3.2, 4.2);
      sitUma(T, { head: [0.12 + sigh * 0.12, -0.25, 0.05], face: { blink: Math.max(blinkAt(T, 1), sigh * 0.55), smile: 0.18 - sigh * 0.2, lookX: -0.4, lookY: -0.2 }, lSh: [-0.35, 0, 0.12], lEl: [-1.0, 0, 0] });
      sleepLion(T);
      return { ...baseLook };
    },
    call(lt, T, dur) {
      rig(T); unmount(); trail.visible = false;
      camera.fov = 28; camera.updateProjectionMatrix();
      const push = ease.inOut2(clamp(lt / dur, 0, 1));
      camera.position.set(lerp(-2.6, -1.9, push), lerp(1.45, 1.6, push), lerp(6.4, 5.2, push));
      camera.lookAt(lerp(-1.6, -0.6, push), 1.25, 0.0);
      // ribbon arrives over ~2.5s, wraps her
      const rev = keys(lt, [[0, 0.35], [2.6, 1.0, ease.out3]]);
      ribbon.visible = true;
      ribbon.material.uniforms.uReveal.value = rev;
      ribbon.material.uniforms.uTail.value = keys(lt, [[2.0, 0], [dur, 0.55, ease.in2]]);
      notes.group.visible = true;
      notes.update(T, { start: 0.35, end: rev, tail: ribbon.material.uniforms.uTail.value });
      const head = ribbon.userData.curve.getPointAt(Math.min(rev, 1));
      ribbonGlow.visible = true; ribbonGlow.position.copy(head);
      ribbonGlow.material.opacity = 0.7;
      const wake = sstep(2.2, 3.0, lt);
      const stand = sstep(3.1, 4.4, lt);
      auraGlow.visible = true; auraGlow.position.set(UMA_POS[0], 1.1 + stand * 0.4, UMA_POS[2]);
      auraGlow.material.opacity = 0.22 * wake + 0.12 * beatPulse(T, 0.3) * wake;
      RIG.uP1Pos.value.set(-1.2, 1.4, 0.8);
      RIG.uP1Color.value.setRGB(0.5 * (0.3 + wake), 0.32 * (0.3 + wake), 0.1 * (0.3 + wake));
      RIG.uP1Range.value = 3.5;
      const seated = pose(POSES.sitLedge, { root: [...UMA_POS, -Math.PI / 2], wind: [0.3, 0.1, 0.8] });
      const standing = pose(POSES.stand, { root: [UMA_POS[0] - 0.2, UMA_POS[1], UMA_POS[2], -Math.PI / 2], lSh: [-0.5, 0, 0.5], rSh: [-0.5, 0, 0.5], lEl: [-0.4, 0, 0], rEl: [-0.4, 0, 0], wind: [0.6, 0.2, 1.0] });
      const p = mixPose(seated, standing, stand);
      p.face = { blink: lt < 2.2 ? 0.85 : blinkAt(T, 2) * (1 - wake), smile: 0.1 + wake * 0.7, browUp: wake * 0.6, third: wake, lookX: -0.1, lookY: 0.2 * wake };
      p.head = [0.15 * (1 - wake) - 0.1 * wake, -0.2 * (1 - stand), 0];
      uma.setPose(p);
      uma.animate(T);
      sleepLion(T);
      shock.visible = false; burst.visible = false;
      return { ...baseLook, bloom: 0.8, streak: 0.12, flash: 0.15 * window4(lt, 2.4, 2.6, 2.7, 3.2), flashColor: [1, 0.85, 0.5] };
    },
    leap(lt, T, dur) {
      rig(T); hideMagic();
      mountRider(uma, lion);
      camera.fov = 32; camera.updateProjectionMatrix();
      // crouch -> spring -> fly away along the curve
      const t0 = 0.9;
      const k = clamp((lt - t0) / (dur - t0), 0, 1);
      const u = k < 0.15 ? ease.out2(k / 0.15) * 0.12 : 0.12 + (k - 0.15) / 0.85 * 0.88;
      const crouch = sstep(0.0, 0.7, lt) * (1 - sstep(t0 - 0.1, t0 + 0.1, lt));
      const p = leapCurve.getPointAt(Math.min(u, 1));
      const tan = leapCurve.getTangentAt(Math.min(u + 0.001, 1));
      let lp = { ...LION.stand };
      if (lt < t0) lp = { ...LION.crouch, bodyY: -0.3 * crouch, body: [0.12 * crouch, 0, 0] };
      else lp = withGallop(LION.leap, T * 2.2, 0.35 * sstep(t0 + 0.3, t0 + 0.8, lt));
      const yaw = Math.atan2(tan.x, tan.z);
      const pitch = -Math.asin(clamp(tan.y, -1, 1)) * 0.8;
      lp.root = [p.x, p.y - (lt < t0 ? 0 : 0.0), p.z, yaw];
      lp.rootRx = lt < t0 ? 0 : pitch;
      lp.face = { blink: blinkAt(T, 5), browUp: 0.3 };
      lp.wind = [-tan.x * 3, 0.3, -tan.z * 3];
      lp.tailLift = 0.7;
      lion.setPose(lp);
      rideFrame(uma, lion, T, { wind: [-tan.x * 4, 0.4, -tan.z * 4], extra: lt < t0 ? { rSh: [-1.6, 0.3, 0.3] } : {} });
      lion.animate(T); uma.animate(T);
      trail.visible = lt > t0;
      trail.material.uniforms.uTime.value = T;
      trail.material.uniforms.uReveal.value = Math.min(u, 1);
      trail.material.uniforms.uTail.value = Math.max(0, u - 0.35);
      // camera: behind on the ledge, panning to follow them out over the cloud sea
      const follow = sstep(t0, dur, lt);
      camera.position.set(lerp(-1.6, 3.8, follow), 1.45 + follow * 1.6, lerp(3.6, 2.2, follow));
      const tgt = new THREE.Vector3(p.x, p.y + 0.8, p.z);
      const look = new THREE.Vector3().lerpVectors(new THREE.Vector3(2.3, 1.3, -1.5), tgt, sstep(t0 - 0.1, t0 + 0.9, lt));
      camera.lookAt(look);
      return { ...baseLook, streak: 0.3 };
    },
    roar(lt, T, dur) {
      rig(T); hideMagic();
      camera.fov = 30; camera.updateProjectionMatrix();
      const r = sstep(1.2, 1.6, lt) * (1 - sstep(dur - 0.6, dur, lt) * 0.5);
      const shake = r * 0.06 * (1 - sstep(1.6, 3.2, lt));
      camera.position.set(-1.2 + noise1(T * 25) * shake, 0.9 + noise1(T * 23 + 4) * shake, 4.6 + noise1(T * 21 + 9) * shake);
      camera.lookAt(1.4, 1.75, -1.2);
      // lion: wake -> sit up -> roar
      const wake = sstep(0.0, 0.8, lt);
      let lp = mixPose(LION.sleep, LION.sitUp, wake);
      lp = mixPose(lp, LION.roar, sstep(0.9, 1.4, lt));
      lp.root = [LION_POS[0], LION_POS[1] - 0.25, LION_POS[2], -Math.PI / 2 + 0.25 - 0.2 * wake];
      lp.face = { blink: lt < 0.6 ? 1 - lt / 0.6 : 0.3 * r, browUp: -0.4 * r };
      lp.roar = r;
      lp.wind = [0.4 + r * 1.2, 0.2, 0.3];
      lion.setPose(lp);
      lion.animate(T);
      // Uma standing beside, arm raised
      uma.setPose(pose(POSES.stand, { root: [UMA_POS[0] - 0.4, UMA_POS[1], UMA_POS[2] + 0.4, -Math.PI / 2 + 0.6], rSh: [-2.6, 0, 0.25], rEl: [-0.2, 0, 0], lSh: [-0.3, 0, 0.3], face: { smile: 0.9, open: 0.25, third: 1, blink: blinkAt(T, 3) }, wind: [0.8 + r, 0.2, 0.6] }));
      uma.animate(T);
      // shockwave + snow burst from the lion's head
      const t0 = 1.25;
      const k = clamp((lt - t0) / 1.4, 0, 1);
      shock.visible = lt > t0;
      const hp = new THREE.Vector3(); lion.J.head.getWorldPosition(hp);
      shock.position.copy(hp);
      shock.lookAt(camera.position);
      shock.scale.setScalar(0.5 + k * 9);
      shock.material.opacity = (1 - k) * 0.6;
      burst.visible = lt > t0;
      const arr = bGeo.attributes.position.array;
      const bt = Math.max(0, lt - t0);
      for (let i = 0; i < burstN; i++) {
        const [dx, dy, dz, sp] = bDirs[i];
        const d = sp * (1 - Math.exp(-bt * 1.6));
        arr[i * 3] = hp.x + dx * d; arr[i * 3 + 1] = hp.y + dy * d - bt * bt * 0.4; arr[i * 3 + 2] = hp.z + dz * d;
      }
      bGeo.attributes.position.needsUpdate = true;
      burst.material.uniforms.uOpacity.value = 1 - sstep(1.0, 2.6, bt);
      return { ...baseLook, bloom: 0.8, streak: 0.55, flash: 0.12 * window4(lt, 1.2, 1.3, 1.35, 1.7), flashColor: [0.8, 0.9, 1] };
    },
  };
  return { scene, camera, sky, shots, uma, lion };
}
