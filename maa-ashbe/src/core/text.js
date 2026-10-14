// Fonts + canvas-drawn title textures (Bengali display type).
import * as THREE from 'three';

const FONTS = [
  ['Galada', '/node_modules/@fontsource/galada/files/galada-bengali-400-normal.woff2', '400'],
  ['Galada', '/node_modules/@fontsource/galada/files/galada-latin-400-normal.woff2', '400'],
  ['Baloo Da 2', '/node_modules/@fontsource/baloo-da-2/files/baloo-da-2-bengali-800-normal.woff2', '800'],
  ['Baloo Da 2', '/node_modules/@fontsource/baloo-da-2/files/baloo-da-2-latin-800-normal.woff2', '800'],
  ['Cinzel', '/node_modules/@fontsource/cinzel/files/cinzel-latin-700-normal.woff2', '700'],
  ['Cinzel', '/node_modules/@fontsource/cinzel/files/cinzel-latin-900-normal.woff2', '900'],
];

export async function loadFonts() {
  await Promise.all(FONTS.map(async ([family, url, weight]) => {
    try {
      const f = new FontFace(family, `url(${url})`, { weight });
      await f.load();
      document.fonts.add(f);
    } catch (e) { console.warn('font failed', family, url, e.message); }
  }));
  await document.fonts.ready;
}

// Draw golden display text into a canvas. Returns { canvas, texture, aspect }.
export function goldText(text, opts = {}) {
  const {
    font = 'Galada', weight = '400', size = 220, pad = 80,
    fill = ['#fff6c8', '#ffd25a', '#e48a12', '#ffe9a0'], stroke = '#3a0d05', strokeW = 14, glow = 'rgba(255,190,80,0.9)', glowBlur = 40,
    letterSpacing = 0,
  } = opts;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = `${weight} ${size}px "${font}"`;
  const m = ctx.measureText(text);
  const w = Math.ceil(m.width + pad * 2 + letterSpacing * text.length);
  const asc = m.actualBoundingBoxAscent || size * 0.9, desc = m.actualBoundingBoxDescent || size * 0.35;
  const h = Math.ceil(asc + desc + pad * 2);
  c.width = w; c.height = h;
  ctx.font = `${weight} ${size}px "${font}"`;
  ctx.textBaseline = 'alphabetic';
  if (letterSpacing) ctx.letterSpacing = `${letterSpacing}px`;
  const x = pad, y = pad + asc;
  const g = ctx.createLinearGradient(0, pad, 0, pad + asc + desc);
  fill.forEach((col, i) => g.addColorStop(i / (fill.length - 1), col));
  ctx.lineJoin = 'round';
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = glowBlur; }
  if (strokeW > 0) { ctx.strokeStyle = stroke; ctx.lineWidth = strokeW; ctx.strokeText(text, x, y); }
  ctx.shadowBlur = 0;
  ctx.fillStyle = g;
  ctx.fillText(text, x, y);
  // inner highlight line
  ctx.globalCompositeOperation = 'source-atop';
  const hl = ctx.createLinearGradient(0, pad, 0, pad + asc * 0.6);
  hl.addColorStop(0, 'rgba(255,255,255,0.55)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.fillRect(0, 0, w, pad + asc * 0.45);
  ctx.globalCompositeOperation = 'source-over';
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  // clean glyph mask (no glow/stroke) at the same layout, for particle sampling
  const mask = document.createElement('canvas');
  mask.width = w; mask.height = h;
  const mc = mask.getContext('2d');
  mc.font = `${weight} ${size}px "${font}"`;
  if (letterSpacing) mc.letterSpacing = `${letterSpacing}px`;
  mc.fillStyle = '#fff';
  mc.fillText(text, x, y);
  return { canvas: c, mask, texture, aspect: w / h };
}

// Sample points inside the opaque pixels of a canvas: returns Float32Array of [u, v] in 0..1 pairs.
export function samplePoints(canvas, count, seed = 1, alphaMin = 128) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const data = ctx.getImageData(0, 0, w, h).data;
  const cand = [];
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / (count * 6))));
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) if (data[(y * w + x) * 4 + 3] > alphaMin) cand.push(x, y);
  const out = new Float32Array(count * 2);
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const n = cand.length / 2;
  for (let i = 0; i < count; i++) {
    const k = Math.floor(rnd() * n);
    out[i * 2] = (cand[k * 2] + rnd() * step) / w;
    out[i * 2 + 1] = 1 - (cand[k * 2 + 1] + rnd() * step) / h;
  }
  return out;
}

// Plane mesh displaying a text texture, height in world units.
export function textPlane(tex, height = 1, opts = {}) {
  const geo = new THREE.PlaneGeometry(height * tex.aspect, height);
  const mat = new THREE.MeshBasicMaterial({ map: tex.texture, transparent: true, depthWrite: false, toneMapped: false, opacity: opts.opacity ?? 1, blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = opts.renderOrder ?? 10;
  return m;
}
