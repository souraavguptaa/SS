// The golden "sur" ribbon, floating music notes and sparkle bursts.
import * as THREE from 'three';
import { mulberry32, clamp } from '../core/util.js';
import { sparkleTexture, glowTexture } from '../core/fx.js';

// Ribbon of light along a curve. uReveal (0..1) grows it from the start; uTail (0..1) erases from the start.
export function lightRibbon(points, { radius = 0.12, color = 0xffc24a, core = 0xfff4d0, segments = 400, radial = 10, intensity = 1.6, flat = 1 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.4);
  const geo = new THREE.TubeGeometry(curve, segments, radius, radial, false);
  // flatten into a ribbon (scale the radial offset along the binormal)
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uReveal: { value: 1 }, uTail: { value: 0 }, uColor: { value: new THREE.Color(color) }, uCore: { value: new THREE.Color(core) }, uInt: { value: intensity }, uOpacity: { value: 1 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime, uReveal, uTail, uInt, uOpacity; uniform vec3 uColor, uCore; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float u = vUv.x;
        if (u > uReveal || u < uTail) discard;
        float head = smoothstep(uReveal - 0.04, uReveal, u);
        float tail = smoothstep(uTail, uTail + 0.08, u);
        float facing = abs(dot(normalize(vN), normalize(vV)));
        float coreK = smoothstep(0.35, 0.95, facing);
        float pulses = 0.65 + 0.35 * sin(u * 120.0 - uTime * 9.0) + 0.25 * sin(u * 37.0 - uTime * 4.0);
        vec3 c = mix(uColor, uCore, coreK) * (0.7 + 0.5 * pulses);
        c += uCore * head * 0.8;
        float a = (0.35 + 0.65 * coreK) * tail * uOpacity;
        gl_FragColor = vec4(min(c * uInt * a, vec3(1.05)), 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.userData.curve = curve;
  return mesh;
}

// Draw a music-note glyph into a canvas texture (no font needed).
const noteTexCache = {};
export function noteTexture(kind = 0) {
  if (noteTexCache[kind]) return noteTexCache[kind];
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  g.lineWidth = 9;
  g.lineCap = 'round';
  const head = (x, y) => { g.save(); g.translate(x, y); g.rotate(-0.45); g.beginPath(); g.ellipse(0, 0, 17, 12, 0, 0, Math.PI * 2); g.fill(); g.restore(); };
  if (kind === 0) { // quaver
    head(46, 96); g.beginPath(); g.moveTo(60, 92); g.lineTo(60, 20); g.stroke();
    g.beginPath(); g.moveTo(60, 20); g.quadraticCurveTo(92, 40, 84, 70); g.stroke();
  } else { // beamed pair
    head(34, 100); head(92, 88);
    g.beginPath(); g.moveTo(48, 96); g.lineTo(48, 26); g.moveTo(106, 84); g.lineTo(106, 14); g.stroke();
    g.lineWidth = 14; g.beginPath(); g.moveTo(48, 28); g.lineTo(106, 16); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  noteTexCache[kind] = t;
  return t;
}

// Notes that travel along a curve (u from tStart.. with speed), bobbing and spinning. Returns { group, update(t) }.
export function noteStream(curve, { count = 24, seed = 5, size = 0.5, color = 0xffd27a, speed = 0.06, spread = 1.2, intensity = 1.4 } = {}) {
  const rnd = mulberry32(seed);
  const group = new THREE.Group();
  const items = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({ map: noteTexture(i % 2), color: new THREE.Color(color).multiplyScalar(intensity), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Sprite(mat);
    const sz = size * (0.7 + rnd() * 0.6);
    s.scale.setScalar(sz);
    group.add(s);
    items.push({ s, phase: rnd(), off: new THREE.Vector3((rnd() - 0.5) * spread, (rnd() - 0.5) * spread, (rnd() - 0.5) * spread), spin: (rnd() - 0.5) * 2, sz });
  }
  const p = new THREE.Vector3();
  function update(t, { start = 0, end = 1, visible = 1, tail = 0 } = {}) {
    for (const it of items) {
      let u = ((it.phase + t * speed) % 1);
      u = start + (end - start) * u;
      curve.getPointAt(clamp(u, 0, 1), p);
      it.s.position.copy(p).add(it.off).addScaledVector(it.off, Math.sin(t * 2 + it.phase * 10) * 0.3);
      it.s.material.rotation = Math.sin(t * 1.5 + it.phase * 6) * 0.4 + it.spin * 0.2;
      const fade = clamp(Math.min(u - start, end - u) * 12, 0, 1) * visible * (u < tail ? 0 : 1);
      it.s.material.opacity = fade;
      it.s.visible = fade > 0.01;
    }
  }
  return { group, update };
}

// Radial sparkle burst (deterministic): returns { points, update(t, t0) }
export function sparkleBurst({ count = 160, seed = 9, speed = 3, color = [1, 0.85, 0.45], size = 0.08, life = 1.6, gravity = -1 } = {}) {
  const rnd = mulberry32(seed);
  const dirs = [];
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2, z = rnd() * 2 - 1, r = Math.sqrt(1 - z * z);
    dirs.push([Math.cos(a) * r, z, Math.sin(a) * r, 0.4 + rnd() * 0.8, rnd()]);
  }
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), sz = new Float32Array(count), sd = new Float32Array(count);
  for (let i = 0; i < count; i++) { sz[i] = size * (0.5 + dirs[i][4]); sd[i] = dirs[i][4]; }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
  return { geo, dirs, count, speed, color, life, gravity };
}
