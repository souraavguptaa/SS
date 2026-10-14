// Particle + glow helpers (stars, sparkles, glow sprites, morphing particle clouds).
import * as THREE from 'three';
import { mulberry32 } from './util.js';

// ---- point sprites with twinkle + 4-point sparkle ----
const pointVert = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aSeed;
  uniform float uTime;
  uniform float uPx;       // pixels per world unit at distance 1 (= H / (2 tan(fov/2)))
  uniform float uTwinkle;
  uniform float uOpacity;
  uniform float uMaxPx;
  varying vec3 vColor;
  varying float vSpark;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float tw = 1.0 - uTwinkle * 0.5 * (1.0 + sin(uTime * (1.3 + aSeed * 3.7) + aSeed * 61.0));
    float px = aSize * uPx / max(-mv.z, 0.001);
    float sz = clamp(px, 1.6, uMaxPx);
    // keep sub-pixel stars from flickering: fade brightness instead of size
    float dim = clamp(px / 1.6, 0.0, 1.0);
    gl_PointSize = sz * 3.0;
    vColor = aColor * tw * dim * uOpacity;
    vSpark = smoothstep(4.0, 14.0, sz);
  }
`;
const pointFrag = /* glsl */ `
  varying vec3 vColor;
  varying float vSpark;
  void main() {
    vec2 p = (gl_PointCoord - 0.5) * 3.0; // -1.5..1.5, core radius ~0.5
    float r = length(p);
    float core = exp(-r * r * 9.0);
    float halo = exp(-r * 3.2) * 0.25;
    float cross = (exp(-abs(p.x) * 26.0) * exp(-abs(p.y) * 2.2) + exp(-abs(p.y) * 26.0) * exp(-abs(p.x) * 2.2)) * vSpark;
    float a = core + halo + cross * 0.8;
    gl_FragColor = vec4(vColor * a, 1.0);
  }
`;

export function pointMaterial(opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uPx: { value: 800 }, uTwinkle: { value: opts.twinkle ?? 0.4 }, uOpacity: { value: opts.opacity ?? 1 }, uMaxPx: { value: opts.maxPx ?? 40 },
    },
    vertexShader: pointVert, fragmentShader: pointFrag,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

export function updatePointPx(mat, camera, H) {
  mat.uniforms.uPx.value = H / (2 * Math.tan((camera.fov * Math.PI) / 360));
}

// A field of stars inside a box/shell. Returns THREE.Points.
export function starField({ count = 20000, radius = 800, inner = 50, seed = 7, sizeMin = 0.6, sizeMax = 3.5, colors, bias } = {}) {
  const rnd = mulberry32(seed);
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), size = new Float32Array(count), sd = new Float32Array(count);
  const pal = colors || [[1, 1, 1], [0.75, 0.85, 1], [1, 0.9, 0.7], [0.85, 0.8, 1], [1, 0.75, 0.6]];
  for (let i = 0; i < count; i++) {
    let x, y, z, d;
    do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; d = Math.hypot(x, y, z); } while (d > 1 || d < 1e-3);
    const r = inner + (radius - inner) * Math.cbrt(rnd());
    pos[i * 3] = (x / d) * r; pos[i * 3 + 1] = (y / d) * r; pos[i * 3 + 2] = (z / d) * r;
    if (bias) bias(pos, i, rnd);
    const c = pal[Math.floor(rnd() * pal.length)];
    const b = 0.5 + rnd() * 0.8;
    col[i * 3] = c[0] * b; col[i * 3 + 1] = c[1] * b; col[i * 3 + 2] = c[2] * b;
    const s = rnd();
    size[i] = sizeMin + (sizeMax - sizeMin) * s * s * s;
    sd[i] = rnd();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
  const p = new THREE.Points(g, pointMaterial());
  p.frustumCulled = false;
  return p;
}

// ---- soft radial glow sprite texture ----
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.15, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.22)');
  grd.addColorStop(0.7, 'rgba(255,255,255,0.05)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

// 4-point star sparkle texture (90s cartoon twinkle)
let sparkTex = null;
export function sparkleTexture() {
  if (sparkTex) return sparkTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.translate(128, 128);
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, 128);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.2, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.beginPath(); g.arc(0, 0, 128, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,1)';
  for (let k = 0; k < 2; k++) {
    g.save(); g.rotate((k * Math.PI) / 2);
    g.beginPath();
    g.moveTo(0, -126); g.quadraticCurveTo(7, -7, 126, 0); g.quadraticCurveTo(7, 7, 0, 126); g.quadraticCurveTo(-7, 7, -126, 0); g.quadraticCurveTo(-7, -7, 0, -126);
    g.fill(); g.restore();
  }
  sparkTex = new THREE.CanvasTexture(c);
  return sparkTex;
}

export function glowSprite(color = 0xffffff, size = 1, intensity = 1, tex = glowTexture()) {
  const m = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(color).multiplyScalar(intensity), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  return s;
}

// ---- generic "morph" particle cloud: particles fly from start positions to target positions ----
const morphVert = /* glsl */ `
  attribute vec3 aStart;
  attribute vec3 aEnd;
  attribute float aDelay;
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aSeed;
  uniform float uProg;      // 0..1 assemble
  uniform float uScatter;   // 0..1 disperse after assembled
  uniform vec3 uDrift;      // dispersal drift direction * distance
  uniform float uTime;
  uniform float uPx;
  uniform float uOpacity;
  uniform float uSwirl;
  varying vec3 vColor;
  varying float vSpark;
  void main() {
    float k = clamp((uProg - aDelay) / max(1.0 - aDelay, 0.001), 0.0, 1.0);
    k = k < 0.5 ? 4.0 * k * k * k : 1.0 - pow(-2.0 * k + 2.0, 3.0) / 2.0;
    vec3 p = mix(aStart, aEnd, k);
    // swirl while travelling
    float sw = sin(k * 3.14159) * uSwirl;
    p += vec3(sin(aSeed * 40.0 + uTime * 2.0), cos(aSeed * 33.0 + uTime * 1.7), sin(aSeed * 21.0)) * sw;
    // shimmer in place once assembled
    p += vec3(sin(uTime * 3.0 + aSeed * 90.0), cos(uTime * 2.6 + aSeed * 70.0), 0.0) * 0.006 * k;
    // scatter
    float s = clamp((uScatter - aSeed * 0.4) / 0.6, 0.0, 1.0);
    p += uDrift * s * (0.6 + aSeed) + vec3(sin(aSeed * 13.0), cos(aSeed * 17.0), sin(aSeed * 5.0)) * s * 0.4;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float px = aSize * uPx / max(-mv.z, 0.001);
    float sz = clamp(px, 1.5, 48.0);
    gl_PointSize = sz * 3.0;
    float tw = 0.75 + 0.25 * sin(uTime * (2.0 + aSeed * 5.0) + aSeed * 50.0);
    vColor = aColor * tw * uOpacity * (1.0 - s * s) * clamp(px / 1.5, 0.0, 1.0);
    vSpark = smoothstep(5.0, 16.0, sz);
  }
