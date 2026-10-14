// Uma riding Singho side-saddle: parents Uma to the lion's body and poses both.
import * as THREE from 'three';
import { pose, POSES, blinkAt } from './human.js';

export const RIDE_POSE = {
  sit: true, hipsY: -0.4,
  lHip: [-1.45, 0.1, 0.18], rHip: [-1.35, -0.05, 0.12], lKnee: [1.55, 0, 0], rKnee: [1.35, 0, 0],
  spine: [-0.05, -0.45, 0], chest: [0.0, -0.35, 0], neck: [0, -0.25, 0], head: [-0.05, -0.3, 0],
  rSh: [-2.0, -0.3, 0.25], rEl: [-0.25, 0, 0], lSh: [-0.5, 0, 0.35], lEl: [-0.9, 0, 0],
};

export function mountRider(uma, lion) {
  lion.J.body.add(uma.root);
  uma.root.position.set(0.05, 0.08, -0.05);
  uma.root.rotation.set(0, Math.PI / 2, 0);
  uma.root.scale.setScalar(0.92);
}

// Pose both for flight. wind is the world-space relative wind (opposite of travel).
export function rideFrame(uma, lion, T, { wind = [0, 0, 6], extra = {}, face = {}, gallopPose = {} } = {}) {
  uma.setPose(pose(RIDE_POSE, { root: undefined, face: { blink: blinkAt(T, 3), smile: 0.85, third: 0.8, ...face }, wind, gust: 1.4 }, extra));
  uma.root.position.set(0.05, 0.08, -0.05);
  uma.root.rotation.set(0, Math.PI / 2, 0);
}
