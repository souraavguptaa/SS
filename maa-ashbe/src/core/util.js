// Deterministic math + animation helpers. Everything in the film is a pure function of time.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => clamp((x - a) / (b - a));
export const remap = (x, a, b, c, d) => lerp(c, d, invLerp(a, b, x));
export const smooth = (t) => t * t * (3 - 2 * t);
export const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export const sstep = (a, b, x) => smooth(invLerp(a, b, x));
export const fract = (x) => x - Math.floor(x);
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const ease = {
  linear: (t) => t,
  in2: (t) => t * t,
  out2: (t) => 1 - (1 - t) * (1 - t),
  inOut2: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  in3: (t) => t * t * t,
  out3: (t) => 1 - Math.pow(1 - t, 3),
  inOut3: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out5: (t) => 1 - Math.pow(1 - t, 5),
  inOut5: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  outBack: (t) => { const s = 1.70158; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); },
  inBack: (t) => { const s = 1.70158; return (s + 1) * t * t * t - s * t * t; },
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  smooth, smoother,
};

// Closed-form damped spring 0 -> 1 starting at t0 (k stiffness, d damping, mass 1).
export function spring(t, t0, k = 170, d = 20) {
  if (t <= t0) return 0;
  const x = t - t0, w0 = Math.sqrt(k), z = d / (2 * w0);
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * x) * (Math.cos(wd * x) + ((z * w0) / wd) * Math.sin(wd * x));
  }
  return 1 - Math.exp(-w0 * x) * (1 + w0 * x);
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Integer-ish hash -> [0,1)
export function hash1(n) {
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}
export function hash2(a, b) { return hash1(a * 157.31 + b * 113.97); }

export function noise1(x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash1(i), hash1(i + 1), u) * 2 - 1;
}
export function fbm1(x, oct = 3) {
  let v = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { v += a * noise1(x * f + i * 17.3); n += a; a *= 0.5; f *= 2.03; }
  return v / n;
}

// Keyframe interpolation. kf = [[t, value, easeFn?], ...]; the ease of the *destination* key is used.
// value can be a number or an array of numbers.
export function keys(t, kf) {
  if (t <= kf[0][0]) return kf[0][1];
  for (let i = 1; i < kf.length; i++) {
    const [t1, v1, e] = kf[i];
    if (t <= t1) {
      const [t0, v0] = kf[i - 1];
      const u = (e || ease.inOut2)((t - t0) / (t1 - t0 || 1));
      if (Array.isArray(v0)) return v0.map((a, j) => lerp(a, v1[j], u));
      return lerp(v0, v1, u);
    }
  }
  return kf[kf.length - 1][1];
}

// Wrap time for loops.
export const loopT = (t, dur) => ((t % dur) + dur) % dur;

// Pulse that peaks at 1 when t == t0 and decays exponentially afterwards.
export function pulse(t, t0, decay = 0.25) {
  if (t < t0) return 0;
  return Math.exp(-(t - t0) / decay);
}

// Smooth bump that rises over [a,b] and falls over [c,d].
export function window4(x, a, b, c, d) {
  return sstep(a, b, x) * (1 - sstep(c, d, x));
}
