// Entry point: builds the film and exposes window.seek(t) which paints the exact frame at time t.
import * as THREE from 'three';
import { createPost, LOOK_DEFAULTS } from './core/post.js';
import { RIG, INK, resetRig } from './core/cel.js';
import { loadAudio } from './core/audio.js';
import { loadFonts } from './core/text.js';
import { TIMELINE, FILM_LENGTH, resolve } from './timeline.js';
import { SETS } from './sets/index.js';

const q = new URLSearchParams(location.search);
const W = +q.get('w') || 1920;
const H = +q.get('h') || 816;
export const FPS = +q.get('fps') || 24;

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // the final film pass encodes to sRGB itself
renderer.toneMapping = THREE.NoToneMapping;
document.body.appendChild(renderer.domElement);
INK.uRes.value.set(W, H);

const post = createPost(renderer, W, H);
const ctx = { W, H, aspect: W / H, renderer };

await loadFonts();
await loadAudio();

const built = new Map();
async function getSet(name) {
  if (!built.has(name)) {
    const builder = SETS[name];
    if (!builder) throw new Error('unknown set ' + name);
    built.set(name, await builder(ctx));
  }
  return built.get(name);
}

// Pre-build sets needed for a time range so seek() never stalls on the first frame of a shot.
async function prebuild(t0 = 0, t1 = FILM_LENGTH) {
  for (const e of TIMELINE) if (e.end > t0 - 2 && e.start < t1 + 2) await getSet(e.set);
}

const clear = new THREE.Color(0, 0, 0);
const HIDE = (q.get('hidename') || '').split(',').filter(Boolean);
function renderEntry(entry, t, target, set) {
  resetRig();
  const lt = t - entry.start;
  const dur = entry.end - entry.start;
  RIG.uTime.value = t;
  const fn = set.shots[entry.shot];
  if (!fn) throw new Error(`unknown shot ${entry.set}.${entry.shot}`);
  const look = fn(lt, t, dur, entry) || {};
  const cam = look.camera || set.camera;
  if (set.sky) set.sky.uniforms.uTime.value = t;
  if (HIDE.length) (look.scene || set.scene).traverse((o) => { if (HIDE.includes(o.name)) o.visible = false; });
  renderer.setRenderTarget(target);
  renderer.setClearColor(clear, 1);
  renderer.clear();
  renderer.render(look.scene || set.scene, cam);
  return look;
}

function mixLooks(a, b, m) {
  const out = {};
  for (const k of Object.keys(LOOK_DEFAULTS)) {
    const va = a[k] ?? LOOK_DEFAULTS[k];
    const vb = b ? (b[k] ?? LOOK_DEFAULTS[k]) : va;
    if (Array.isArray(va)) out[k] = va.map((x, i) => x + (vb[i] - x) * m);
    else out[k] = va + (vb - va) * m;
  }
  return out;
}

const RAW = q.get('raw') === '1';
function applyLook(L, frame) {
  const { bloom, F, streak } = post;
  if (RAW) Object.assign(L, { bloom: 0, streak: 0, grain: 0, dust: 0, ca: 0, vignette: 0, flare: 0, weave: 0 });
  bloom.strength = L.bloom;
  bloom.radius = L.bloomRadius;
  bloom.threshold = L.bloomThreshold;
  streak.threshold = L.streakThreshold;
  F.uFrame.value = frame;
  F.uExposure.value = L.exposure; F.uContrast.value = L.contrast; F.uSat.value = L.sat;
  F.uVignette.value = L.vignette; F.uGrain.value = L.grain; F.uWeave.value = L.weave; F.uCA.value = L.ca;
  F.uStreak.value = L.streak; F.uDust.value = L.dust; F.uFade.value = L.fade; F.uFlash.value = L.flash;
  F.uLift.value.set(...L.lift); F.uGain.value.set(...L.gain);
  F.uStreakTint.value.set(...L.streakTint); F.uFlashColor.value.set(...L.flashColor);
  F.uFlare.value = L.flare; F.uFlarePos.value.set(...L.flarePos); F.uFlareTint.value.set(...L.flareTint);
  F.uIrisC.value.set(...L.irisC); F.uIrisR.value = L.irisR; F.uBars.value = L.bars;
}

const TRANS = { cut: 0, dissolve: 0, glow: 1, iris: 2, wipe: 3, flash: 4 };

async function seek(t) {
  const frame = Math.round(t * FPS);
  const r = resolve(t);
  const setA = await getSet(r.a.set);
  const setB = r.b ? await getSet(r.b.set) : null;
  let lookA = {}, lookB = null;
  post.shotPass.job = {
    a: (rend, target) => { lookA = renderEntry(r.a, t, target, setA); },
    b: r.b ? (rend, target) => { lookB = renderEntry(r.b, t, target, setB); } : null,
    mix: r.mix,
    type: TRANS[r.type] ?? 0,
    after: () => applyLook(mixLooks(lookA, lookB, r.b ? r.mix : 0), frame),
  };
  post.composer.render();
  renderer.setRenderTarget(null);
  return frame;
}

window.seek = seek;
window.prebuild = prebuild;
window.FILM_LENGTH = FILM_LENGTH;
window.TIMELINE = TIMELINE;

// Optional live preview: ?play=1 (plays in real time with the music).
if (q.get('play')) {
  await prebuild();
  const audio = new Audio('/audio/segment.mp3');
  let t0 = null;
  document.body.addEventListener('click', () => { audio.currentTime = 0; audio.play(); t0 = performance.now(); });
  const loop = async () => {
    const t = t0 === null ? 0 : (audio.currentTime || (performance.now() - t0) / 1000);
    await seek(t % FILM_LENGTH);
    requestAnimationFrame(loop);
  };
  loop();
}

window.__ready = true;
