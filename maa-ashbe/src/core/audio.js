// Beat/energy data extracted from the song (audio/beats.json, times relative to the film's t=0).
// Falls back to a synthetic grid so scenes can be previewed before the analysis exists.

export const AUDIO = {
  tempo: 96,
  beats: [],
  downbeats: [],
  onsets: [], // [time, strength 0..1]
  envRate: 50,
  env: [],     // RMS envelope 0..1 sampled at envRate
  perc: [],    // percussive energy 0..1 sampled at envRate
  sections: [],
  loaded: false,
};

export async function loadAudio(url = '/audio/beats.json') {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (r.ok) {
      Object.assign(AUDIO, await r.json());
      AUDIO.loaded = true;
    }
  } catch (e) { /* fall through */ }
  if (!AUDIO.beats.length) {
    const spb = 60 / AUDIO.tempo;
    for (let t = 0; t < 130; t += spb) AUDIO.beats.push(+t.toFixed(4));
    AUDIO.downbeats = AUDIO.beats.filter((_, i) => i % 4 === 0);
    AUDIO.onsets = AUDIO.beats.map((t, i) => [t, i % 4 === 0 ? 1 : 0.6]);
  }
  return AUDIO;
}

function lastIndexLE(arr, t, key = (x) => x) {
  let lo = 0, hi = arr.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (key(arr[mid]) <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

export function beatIndex(t) { return lastIndexLE(AUDIO.beats, t); }
export function lastBeat(t) { const i = beatIndex(t); return i < 0 ? -1e9 : AUDIO.beats[i]; }
export function nextBeat(t) { const i = beatIndex(t); return AUDIO.beats[i + 1] ?? 1e9; }
// Exponential pulse on every beat.
export function beatPulse(t, decay = 0.18) { const b = lastBeat(t); return Math.exp(-(t - b) / decay); }
export function downbeatPulse(t, decay = 0.3) {
  const i = lastIndexLE(AUDIO.downbeats, t);
  if (i < 0) return 0;
  return Math.exp(-(t - AUDIO.downbeats[i]) / decay);
}
// Strength-weighted onset pulse (drum hits).
export function hitPulse(t, decay = 0.15, minStrength = 0.0) {
  let i = lastIndexLE(AUDIO.onsets, t, (o) => o[0]);
  let v = 0;
  for (let k = 0; k < 4 && i - k >= 0; k++) {
    const [ot, s] = AUDIO.onsets[i - k];
    if (s < minStrength) continue;
    v = Math.max(v, s * Math.exp(-(t - ot) / decay));
  }
  return v;
}
function sampleArr(arr, t) {
  if (!arr.length) return 0.5;
  const x = t * AUDIO.envRate;
  const i = Math.floor(x), f = x - i;
  const a = arr[Math.max(0, Math.min(arr.length - 1, i))], b = arr[Math.max(0, Math.min(arr.length - 1, i + 1))];
  return a + (b - a) * f;
}
export function energy(t) { return sampleArr(AUDIO.env, t); }
export function percEnergy(t) { return sampleArr(AUDIO.perc, t); }
// Beats inside [t0, t1)
export function beatsBetween(t0, t1) { return AUDIO.beats.filter((b) => b >= t0 && b < t1); }
