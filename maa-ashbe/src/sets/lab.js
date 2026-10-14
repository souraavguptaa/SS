// Character lab: turnaround of the cast for model checks (not in the film).
import * as THREE from 'three';
import { makeSky } from '../core/sky.js';
import { cel, ink, RIG, INK } from '../core/cel.js';
import { makeHuman, POSES, pose, blinkAt } from '../models/human.js';
import { makeLion, LION } from '../models/lion.js';

export async function buildLab(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, ctx.aspect, 0.1, 200);
  const sky = makeSky({ zenith: 0x3a5aa8, mid: 0x7aa0d8, horizon: 0xf3d6b0, midH: 0.3 });
  scene.add(sky);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 48), cel(0x7fa35a, { shade: 0x4a6a4a }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const uma = makeHuman({ name: "uma", crown: true, thirdEye: true });
  const ma = makeHuman({ name: 'ma', saree: 0xf4efe2, sareeShade: 0xa8a0b8, border: 0xc8102e, blouse: 0xf4efe2, hairStyle: 'bun', hair: 0x9a9aa6, hairShade: 0x5a5a6a, glasses: true, shawl: 0x7a2a3a, skin: 0xc4875a, earrings: false, necklace: false, height: 0.95 });
  const dhaki = makeHuman({ name: 'dhaki', outfit: 'dhoti', hairStyle: 'short', mustache: true, sindoor: false, bindi: null, shankha: false, bangles: null, earrings: false, necklace: false, skin: 0xa86a42, skinShade: 0x6a3a2a, lips: 0x6a2a22 });
  const lion = makeLion();
  scene.add(uma.root, ma.root, dhaki.root, lion.root);
  uma.root.position.set(-0.9, 0, 0);
  ma.root.position.set(0.05, 0, 0.2); ma.root.scale.setScalar(0.94);
  dhaki.root.position.set(0.9, 0, 0);
  lion.root.position.set(2.6, 0, -0.6);
  lion.root.rotation.y = -0.6;
  const hide = (new URLSearchParams(location.search).get('hide') || '').split(',').filter(Boolean);
  for (const h of hide) {
    if (h === 'ink') scene.traverse((o) => { if (o.userData.isInk) o.visible = false; });
    else if (h === 'transparent') scene.traverse((o) => { if (o.material && o.material.transparent && o.name !== 'sky') o.visible = false; });
    else if (h.startsWith('parts')) { const [a, b] = h.slice(5).split('-').map(Number); uma.parts.slice(a, b).forEach((m) => (m.visible = false)); console.warn('hid', uma.parts.slice(a, b).map((m) => m.geometry.type + ':' + (m.name || '')).join(' ')); }
    else if (h === 'list') console.warn('parts', uma.parts.length, uma.parts.map((m, i) => i + ':' + m.geometry.type + ':' + (m.geometry.boundingSphere || (m.geometry.computeBoundingSphere(), m.geometry.boundingSphere)).radius.toFixed(3)).join(' '));
    else if (h === 'norim') window.__norim = true;
    else if (h === 'flatskin') uma.M.skin.uniforms.uFlat.value = 1;
    else if (h === 'nospec') { for (const m of Object.values(uma.M)) if (m.uniforms?.uSpec) m.uniforms.uSpec.value = 0; }
    else if (uma.J[h]) { const x = uma.J[h]; (x.mesh || x).visible = false; }
  }
  const shots = {
    front(lt, T, dur) {
      const a = -0.5 + Math.sin(lt * 0.4) * 0.4;
      camera.position.set(Math.sin(a) * 7.5 + 0.8, 1.4, Math.cos(a) * 7.5);
      camera.lookAt(0.8, 0.95, 0);
      RIG.uLightDir.value.set(0.5, 0.8, 0.6).normalize();
      RIG.uRimStrength.value = 0.35;
      RIG.uRimColor.value.setRGB(1, 0.9, 0.7);
      uma.setPose(pose(POSES.stand, { face: { blink: blinkAt(T, 1), smile: 0.6 }, lSh: [-0.2, 0, 0.25], rSh: [-1.2, 0, 0.2], rEl: [-0.6, 0, 0], wind: [0.4, 0, 0] }));
      ma.setPose(pose(POSES.stand, { face: { blink: blinkAt(T, 2), smile: 0.2 }, spine: [0.15, 0, 0], chest: [0.1, 0, 0] }));
      dhaki.setPose(pose(POSES.stand, { face: { blink: blinkAt(T, 3), smile: 0.8, open: 0.5 }, lSh: [-0.9, 0, 0.3], lEl: [-1.2, 0, 0], rSh: [-0.9, 0, 0.3], rEl: [-1.2, 0, 0] }));
      lion.setPose({ ...LION.stand, face: { blink: blinkAt(T, 4) } });
      uma.animate(T); ma.animate(T); dhaki.animate(T); lion.animate(T);
      return { bloom: 0.3, bloomThreshold: 1.0, dust: 0, grain: 0.02, vignette: 0.2 };
    },
    face(lt, T, dur) {
      camera.position.set(-0.9 + Math.sin(lt * 0.5) * 0.25, 1.52, 0.9);
      camera.lookAt(-0.9, 1.45, 0);
      RIG.uLightDir.value.set(0.5, 0.7, 0.6).normalize();
      RIG.uRimStrength.value = window.__norim ? 0 : 0.35;
      uma.setPose(pose(POSES.stand, { face: { blink: blinkAt(T, 1), smile: 0.6, third: 0.8, lookX: Math.sin(lt) }, wind: [0.4, 0, -0.3] }));
      uma.animate(T);
      return { bloom: 0.3, bloomThreshold: 1.0, dust: 0, grain: 0.02, vignette: 0.2 };
    },
    lion(lt, T) {
      camera.position.set(2.6 + 3.2 * Math.sin(0.9), 1.3, 3.2 * Math.cos(0.9) - 0.6);
      camera.lookAt(2.6, 1.0, -0.6);
      lion.setPose({ ...LION.roar });
      lion.animate(T);
      return { bloom: 0.3, bloomThreshold: 1.0, dust: 0, grain: 0.02, vignette: 0.2 };
    },
  };
  return { scene, camera, sky, shots };
}
