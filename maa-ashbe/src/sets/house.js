// Ma's riverside house: pre-dawn radio + lamp, the melody rising, and (at Puja evening) the door and the embrace.
import * as THREE from 'three';
import { makeSky } from '../core/sky.js';
import { cel, ink, RIG, INK } from '../core/cel.js';
import { ground, water, palm, banana, leafyTree, kashField, bush } from '../models/env.js';
import { bengalHouse, hut, diya, flicker, radio, boat, tulsiMancha } from '../models/props.js';
import { makeHuman, POSES, pose, poseAt, blinkAt, mixPose } from '../models/human.js';
import { makeLion, LION } from '../models/lion.js';
import { lightRibbon, noteStream } from '../models/magic.js';
import { particleRain, updatePointPx, glowSprite, pointMaterial, sparkleTexture, glowTexture } from '../core/fx.js';
import { keys, ease, sstep, clamp, lerp, noise1, mulberry32, window4 } from '../core/util.js';
import { beatPulse, hitPulse } from '../core/audio.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function portraitTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 320;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, 320); bg.addColorStop(0, '#7a1a2a'); bg.addColorStop(1, '#3a0a18');
  g.fillStyle = bg; g.fillRect(0, 0, 256, 320);
  g.fillStyle = '#1a0f0c'; g.beginPath(); g.ellipse(128, 150, 92, 120, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#d9935e'; g.beginPath(); g.ellipse(128, 160, 66, 78, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c8102e'; g.beginPath(); g.moveTo(40, 320); g.quadraticCurveTo(128, 230, 216, 320); g.fill();
  g.fillStyle = '#ffc23a'; g.fillRect(40, 300, 176, 8);
  g.fillStyle = '#fff'; for (const x of [100, 156]) { g.beginPath(); g.ellipse(x, 150, 15, 18, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#2a1408'; for (const x of [100, 156]) { g.beginPath(); g.ellipse(x, 152, 9, 12, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#fff'; for (const x of [104, 160]) { g.beginPath(); g.arc(x, 146, 3, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = '#1a0b08'; g.lineWidth = 4; for (const x of [100, 156]) { g.beginPath(); g.arc(x, 150, 19, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
  g.strokeStyle = '#8e2a2a'; g.lineWidth = 4; g.beginPath(); g.arc(128, 188, 18, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
  g.fillStyle = '#d4121e'; g.beginPath(); g.arc(128, 112, 7, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffc23a'; g.beginPath(); g.moveTo(70, 88); for (let i = 0; i <= 8; i++) { const a = Math.PI * (1 - i / 8); g.lineTo(128 + Math.cos(a) * 62, 92 - Math.sin(a) * (i % 2 ? 30 : 50)); } g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function buildHouse(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, ctx.aspect, 0.05, 3000);
  const sky = makeSky({
    zenith: 0x060a26, mid: 0x18245a, horizon: 0x5a4a86, ground: 0x0a0c20, midH: 0.22, horizonSharp: 4,
    stars: 0.85, starScale: 360, starDensity: 0.12, starHorizon: 0.12,
    sunDir: [0.9, -0.08, -0.4], sunColor: 0xff9a60, sunGlow: 0.0, sunHalo: 0.25, sunHaloPow: 6,
  });
  scene.add(sky);

  // ---------------- exterior ----------------
  const ext = new THREE.Group();
  scene.add(ext);
  const gr = ground({ size: 500, seg: 120, fields: false, hill: 0.6, colA: 0x3a6a3a, colB: 0x4a7a3a, seed: 5, flatAt: (x, z) => clamp((Math.hypot(x, z - 2) - 10) / 20, 0, 1) });
  ext.add(gr);
  const yard = new THREE.Mesh(new THREE.CircleGeometry(9, 40), cel(0xb88a5a, { shade: 0x6a4a4a }));
  yard.rotation.x = -Math.PI / 2; yard.position.set(0, 0.02, 7);
  ext.add(yard);
  const river = water({ size: [600, 70], deep: 0x0a1a44, shallow: 0x1a3a7a, line: 0x6a8ad8, glint: 0xffc890, glintDir: [0.9, -0.05, -0.4], lineScale: 0.5, flow: [0.3, 0] });
  river.position.set(0, -0.15, 52);
  ext.add(river);
  // ghat steps
  for (let i = 0; i < 6; i++) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(5, 0.25, 0.8), cel(0xc8b8a0, { shade: 0x7a6a7a }));
    st.position.set(-2, 0.1 - i * 0.22, 16.5 + i * 0.8);
    ink(st, 1.4);
    ext.add(st);
  }
  const house = bengalHouse({ wall: 0xe8b46a, wallShade: 0x9a5a4a, shutter: 0x2f7a4a, width: 9, depth: 6, height: 3.4, veranda: true, litWindow: 1 });
  ext.add(house.group);
  const houseBox = house.group.children[0];
  houseBox.name = 'houseBox';
  const tulsi = tulsiMancha(); tulsi.position.set(-1.2, 0, 8.5); ext.add(tulsi);
  const tulsiDiya = diya({ scale: 1.2 }); tulsiDiya.group.position.set(-1.2, 1.1, 8.95); ext.add(tulsiDiya.group);
  const palms = [];
  for (const [x, z, h, s, l] of [[-8, 1, 8.5, 1, 0.22], [7.5, -1, 9.5, 2, -0.18], [10, 6, 7.5, 3, -0.3], [-12, 9, 9, 4, 0.25], [14, 12, 8, 5, -0.15], [-16, 14, 7.5, 6, 0.3]]) {
    const p = palm({ seed: s, height: h, lean: l, leaf: 0x2f6a3a, leafShade: 0x0f2a2a, trunk: 0x6a5048 });
    p.position.set(x, 0, z);
    p.rotation.y = s * 1.3;
    ext.add(p); palms.push(p);
  }
  for (const [x, z, s] of [[-5.5, 4.5, 1], [5.6, 4.2, 2], [-9, 6, 3], [9, 9, 4]]) { const b = banana({ seed: s, scale: 1.2, leaf: 0x3a7a3a, shade: 0x143a2a }); b.position.set(x, 0, z); ext.add(b); }
  const shiuli = leafyTree({ seed: 9, height: 3.6, spread: 2.2, leaf: 0x2a5a36, shade: 0x0f2a2a, trunk: 0x5a3e36, flowers: 260 });
  shiuli.position.set(-6.5, 0, 8.5);
  ext.add(shiuli);
  for (const [x, z, s] of [[4, 9, 1], [-4, 10.5, 2], [7, 12, 3], [-9, 12, 4]]) { const b = bush({ seed: s, size: 1.1, color: 0x2f5a32, shade: 0x0f2a2a }); b.position.set(x, 0, z); ext.add(b); }
  const bt = boat({ color: 0x5a3020 }); bt.position.set(6, -0.1, 24); bt.rotation.y = 1.3; ext.add(bt);
  // far bank: huts + kash
  for (let i = 0; i < 7; i++) {
    const h = hut({ seed: i, lit: i % 2 === 0, wall: 0x9a7a6a, roof: 0x8a7a5a, roofShade: 0x3a3048 });
    h.position.set(-60 + i * 20 + (i % 3) * 4, 0, 96 + (i % 2) * 6);
    h.rotation.y = Math.PI + (i % 3 - 1) * 0.3;
    h.scale.setScalar(1.2);
    ext.add(h);
  }
  const farBank = new THREE.Mesh(new THREE.PlaneGeometry(600, 60), cel(0x1f3a2f, { shade: 0x0f1f2a }));
  farBank.rotation.x = -Math.PI / 2; farBank.position.set(0, 0.0, 115);
  ext.add(farBank);
  const kash = kashField({ count: 900, seed: 4, region: (r) => { const x = (r() - 0.5) * 60, z = 12 + r() * 5; return Math.abs(x + 2) < 4 ? null : [x, z]; }, height: [0.8, 1.3], tint: 0xdcd8f0, shade: 0x5a5a9a, inkW: 1.0 });
  ext.add(kash);
  const petals = particleRain({ count: 120, box: [6, 4, 6], center: [-6.5, 4.5, 8.5], seed: 3, size: [0.03, 0.05], color: [[1, 1, 1], [1, 0.6, 0.2]], fall: 0.35, height: 4.5, wind: [0.2, 0, 0.1], spin: 0.25 });
  ext.add(petals);
  const fireflies = particleRain({ count: 60, box: [24, 3, 14], center: [0, 2.2, 10], seed: 8, size: [0.04, 0.07], color: [1.2, 1.0, 0.4], fall: 0.05, height: 3, spin: 0.8 });
  ext.add(fireflies);

  // ---------------- interior room (aligned to the lit window) ----------------
  const room = new THREE.Group();
  room.position.set(2.0, 0.4, 2.85);
  scene.add(room);
  const wallIn = cel(0x8fc4b2, { shade: 0x3a5a6a, rim: 0 });
  const wallOut = cel(0xe8b46a, { shade: 0x9a5a4a });
  const floorM = cel(0xa8402e, { shade: 0x5a1a2a, spec: 0.25 });
  const dadoM = cel(0x4a8a7a, { shade: 0x1f4a4a });
  const woodM = cel(0x7a4a2a, { shade: 0x3a1a1a });
  const RX = 2.4, RZ = 4.2, RH = 3.0;
  const rbox = (w, h, d, m, x, y, z, iw = 1.6) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); if (iw) ink(b, iw); room.add(b); return b; };
  rbox(RX * 2, 0.1, RZ, floorM, 0, -0.05, -RZ / 2, 0);
  rbox(RX * 2, 0.1, RZ, cel(0xe8e2d4, { shade: 0x8a8aa0 }), 0, RH + 0.05, -RZ / 2, 0);
  for (let i = 0; i < 4; i++) rbox(0.18, 0.2, RZ, woodM, -RX + 0.6 + i * 1.2, RH - 0.1, -RZ / 2, 1.2);
  rbox(0.1, RH, RZ, wallIn, -RX - 0.05, RH / 2, -RZ / 2, 0);
  rbox(0.1, RH, RZ, wallIn, RX + 0.05, RH / 2, -RZ / 2, 0);
  rbox(RX * 2, RH, 0.1, wallIn, 0, RH / 2, -RZ - 0.05, 0);
  for (const [x, z, w, d] of [[-RX + 0.02, -RZ / 2, 0.02, RZ], [RX - 0.02, -RZ / 2, 0.02, RZ], [0, -RZ + 0.02, RX * 2, 0.02]]) rbox(w, 0.9, d, dadoM, x, 0.45, z, 0);
  // front wall with window (x=1.0) and door (x=-1.3)
  const WX = 1.0, WW = 0.9, WY0 = 0.82, WY1 = 2.12, DX = -1.3, DW = 1.2, DH = 2.3;
  const seg = (x0, x1, y0, y1) => { const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, 0.3), [wallIn, wallIn, wallIn, wallIn, wallOut, wallIn]); b.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0.15); ink(b, 1.4); room.add(b); };
  seg(-RX, DX - DW / 2, 0, RH);
  seg(DX + DW / 2, WX - WW / 2, 0, RH);
  seg(WX + WW / 2, RX, 0, RH);
  seg(DX - DW / 2, DX + DW / 2, DH, RH);
  seg(WX - WW / 2, WX + WW / 2, 0, WY0);
  seg(WX - WW / 2, WX + WW / 2, WY1, RH);
  // window: bars + sill + open shutters (inside)
  for (let i = 1; i < 5; i++) rbox(0.025, WY1 - WY0, 0.025, cel(0x2a2a3a, { flat: true }), WX - WW / 2 + (i * WW) / 5, (WY0 + WY1) / 2, 0.12, 0);
  rbox(WW + 0.3, 0.06, 0.4, cel(0xf4ecd8, { shade: 0x9a90a8 }), WX, WY0, -0.02, 1.2);
  for (const s of [-1, 1]) {
    const sh = rbox(WW / 2, WY1 - WY0, 0.04, cel(0x2f7a4a, { shade: 0x123a2a }), 0, 0, 0, 1.2);
    sh.position.set(WX + s * (WW / 2 + WW / 4) , (WY0 + WY1) / 2, -0.08);
    sh.rotation.y = -s * 0.25;
  }
  // door leaves (hinged inward)
  const doorLeaves = [];
  for (const s of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(DX + s * DW / 2, DH / 2, 0.02);
    room.add(hinge);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(DW / 2, DH, 0.07), cel(0x7a3a1e, { shade: 0x3a1a1a }));
    leaf.position.x = -s * DW / 4;
    ink(leaf, 1.4);
    hinge.add(leaf);
    for (const y of [-0.6, 0.0, 0.6]) { const p = new THREE.Mesh(new THREE.BoxGeometry(DW / 2 - 0.14, 0.5, 0.03), cel(0x8e4a28, { shade: 0x4a2020 })); p.position.set(0, y, -0.05); leaf.add(p); }
    doorLeaves.push({ hinge, s });
  }
  // outside the door: golden light (evening) / dark (pre-dawn)
  const doorLight = new THREE.Mesh(new THREE.PlaneGeometry(DW * 3, DH * 2.2), new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false, side: THREE.DoubleSide }));
  doorLight.position.set(DX, DH * 0.9, 2.2);
  room.add(doorLight);
  const doorGlow = glowSprite(0xffc060, 3.2, 0);
  doorGlow.position.set(DX, 1.4, 1.2);
  room.add(doorGlow);
  const rays = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(0.35 + (i % 3) * 0.15, 6), new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    r.position.set(DX + (i - 3) * 0.22, 1.2, -2.0);
    r.rotation.set(Math.PI / 2 - 0.35, 0, (i - 3) * 0.07);
    rays.add(r);
  }
  room.add(rays);
  // furniture
  const table = new THREE.Group(); table.position.set(1.95, 0, -1.35); room.add(table);
  { const top = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.7), woodM); top.position.y = 0.78; ink(top, 1.4); table.add(top);
    for (const [x, z] of [[-0.34, -0.29], [0.34, -0.29], [-0.34, 0.29], [0.34, 0.29]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.78, 0.06), woodM); l.position.set(x, 0.39, z); ink(l, 1.2); table.add(l); } }
  const rad = radio();
  rad.group.position.set(1.95, 0.81, -1.35);
  rad.group.rotation.y = -Math.PI / 2 - 0.6;
  room.add(rad.group);
  const chair = new THREE.Group(); chair.position.set(0.95, 0, -1.4); room.add(chair);
  { const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), woodM); seat.position.y = 0.46; ink(seat, 1.4); chair.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.5), woodM); back.position.set(-0.24, 0.78, 0); ink(back, 1.4); chair.add(back);
    for (const [x, z] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.46, 0.05), woodM); l.position.set(x, 0.23, z); chair.add(l); } }
  const bed = new THREE.Group(); bed.position.set(-1.3, 0, -3.2); room.add(bed);
  { const fr = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.45, 1.6), woodM); fr.position.y = 0.3; ink(fr, 1.4); bed.add(fr);
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.12, 1.55), cel(0xe8d8a8, { shade: 0x8a7a8a })); sheet.position.y = 0.58; ink(sheet, 1.2); bed.add(sheet);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.9), cel(0xffffff, { shade: 0xa8a8c8 })); pillow.position.set(-0.6, 0.7, 0); ink(pillow, 1.2); bed.add(pillow); }
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.76, 0.05), cel(0xc89a3a, { shade: 0x6a4a1a, spec: 0.5 }));
  frame.position.set(RX - 0.03, 1.85, -2.6); frame.rotation.y = -Math.PI / 2; ink(frame, 1.4); room.add(frame);
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.63), cel(0xffffff, { map: portraitTexture(), rim: 0 }));
  photo.position.set(RX - 0.06, 1.85, -2.6); photo.rotation.y = -Math.PI / 2; room.add(photo);
  const garland = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 6, 20, Math.PI), cel(0xff8a1a, { shade: 0xa04a10 }));
  garland.position.set(RX - 0.08, 1.85, -2.6); garland.rotation.set(0, -Math.PI / 2, Math.PI); room.add(garland);
  const calendar = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.55), cel(0xf4ecd8, { shade: 0x9a90a8 }));
  calendar.position.set(-RX + 0.02, 1.7, -1.4); calendar.rotation.y = Math.PI / 2; room.add(calendar);
  const calPic = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.22), cel(0xe85a2a, { flat: true }));
  calPic.position.set(-RX + 0.03, 1.82, -1.4); calPic.rotation.y = Math.PI / 2; room.add(calPic);
  const sillDiya = diya({ scale: 1.6 });
  sillDiya.group.position.set(WX + 0.15, WY0 + 0.03, -0.05);
  room.add(sillDiya.group);
  const bulb = glowSprite(0xffd8a0, 0.6, 0);
  bulb.position.set(0, RH - 0.25, -RZ / 2);
  room.add(bulb);

  // ---------------- characters ----------------
  const ma = makeHuman({ name: 'ma', saree: 0xf4efe2, sareeShade: 0x9890b0, border: 0xc8102e, blouse: 0xf4efe2, hairStyle: 'bun', hair: 0xb8b8c8, hairShade: 0x5a5a72, glasses: true, shawl: 0x6a2a3a, skin: 0xc4875a, skinShade: 0x7a4436, earrings: false, necklace: false, iris: 0x3a2414 });
  ma.root.scale.setScalar(0.95);
  room.add(ma.root);
  const uma = makeHuman({ name: 'uma', crown: true, thirdEye: true });
  room.add(uma.root);
  const lion = makeLion();
  room.add(lion.root);

  // ---------------- magic: notes out of the radio / window, the ribbon to the sky ----------------
  const ribbonPts = [[WX, 1.5, -0.6], [WX + 0.2, 1.6, 0.6], [WX + 0.8, 2.6, 2.4], [WX + 0.2, 4.5, 3.4], [WX - 1.5, 6.5, 2.0], [WX - 2.0, 8.5, -2.0], [WX + 1.0, 11, -8], [WX + 3, 16, -20], [WX + 2, 26, -60], [WX - 5, 45, -140]];
  const melody = lightRibbon(ribbonPts, { radius: 0.16, segments: 500, intensity: 0.95 });
  room.add(melody);
  const melodyNotes = noteStream(melody.userData.curve, { count: 34, size: 0.9, spread: 1.6, speed: 0.08 });
  room.add(melodyNotes.group);
  // the melody leaves the house: keep it in world space so it stays visible when the room is hidden
  room.updateMatrixWorld(true);
  scene.attach(melody);
  scene.attach(melodyNotes.group);
  const radioNotesCurve = new THREE.CatmullRomCurve3([V(1.95, 1.0, -1.35), V(1.7, 1.3, -1.2), V(1.4, 1.6, -0.8), V(1.1, 1.7, -0.3), V(WX, 1.6, 0.4)]);
  const radioNotes = noteStream(radioNotesCurve, { count: 10, size: 0.12, spread: 0.18, speed: 0.15, intensity: 0.9 });
  room.add(radioNotes.group);

  // wellness sparkles spiralling up around Ma
  const SPK = 220, srnd = mulberry32(12);
  const sGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(SPK * 3), sCol = new Float32Array(SPK * 3), sSz = new Float32Array(SPK), sSd = new Float32Array(SPK), sMeta = [];
  for (let i = 0; i < SPK; i++) { sMeta.push([srnd(), srnd(), srnd()]); sCol.set([1.0, 0.75 + srnd() * 0.2, 0.35], i * 3); sSz[i] = 0.02 + srnd() * 0.03; sSd[i] = srnd(); }
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute('aColor', new THREE.BufferAttribute(sCol, 3));
  sGeo.setAttribute('aSize', new THREE.BufferAttribute(sSz, 1));
  sGeo.setAttribute('aSeed', new THREE.BufferAttribute(sSd, 1));
  const sparkles = new THREE.Points(sGeo, pointMaterial({ twinkle: 0.5, maxPx: 30 }));
  sparkles.frustumCulled = false;
  room.add(sparkles);
  const shiuliRain = particleRain({ count: 260, box: [3.5, 3, 3], center: [-1.0, 3.2, -0.8], seed: 6, size: [0.025, 0.04], color: [[1, 1, 1], [1, 1, 1], [1, 0.55, 0.15]], fall: 0.45, height: 3.2, wind: [0.1, 0, 0.05], spin: 0.25 });
  room.add(shiuliRain);

  // ---------------- helpers ----------------
  const world = (local) => room.localToWorld(local.clone());
  const litGlass = house.windows[1].glass;
  function setInterior(on, peek = false) {
    ext.visible = !on || peek;
    house.group.visible = !on || peek;
    houseBox.visible = !on && !peek;
    litGlass.visible = !peek;
    room.visible = on || peek;
    doorLight.visible = on && !peek;
    rays.visible = false;
  }
  function common(T) {
    for (const p of [petals, fireflies, sparkles, shiuliRain]) { p.material.uniforms.uTime.value = T; updatePointPx(p.material, camera, ctx.H); }
    melody.material.uniforms.uTime.value = T;
    flicker(sillDiya, T, 1);
    flicker(tulsiDiya, T, 2);
  }
  function hideAll() {
    melody.visible = false; melodyNotes.group.visible = false; radioNotes.group.visible = false; sparkles.visible = false; shiuliRain.visible = false;
    uma.root.visible = false; lion.root.visible = false; rays.visible = false;
    doorLight.material.color.setRGB(0.01, 0.015, 0.04); doorGlow.material.color.setRGB(0, 0, 0);
    bulb.material.color.setRGB(0, 0, 0);
    for (const d of doorLeaves) d.hinge.rotation.y = 0;
    ma.root.visible = true;
  }
  function preDawnRig(radioOn = 0, lamp = 0) {
    RIG.uLightDir.value.set(0.25, 0.55, 1.0).normalize();
    RIG.uLightColor.value.setRGB(0.42, 0.52, 0.9);
    RIG.uShadowTint.value.setRGB(0.16, 0.16, 0.38);
    RIG.uRimColor.value.setRGB(0.5, 0.6, 1.0);
    RIG.uRimStrength.value = 0.25;
    RIG.uFogColor.value.setRGB(0.03, 0.04, 0.12);
    RIG.uFogNear.value = 40; RIG.uFogFar.value = 260;
    const rp = world(V(1.75, 1.0, -1.25));
    RIG.uP1Pos.value.copy(rp);
    RIG.uP1Color.value.setRGB(0.75 * radioOn, 0.46 * radioOn, 0.2 * radioOn);
    RIG.uP1Range.value = 2.6;
    const dp = world(V(WX + 0.15, WY0 + 0.2, -0.1));
    RIG.uP2Pos.value.copy(dp);
    const f = 0.92 + 0.08 * Math.sin(RIG.uTime.value * 13);
    RIG.uP2Color.value.setRGB(0.75 * lamp * f, 0.45 * lamp * f, 0.18 * lamp * f);
    RIG.uP2Range.value = 3.2;
    INK.uInkColor.value.setRGB(0.02, 0.02, 0.06);
    sky.set('uZenith', 0x060a26); sky.set('uMid', 0x18245a); sky.set('uHorizon', 0x5a4a86); sky.set('uStars', 0.85); sky.set('uSunHalo', 0.25);
  }
  function eveningRig(doorOpen = 0) {
    RIG.uLightDir.value.set(-0.3, 1.0, 0.35).normalize();
    RIG.uLightColor.value.setRGB(1.0, 0.82, 0.62);
    RIG.uShadowTint.value.setRGB(0.42, 0.3, 0.42);
    RIG.uRimColor.value.setRGB(1.0, 0.75, 0.4);
    RIG.uRimStrength.value = 0.3 + 0.5 * doorOpen;
    RIG.uFogColor.value.setRGB(0.1, 0.05, 0.08);
    RIG.uFogNear.value = 60; RIG.uFogFar.value = 300;
    const dp = world(V(DX, 1.4, 0.6));
    RIG.uP1Pos.value.copy(dp);
    RIG.uP1Color.value.setRGB(0.8 * doorOpen, 0.58 * doorOpen, 0.28 * doorOpen);
    RIG.uP1Range.value = 5.5;
    const lp = world(V(WX + 0.15, WY0 + 0.2, -0.1));
    RIG.uP2Pos.value.copy(lp);
    RIG.uP2Color.value.setRGB(0.9, 0.55, 0.25);
    RIG.uP2Range.value = 2.5;
    INK.uInkColor.value.setRGB(0.06, 0.02, 0.04);
    bulb.material.color.setRGB(0.9, 0.75, 0.5);
  }
  const maBase = { face: {} };
  const tired = { spine: [0.22, 0, 0], chest: [0.12, 0, 0], neck: [0.1, 0, 0] };
  const SEAT = [0.95, 0.0, -1.4];
  const look = (extra = {}) => ({ bloom: 0.6, bloomRadius: 0.45, bloomThreshold: 0.98, streak: 0.3, streakThreshold: 1.1, vignette: 0.5, sat: 1.08, contrast: 1.06, lift: [0.01, 0.01, 0.04], ...extra });

  const shots = {
    exterior(lt, T, dur) {
      hideAll(); preDawnRig(0.0, 0); setInterior(false);
      ma.root.visible = false;
      camera.fov = 30; camera.updateProjectionMatrix();
      const u = ease.inOut2(clamp(lt / dur, 0, 1));
      camera.position.set(lerp(15, 8.5, u), lerp(4.2, 3.4, u), lerp(34, 18, u));
      camera.lookAt(lerp(2, 3, u), lerp(2.4, 2.0, u), 3);
      common(T);
      return look();
    },
    radio(lt, T, dur) {
      hideAll(); setInterior(true);
      const on = sstep(1.6, 2.4, lt);
      preDawnRig(0.15 + on * 0.85, 0);
      rad.setOn(on * (0.9 + 0.1 * Math.sin(T * 9)), T);
      camera.fov = 30; camera.updateProjectionMatrix();
      const u = ease.inOut2(clamp(lt / dur, 0, 1));
      camera.position.copy(world(V(lerp(2.28, 2.2, u), 1.4, lerp(-0.72, -0.82, u))));
      camera.lookAt(world(V(1.15, 1.12, -1.38)));
      const reach = window4(lt, 0.4, 1.3, 2.4, 3.2);
      ma.setPose(pose(POSES.sitChair, tired, {
        root: [...SEAT, Math.PI / 2],
        rSh: [-1.15 * reach - 0.35 * (1 - reach), 0, 0.12 - 0.05 * reach], rEl: [-0.4 * reach - 1.1 * (1 - reach), 0, 0], rWr: [0.3 * reach, 0, 0],
        head: [-0.12, -0.1 + 0.1 * on, 0], neck: [-0.05, 0, 0],
        face: { blink: blinkAt(T, 4), smile: 0.05 + on * 0.45, lookX: 0.2, browUp: on * 0.4 },
      }));
      ma.animate(T);
      radioNotes.group.visible = on > 0.5;
      radioNotes.update(T, { visible: sstep(2.6, 3.4, lt) });
      common(T);
      return look({ bloomThreshold: 0.98 });
    },
    lamp(lt, T, dur) {
      hideAll(); setInterior(true, true);
      const lit = sstep(1.2, 1.5, lt);
      preDawnRig(0.85, lit);
      rad.setOn(0.9, T);
      sillDiya.flame.visible = lit > 0.01;
      sillDiya.flame.scale.multiplyScalar(lit);
      camera.fov = 30; camera.updateProjectionMatrix();
      camera.position.copy(world(V(WX + 0.25, lerp(1.5, 1.42, lt / dur), lerp(1.75, 1.45, lt / dur))));
      camera.lookAt(world(V(WX - 0.02, 1.32, -0.5)));
      const look2 = sstep(2.2, 3.0, lt);
      ma.setPose(pose(POSES.stand, tired, {
        root: [WX - 0.05, 0, -0.55, 0],
        spine: [0.12 - 0.08 * look2, 0, 0],
        rSh: [-0.9 + 0.2 * look2, 0, 0.1], rEl: [-0.9, 0, 0], lSh: [-0.8 + 0.6 * look2, 0, 0.1], lEl: [-1.0, 0, 0],
        head: [0.25 - 0.55 * look2, 0.0, 0],
        face: { blink: blinkAt(T, 5), smile: 0.2 + 0.4 * look2, lookY: 0.6 * look2, browUp: 0.5 * look2 },
      }));
      ma.animate(T);
      common(T);
      return look({ bloomThreshold: 0.98, bloom: 0.6 });
    },
    melody(lt, T, dur) {
      hideAll(); preDawnRig(0.8, 1); setInterior(false);
      ma.root.visible = false;
      melody.visible = true;
      const rev = keys(lt, [[0, 0.04], [dur, 0.85, ease.inOut2]]);
      melody.material.uniforms.uReveal.value = rev;
      melody.material.uniforms.uTail.value = 0;
      melodyNotes.group.visible = true;
      melodyNotes.update(T, { start: 0.0, end: rev });
      camera.fov = 32; camera.updateProjectionMatrix();
      const u = ease.inOut3(clamp(lt / dur, 0, 1));
      const head = melody.userData.curve.getPointAt(Math.max(0.02, rev - 0.03));
      const hw = melody.localToWorld(head.clone());
      camera.position.set(lerp(9, 7, u), lerp(2.2, 7, u), lerp(14, 17, u));
      const tgt = V(lerp(4, hw.x, Math.min(1, u * 1.2)), lerp(2.4, hw.y, Math.min(1, u * 1.2)), lerp(3, hw.z, Math.min(1, u * 1.1)));
      camera.lookAt(tgt);
      sky.set('uSunHalo', 0.25 + 0.3 * u);
      common(T);
      return look({ bloom: 0.75, streak: 0.2 });
    },
    hear(lt, T, dur) {
      hideAll(); setInterior(true);
      eveningRig(0);
      sky.set('uZenith', 0x1a1240); sky.set('uMid', 0x4a2a6a); sky.set('uHorizon', 0xd86a4a); sky.set('uStars', 0.3);
      rad.setOn(0.0, T);
      camera.fov = 30; camera.updateProjectionMatrix();
      camera.position.copy(world(V(lerp(2.25, 2.15, lt / dur), 1.3, lerp(-2.45, -2.35, lt / dur))));
      camera.lookAt(world(V(1.1, 1.08, -1.4)));
      const hit = hitPulse(T, 0.12);
      const up = sstep(1.0, 1.6, lt);
      const rise = sstep(2.2, 3.6, lt);
      const seated = pose(POSES.sitChair, tired, { root: [...SEAT, Math.PI / 2 + 0.6], head: [0.15 - 0.3 * up, 0.35 * up, 0], face: { blink: lt < 1.0 ? 0.6 : blinkAt(T, 6) * 0.5, smile: 0.0 + 0.35 * up, browUp: 0.8 * up, lookX: -0.5 * up } });
      const standing = pose(POSES.stand, tired, { root: [SEAT[0] - 0.35, 0, SEAT[2] + 0.25, -1.0], face: { smile: 0.5, browUp: 0.6, lookX: -0.4 } });
      ma.setPose(mixPose(seated, standing, rise));
      ma.animate(T);
      // the drum beats make the flame + window jump
      sillDiya.flame.scale.multiplyScalar(1 + hit * 0.6);
      common(T);
      return look({ exposure: 1 + hit * 0.08, streak: 0.12 });
    },
    open(lt, T, dur) {
      hideAll(); setInterior(true);
      const op = ease.out3(sstep(0.6, 2.0, lt));
      eveningRig(op);
      for (const d of doorLeaves) d.hinge.rotation.y = d.s * op * 1.75;
      doorLight.material.color.setRGB(1.12 * op + 0.05, 0.82 * op + 0.03, 0.38 * op + 0.02);
      doorGlow.material.color.setRGB(1.0, 0.72, 0.3).multiplyScalar(0.3 * op);
      rays.visible = op > 0.01;
      doorLight.visible = true;
      rays.children.forEach((r, i) => (r.material.opacity = op * (0.07 + 0.04 * Math.sin(T * 2 + i * 1.7))));
      camera.fov = 30; camera.updateProjectionMatrix();
      camera.position.copy(world(V(lerp(0.4, 0.15, lt / dur), 1.45, -3.4)));
      camera.lookAt(world(V(DX + 0.1, 1.3, 0.0)));
      // Ma in front of the door, back to camera
      const surprise = sstep(1.8, 2.6, lt);
      ma.setPose(pose(POSES.stand, tired, {
        root: [DX + 0.35, 0, -0.9, 0.15],
        lSh: [-0.6 - 1.4 * surprise, 0, 0.2], lEl: [-0.4 - 1.5 * surprise, 0, 0], rSh: [-0.7 - 1.3 * surprise, 0, 0.2], rEl: [-0.4 - 1.5 * surprise, 0, 0],
        spine: [0.2 - 0.15 * surprise, 0, 0], head: [-0.1 * surprise, 0, 0],
        face: { blink: blinkAt(T, 7), smile: 0.3 + 0.5 * surprise, browUp: surprise, open: 0.4 * surprise },
      }));
      ma.animate(T);
      // Uma + Singho in the doorway, backlit
      uma.root.visible = true; lion.root.visible = op > 0.05;
      uma.setPose(pose(POSES.stand, { root: [DX, 0, 0.75, Math.PI], lSh: [-0.5, 0, 0.6], rSh: [-0.5, 0, 0.6], lEl: [-0.5, 0, 0], rEl: [-0.5, 0, 0], face: { smile: 0.9, third: 0.7, blink: blinkAt(T, 8) }, wind: [0.2, 0.2, -0.4] }));
      uma.animate(T);
      lion.setPose({ ...LION.stand, root: [DX + 0.9, 0, 1.9, Math.PI - 0.5], face: { blink: blinkAt(T, 9) } });
      lion.animate(T);
      common(T);
      return look({ bloom: 0.45, bloomRadius: 0.3, bloomThreshold: 0.98, streak: 0.15, flash: 0.06 * window4(lt, 0.9, 1.3, 1.4, 2.4), flashColor: [1, 0.85, 0.55] });
    },
    embrace(lt, T, dur) {
      hideAll(); setInterior(true);
      eveningRig(1);
      for (const d of doorLeaves) d.hinge.rotation.y = d.s * 1.75;
      doorLight.material.color.setRGB(1.3, 0.95, 0.45);
      doorGlow.material.color.setRGB(1.0, 0.72, 0.3).multiplyScalar(0.22);
      const heal = sstep(1.5, 4.5, lt);
      camera.fov = 28; camera.updateProjectionMatrix();
      const orbit = lerp(0.6, 0.15, ease.inOut2(clamp(lt / dur, 0, 1)));
      const c = V(DX + 0.1, 1.32, -0.42);
      camera.position.copy(world(V(c.x + Math.cos(orbit) * 2.0, 1.48 + 0.08 * heal, c.z - Math.sin(orbit) * 2.0)));
      camera.lookAt(world(c));
      // the embrace
      const hug = sstep(0.0, 0.8, lt);
      ma.setPose(pose(POSES.stand, mixPose(tired, {}, heal), POSES.embrace, {
        root: [DX + 0.12, 0, -0.62, Math.PI * 0.0 + 0.1],
        face: { blink: lt < 3.5 ? 1 : blinkAt(T, 10), smile: 0.6 + 0.4 * heal, open: 0.3 * heal * (0.6 + 0.4 * Math.sin(T * 9)) },
        head: [-0.15 * heal, 0.25, 0.1],
      }));
      ma.animate(T);
      ma.setDesat(0.6 * (1 - heal));
      if (ma.J.shawl) { ma.J.shawl.position.y = -0.55 * sstep(2.2, 3.6, lt); ma.J.shawl.visible = lt < 3.6; }
      uma.root.visible = true;
      uma.setPose(pose(POSES.stand, POSES.embrace, { root: [DX + 0.08, 0, -0.18, Math.PI + 0.1], face: { blink: lt < 3.0 ? 1 : blinkAt(T, 11), smile: 1, third: 0.6 + 0.4 * heal }, head: [-0.05, -0.25, -0.1], wind: [0.1, 0.3, 0] }));
      uma.animate(T);
      lion.root.visible = true;
      lion.setPose({ ...LION.stand, root: [DX + 0.15, 0, 1.15, Math.PI], neck: [0.25, 0, 0], head: [0.15, -0.35, 0.2], face: { blink: blinkAt(T, 12) } });
      lion.animate(T);
      // sparkles spiral up around Ma, shiuli flowers rain
      sparkles.visible = true;
      const mp = V(DX + 0.12, 0, -0.62);
      const arr = sGeo.attributes.position.array;
      for (let i = 0; i < SPK; i++) {
        const [a0, h0, r0] = sMeta[i];
        const tt = (T * 0.35 + h0) % 1;
        const ang = a0 * 6.283 + T * (1.5 + r0);
        const rr = (0.35 + 0.35 * r0) * (1 - tt * 0.5);
        arr[i * 3] = mp.x + Math.cos(ang) * rr; arr[i * 3 + 1] = mp.y + tt * 2.6; arr[i * 3 + 2] = mp.z + Math.sin(ang) * rr;
      }
      sGeo.attributes.position.needsUpdate = true;
      sparkles.material.uniforms.uOpacity.value = 0.6 * sstep(0.8, 1.6, lt) * (1 - sstep(dur - 1.2, dur, lt) * 0.6);
      shiuliRain.visible = true;
      shiuliRain.material.uniforms.uOpacity.value = sstep(0.5, 1.5, lt);
      common(T);
      return look({ bloom: 0.7, bloomThreshold: 0.98, streak: 0.2, sat: 1.0 + 0.15 * heal, flash: 0.1 * window4(lt, 2.0, 2.6, 2.8, 3.8), flashColor: [1, 0.85, 0.6] });
    },
  };
  return { scene, camera, sky, shots, ma, uma, lion };
}
