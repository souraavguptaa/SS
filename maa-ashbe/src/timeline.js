// The edit: which set/shot plays when, and how each shot transitions in.
// Times are seconds from the start of the chosen two-minute music window.
// `tin` = transition into this shot, centred on its start time.

export const TIMELINE = [];
export let FILM_LENGTH = 120;

// Edit decision list. Each row: [set, shot, duration, transitionIn?, transitionDur?]
const EDL = [
  // Act I: the call across the cosmos (intro)
  ['cosmos', 'open', 8.0],
  ['cosmos', 'earth', 5.0, 'cut'],
  ['kailash', 'reveal', 6.0, 'glow', 1.4],
  ['kailash', 'uma', 4.5, 'cut'],
  // Act II: Ma's dawn (verse)
  ['house', 'exterior', 5.0, 'dissolve', 1.2],
  ['house', 'radio', 5.0, 'cut'],
  ['house', 'lamp', 4.0, 'cut'],
  ['house', 'melody', 5.0, 'cut'],
  // Act III: the call is heard (pre-chorus)
  ['kailash', 'call', 5.0, 'glow', 1.0],
  ['kailash', 'roar', 4.0, 'cut'],
  // Act IV: the journey (chorus)
  ['kailash', 'leap', 4.0, 'cut'],
  ['flight', 'chase', 8.0, 'cut'],
  ['bengal', 'bloom', 7.0, 'flash', 0.5],
  ['bengal', 'villages', 4.0, 'cut'],
  ['town', 'dhak', 3.5, 'cut'],
  ['town', 'lights', 4.0, 'cut'],
  ['town', 'crowd', 4.0, 'cut'],
  // Act V: homecoming (bridge)
  ['house', 'hear', 4.0, 'cut'],
  ['house', 'open', 5.0, 'cut'],
  ['house', 'embrace', 7.0, 'cut'],
  // Act VI: the blessing (final chorus / outro)
  ['town', 'rise', 5.0, 'glow', 1.0],
  ['town', 'goddess', 7.0, 'cut'],
  ['town', 'title', 6.0, 'dissolve', 1.2],
];
export const BASE_EDL = EDL;

export function setEDL(rows, total) {
  TIMELINE.length = 0;
  let t = 0;
  for (const [set, shot, dur, tin, tdur] of rows) {
    TIMELINE.push({ set, shot, start: t, end: t + dur, tin: tin && tin !== 'cut' ? { type: tin, dur: tdur ?? 1 } : null });
    t += dur;
  }
  FILM_LENGTH = total ?? t;
  if (TIMELINE.length) TIMELINE[TIMELINE.length - 1].end = Math.max(TIMELINE[TIMELINE.length - 1].end, FILM_LENGTH);
}
setEDL(EDL);

// Debug override: ?edl=set.shot:dur,set.shot:dur
const qs = new URLSearchParams(location.search);
if (qs.get('edl')) {
  setEDL(qs.get('edl').split(',').map((x) => { const [ss, d] = x.split(':'); const [a, b] = ss.split('.'); return [a, b, +d || 5]; }));
} else try {
  const r = await fetch('/audio/edl.json', { cache: 'no-store' });
  if (r.ok) {
    const j = await r.json();
    setEDL(j.rows, j.total);
  }
} catch (e) { /* use built-in EDL */ }

export function resolve(t) {
  let i = TIMELINE.findIndex((e) => t >= e.start && t < e.end);
  if (i < 0) i = t < 0 ? 0 : TIMELINE.length - 1;
  const cur = TIMELINE[i];
  // transition into the current shot (second half)
  if (cur.tin && i > 0 && t < cur.start + cur.tin.dur / 2) {
    const m = (t - (cur.start - cur.tin.dur / 2)) / cur.tin.dur;
    return { a: TIMELINE[i - 1], b: cur, mix: m, type: cur.tin.type };
  }
  // transition into the next shot (first half)
  const nx = TIMELINE[i + 1];
  if (nx && nx.tin && t >= nx.start - nx.tin.dur / 2) {
    const m = (t - (nx.start - nx.tin.dur / 2)) / nx.tin.dur;
    return { a: cur, b: nx, mix: m, type: nx.tin.type };
  }
  return { a: cur, b: null, mix: 0, type: 'cut' };
}
