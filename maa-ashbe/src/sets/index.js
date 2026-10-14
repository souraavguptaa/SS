// Registry of sets. Each builder returns { scene, camera, sky?, shots: { name(lt, T, dur, entry) -> look } }.
import * as THREE from 'three';
import { goldText, textPlane } from '../core/text.js';
import { buildCosmos } from './cosmos.js';
import { buildLab } from './lab.js';
import { buildKailash } from './kailash.js';
import { buildHouse } from './house.js';
import { buildFlight } from './flight.js';
import { buildBengal } from './bengal.js';
import { buildTown } from './town.js';

// Placeholder card for sets not built yet (keeps the animatic watchable).
function placeholder(name) {
  return async (ctx) => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x202030);
    const camera = new THREE.PerspectiveCamera(30, ctx.aspect, 0.1, 100);
    camera.position.set(0, 0, 10);
    const label = textPlane(goldText(name, { font: 'Cinzel', weight: '700', size: 120 }), 1.2);
    scene.add(label);
    const shots = new Proxy({}, { get: () => () => ({}) });
    return { scene, camera, shots };
  };
}

export const SETS = {
  cosmos: buildCosmos,
  lab: buildLab,
  kailash: buildKailash,
  house: buildHouse,
  flight: buildFlight,
  bengal: buildBengal,
  town: buildTown,
};
for (const n of []) {
  if (!SETS[n]) SETS[n] = placeholder(n);
}