`;

export function morphCloud({ starts, ends, delays, sizes, colors, seeds }) {
  const n = ends.length / 3;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ends), 3));
  g.setAttribute('aStart', new THREE.BufferAttribute(new Float32Array(starts), 3));
  g.setAttribute('aEnd', new THREE.BufferAttribute(new Float32Array(ends), 3));
  g.setAttribute('aDelay', new THREE.BufferAttribute(new Float32Array(delays), 1));
  g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(sizes), 1));
  g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(colors), 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(seeds), 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uProg: { value: 0 }, uScatter: { value: 0 }, uDrift: { value: new THREE.Vector3(0, -1, 0) }, uTime: { value: 0 }, uPx: { value: 800 }, uOpacity: { value: 1 }, uSwirl: { value: 0.3 } },
    vertexShader: morphVert, fragmentShader: pointFrag,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false;
  p.count = n;
  return p;
}

// ---- deterministic particle "rain" (falling petals, snow, sparkles) evaluated in the vertex shader ----
const rainVert = /* glsl */ `
  attribute vec3 aOrigin;  // spawn position (top)
  attribute float aSeed;
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uFall;     // fall distance per second
  uniform float uHeight;   // loop height
  uniform vec3 uWind;
  uniform float uPx;
  uniform float uOpacity;
  uniform float uSpin;
  varying vec3 vColor;
  varying float vSpark;
  void main() {
    float t = uTime + aSeed * 37.0;
    float y = mod(t * uFall * (0.7 + aSeed * 0.6), uHeight);
    vec3 p = aOrigin - vec3(0.0, y, 0.0);
    p += uWind * y / max(uFall, 0.001);
    p.x += sin(t * (0.8 + aSeed) + aSeed * 30.0) * uSpin;
    p.z += cos(t * (0.7 + aSeed) + aSeed * 20.0) * uSpin;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float px = aSize * uPx / max(-mv.z, 0.001);
    float sz = clamp(px, 1.5, 40.0);
    gl_PointSize = sz * 3.0;
    float edge = smoothstep(0.0, 0.08, y / uHeight) * (1.0 - smoothstep(0.85, 1.0, y / uHeight));
    vColor = aColor * uOpacity * edge * clamp(px / 1.5, 0.0, 1.0);
    vSpark = smoothstep(6.0, 18.0, sz);
  }
`;
export function particleRain({ count = 2000, box = [20, 10, 20], center = [0, 10, 0], seed = 3, size = [0.04, 0.12], color = [1, 1, 1], fall = 1, height = 12, wind = [0, 0, 0], spin = 0.3 } = {}) {
  const rnd = mulberry32(seed);
  const o = new Float32Array(count * 3), s = new Float32Array(count), sz = new Float32Array(count), c = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    o[i * 3] = center[0] + (rnd() - 0.5) * box[0];
    o[i * 3 + 1] = center[1] + (rnd() - 0.5) * box[1];
    o[i * 3 + 2] = center[2] + (rnd() - 0.5) * box[2];
    s[i] = rnd(); sz[i] = size[0] + (size[1] - size[0]) * rnd();
    const col = typeof color[0] === 'number' ? color : color[Math.floor(rnd() * color.length)];
    const b = 0.7 + rnd() * 0.5;
    c[i * 3] = col[0] * b; c[i * 3 + 1] = col[1] * b; c[i * 3 + 2] = col[2] * b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(o), 3));
  g.setAttribute('aOrigin', new THREE.BufferAttribute(o, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(s, 1));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  g.setAttribute('aColor', new THREE.BufferAttribute(c, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFall: { value: fall }, uHeight: { value: height }, uWind: { value: new THREE.Vector3(...wind) }, uPx: { value: 800 }, uOpacity: { value: 1 }, uSpin: { value: spin } },
    vertexShader: rainVert, fragmentShader: pointFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false;
  return p;
}

// Project a world position to normalized screen coords (0..1, y up). Returns null if behind camera.
const _v = new THREE.Vector3();
export function toScreen(pos, camera) {
  _v.copy(pos).project(camera);
  if (_v.z > 1) return null;
  return [(_v.x + 1) / 2, (_v.y + 1) / 2];
}
