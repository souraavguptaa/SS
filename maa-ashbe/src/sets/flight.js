// Sunrise flight: Uma rides Singho through canyons of cel clouds, speed lines, a golden trail, lens flares.
import * as THREE from 'three';
import { makeSky } from '../core/sky.js';
import { cel, ink, RIG, INK } from '../core/cel.js';
import { cloudBank } from '../models/env.js';
import { makeHuman, blinkAt } from '../models/human.js';
import { makeLion, LION, gallop, withGallop } from '../models/lion.js';
import { mountRider, rideFrame } from '../models/rider.js';
import { updatePointPx, pointMaterial, toScreen, glowSprite } from '../core/fx.js';
import { keys, ease, sstep, clamp, lerp, noise1, mulberry32, window4 } from '../core/util.js';
import { beatPulse } from '../core/audio.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export async function buildFlight(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, ctx.aspect, 0.1, 5000);
  const SUN = V(0.32, 0.08, -1).normalize();
  const sky = makeSky({
    zenith: 0x1c2470, mid: 0x7a4aa0, horizon: 0xffa868, ground: 0x7a5a9a, midH: 0.3, horizonSharp: 3.2, groundFade: 0.35,
    stars: 0.25, starScale: 360, starDensity: 0.08, starHorizon: 0.45,
    sunDir: SUN.toArray(), sunColor: 0xffc070, sunSize: 0.045, sunGlow: 0.9, sunGlowPow: 90, sunHalo: 0.35, sunHaloPow: 6, sunDisc: 1,
    clouds: 0.9, cloudLit: 0xffc49a, cloudShade: 0x9a6aa8, cloudHigh: 0.16, cloudScale: 1.4, cloudCover: 0.28,
  });
  scene.add(sky);

  // cloud canyon along -Z
  const L = 520;
  const walls = cloudBank({
    clusters: 64, seed: 21, size: [12, 24], puffs: [9, 15], lit: 0xffd8bc, shade: 0x8a62a8, term: 0.12, rim: 0.7,
    place: (i, r) => { const side = i % 2 ? 1 : -1; return [side * (40 + r() * 34), -8 + r() * 30, 60 - (i / 64) * L - r() * 10]; },
  });
  scene.add(walls);
  const floor = cloudBank({
    clusters: 44, seed: 33, size: [16, 30], puffs: [8, 12], lit: 0xffd0b4, shade: 0x7a5aa0, term: 0.15, rim: 0.6,
    place: (i, r) => [(r() - 0.5) * 140, -34 - r() * 10, 70 - (i / 44) * (L + 80)],
  });
  scene.add(floor);
  const far = cloudBank({
    clusters: 30, seed: 41, size: [30, 60], puffs: [8, 12], lit: 0xffc8a8, shade: 0x8a6aa8, term: 0.15, rim: 0.5,
    place: (i, r) => [(r() - 0.5) * 900, -30 + r() * 40, -L - 200 - r() * 500],
  });
  scene.add(far);

  // speed lines: thin additive streaks scattered around the path
  const NL = 260;
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xfff2e0, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false });
  const lines = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.03, 9), lineMat, NL);
  const lr = mulberry32(5), lm = new THREE.Matrix4();
  for (let i = 0; i < NL; i++) {
    const a = lr() * Math.PI * 2, r = 3 + lr() * 14;
    lm.makeTranslation(Math.cos(a) * r, Math.sin(a) * r * 0.6 + 1, 40 - lr() * (L + 40));
    lines.setMatrixAt(i, lm);
  }
  lines.instanceMatrix.needsUpdate = true;
  lines.frustumCulled = false;
  scene.add(lines);

  // characters
  const lion = makeLion();
  const uma = makeHuman({ name: 'uma', crown: true, thirdEye: true });
  scene.add(lion.root);
  mountRider(uma, lion);
  const aura = glowSprite(0xffc060, 4, 0.0);
  scene.add(aura);

  // sparkle trail (positions = past path samples)
  const NT = 360, tr = mulberry32(9);
  const tGeo = new THREE.BufferGeometry();
  const tPos = new Float32Array(NT * 3), tCol = new Float32Array(NT * 3), tSz = new Float32Array(NT), tSd = new Float32Array(NT), tOff = [];
  for (let i = 0; i < NT; i++) { tCol.set([1.0, 0.72 + tr() * 0.2, 0.3], i * 3); tSz[i] = 0.06 + tr() * 0.1; tSd[i] = tr(); tOff.push([tr() - 0.5, tr() - 0.5, tr() - 0.5, tr()]); }
  tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
  tGeo.setAttribute('aColor', new THREE.BufferAttribute(tCol, 3));
  tGeo.setAttribute('aSize', new THREE.BufferAttribute(tSz, 1));
  tGeo.setAttribute('aSeed', new THREE.BufferAttribute(tSd, 1));
  const trail = new THREE.Points(tGeo, pointMaterial({ twinkle: 0.4, maxPx: 36 }));
  trail.frustumCulled = false;
  scene.add(trail);

  // flight path (function of time within the shot)
  const SPEED = 26;
  const path = (t) => V(Math.sin(t * 0.55) * 4.5, 1.5 + Math.sin(t * 0.8) * 1.8, 30 - t * SPEED);
  const q = new THREE.Quaternion(), m4 = new THREE.Matrix4();

  function place(t, T) {
    const p = path(t), p2 = path(t + 0.05);
    const dir = V().subVectors(p2, p).normalize();
    const yaw = Math.atan2(dir.x, dir.z);
    const pitch = -Math.asin(clamp(dir.y, -1, 1));
    const bank = -Math.cos(t * 0.55) * 0.25;
    const lp = withGallop(LION.leap, T * 2.4, 0.45);
    lp.root = [p.x, p.y - 0.95, p.z, yaw];
    lp.rootRx = pitch;
    lp.rootRz = bank;
    lp.wind = [-dir.x * 4, 0.3, -dir.z * 4];
    lp.tailLift = 0.5;
    lp.face = { blink: blinkAt(T, 7), browUp: 0.2 };
    lion.setPose(lp);
    rideFrame(uma, lion, T, { wind: [-dir.x * 5, 0.6, -dir.z * 5], face: { smile: 0.9 + 0.1 * beatPulse(T) } });
    lion.animate(T); uma.animate(T);
    aura.position.copy(p).add(V(0, 0.5, 0));
    // trail samples behind
    const arr = tGeo.attributes.position.array;
    for (let i = 0; i < NT; i++) {
      const [ox, oy, oz, w] = tOff[i];
      const back = (i / NT) * 1.6;
      const pp = path(t - back);
      const spread = 0.3 + back * 1.8;
      arr[i * 3] = pp.x + ox * spread; arr[i * 3 + 1] = pp.y + oy * spread - back * 0.5; arr[i * 3 + 2] = pp.z + oz * spread + 1.2;
    }
    tGeo.attributes.position.needsUpdate = true;
    return { p, dir };
  }

  function rig(T) {
    RIG.uLightDir.value.copy(SUN).add(V(0, 0.35, 0)).normalize();
    RIG.uLightColor.value.setRGB(1.0, 0.82, 0.62);
    RIG.uShadowTint.value.setRGB(0.48, 0.34, 0.62);
    RIG.uRimColor.value.setRGB(1.0, 0.72, 0.4);
    RIG.uRimStrength.value = 0.55;
    RIG.uFogColor.value.setRGB(0.85, 0.55, 0.62);
    RIG.uFogNear.value = 120; RIG.uFogFar.value = 1400;
    INK.uInkColor.value.setRGB(0.12, 0.04, 0.12);
    INK.uInkRef.value = 10;
    trail.material.uniforms.uTime.value = T;
    updatePointPx(trail.material, camera, ctx.H);
  }
  const sunWorld = V();
  function flareLook(extra = {}) {
    sunWorld.copy(camera.position).addScaledVector(SUN, 3000);
    const sp = toScreen(sunWorld, camera);
    const on = sp && sp[0] > -0.2 && sp[0] < 1.2 && sp[1] > -0.2 && sp[1] < 1.2 ? 1 : 0;
    return { bloom: 0.7, bloomRadius: 0.55, bloomThreshold: 0.98, streak: 0.5, streakThreshold: 1.1, vignette: 0.4, sat: 1.12, contrast: 1.06, lift: [0.02, 0.0, 0.03], flare: 0.55 * on, flarePos: sp || [0.5, 0.5], flareTint: [1, 0.85, 0.7], ...extra };
  }

  const shots = {
    chase(lt, T, dur) {
      rig(T);
      const { p, dir } = place(lt, T);
      camera.fov = 34; camera.updateProjectionMatrix();
      // three camera set-ups blended on beats: behind (backlit), profile, hero front
      const a = sstep(dur * 0.3, dur * 0.42, lt), b = sstep(dur * 0.64, dur * 0.76, lt);
      const behind = V(p.x - 2.0, p.y + 1.6, p.z + 7.5);
      const side = V(p.x - 8.5, p.y + 0.4, p.z + 1.5);
      const front = V(p.x + 2.2, p.y - 0.6, p.z - 7.5);
      const cam = behind.clone().lerp(side, a).lerp(front, b);
      const shake = 0.04;
      cam.x += noise1(T * 6) * shake; cam.y += noise1(T * 5 + 3) * shake;
      camera.position.copy(cam);
      camera.lookAt(p.x, p.y + 0.6, p.z);
      lineMat.opacity = 0.32 + 0.1 * a;
      sky.uniforms.uTime.value = T;
      return flareLook();
    },
    rise(lt, T, dur) {
      rig(T);
      const { p } = place(lt + 4, T);
      camera.fov = 30; camera.updateProjectionMatrix();
      camera.position.set(p.x + 9 - lt, p.y - 3 + lt * 0.4, p.z - 16);
      camera.lookAt(p.x, p.y + 0.5, p.z);
      lineMat.opacity = 0.12;
      return flareLook({ flash: 0.3 * sstep(dur - 0.5, dur, lt), flashColor: [1, 0.9, 0.7] });
    },
  };
  return { scene, camera, sky, shots, uma, lion };
}
