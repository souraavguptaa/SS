#!/usr/bin/env python3
"""Analyse the song, choose the best ~2-minute window, and re-time the film's edit to it.

usage: python tools/analyze.py <song.mp3> [--target 120] [--start SECONDS] [--outdir audio]

Writes (in --outdir):
  analysis.json  full-song analysis + chosen window (for humans)
  beats.json     window-relative beats / downbeats / drum hits / energy (read by the page)
  edl.json       the edit re-timed so cuts land on downbeats and the journey hits on the song's lift
  segment.wav    the chosen window with fades (muxed into the final video)
"""
import argparse, json, os, subprocess, sys
import numpy as np
import librosa
import soundfile as sf

ap = argparse.ArgumentParser()
ap.add_argument('song')
ap.add_argument('--target', type=float, default=120.0)
ap.add_argument('--start', type=float, default=None, help='force the window start (seconds)')
ap.add_argument('--outdir', default=os.path.join(os.path.dirname(__file__), '..', 'audio'))
ap.add_argument('--edl', default=os.path.join(os.path.dirname(__file__), 'base_edl.json'))
args = ap.parse_args()
os.makedirs(args.outdir, exist_ok=True)

# ---- decode with ffmpeg for robustness ----
wav_full = os.path.join(args.outdir, 'full.wav')
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', args.song, '-ac', '2', '-ar', '44100', wav_full], check=True)
stereo, sr_full = sf.read(wav_full, always_2d=True)
y = librosa.to_mono(stereo.T.astype(np.float32))
sr = 22050
y = librosa.resample(y, orig_sr=sr_full, target_sr=sr)
dur = len(y) / sr
print(f'duration {dur:.1f}s')

# ---- rhythm ----
hop = 512
y_h, y_p = librosa.effects.hpss(y)
onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
perc_env = librosa.onset.onset_strength(y=y_p, sr=sr, hop_length=hop)
tempo, beat_frames = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr, hop_length=hop, tightness=100)
tempo = float(np.atleast_1d(tempo)[0])
# keep tempo in a musical range for animation (half/double if needed)
while tempo < 70: tempo *= 2
while tempo > 160: tempo /= 2
beats = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop)
print(f'tempo {tempo:.1f} bpm, {len(beats)} beats')

# downbeat phase (4/4): the beat phase with the strongest low-end + onset accent
spec = np.abs(librosa.stft(y_p, hop_length=hop))
freqs = librosa.fft_frequencies(sr=sr)
low = spec[freqs < 150].sum(axis=0)
low = low / (low.max() + 1e-9)
acc = onset_env / (onset_env.max() + 1e-9) + low[: len(onset_env)]
scores = [acc[beat_frames[p::4]].mean() if len(beat_frames[p::4]) else 0 for p in range(4)]
phase = int(np.argmax(scores))
downbeats = beats[phase::4]

# drum hits
on_frames = librosa.onset.onset_detect(onset_envelope=perc_env, sr=sr, hop_length=hop, backtrack=False)
on_times = librosa.frames_to_time(on_frames, sr=sr, hop_length=hop)
on_str = perc_env[on_frames]
on_str = on_str / (np.percentile(on_str, 95) + 1e-9) if len(on_str) else on_str
on_str = np.clip(on_str, 0, 1)

# ---- energy envelopes at 50 Hz ----
env_rate = 50
hop_e = sr // env_rate
rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop_e)[0]
rms_p = librosa.feature.rms(y=y_p, frame_length=2048, hop_length=hop_e)[0]
def norm(a):
    lo, hi = np.percentile(a, 5), np.percentile(a, 98)
    return np.clip((a - lo) / (hi - lo + 1e-9), 0, 1)
env = norm(rms)
perc = norm(rms_p)
env_s = np.convolve(env, np.ones(env_rate * 2) / (env_rate * 2), mode='same')  # 2 s smoothing

# ---- sections: novelty on beat-synchronous chroma + mfcc ----
chroma = librosa.feature.chroma_cqt(y=y_h, sr=sr, hop_length=hop)
mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13, hop_length=hop)
feat = np.vstack([librosa.util.normalize(chroma, axis=0), librosa.util.normalize(mfcc, axis=1)])
feat_b = librosa.util.sync(feat, beat_frames, aggregate=np.median)
n_seg = max(4, int(dur / 18))
try:
    bounds_b = librosa.segment.agglomerative(feat_b, n_seg)
    bound_times = sorted(set([0.0] + [float(beats[min(b, len(beats) - 1)]) for b in bounds_b if b > 0] + [dur]))
except Exception as e:  # pragma: no cover
    print('segmentation failed', e)
    bound_times = [0.0, dur]
# loudness changes are section changes too (chroma/mfcc are level-normalised)
sm4 = np.convolve(env, np.ones(env_rate * 4) / (env_rate * 4), mode='same')
dd = sm4[env_rate * 2:] - sm4[:-env_rate * 2]
for i in range(env_rate * 3, len(dd) - env_rate * 3):
    if abs(dd[i]) > 0.18 and abs(dd[i]) == np.abs(dd[i - env_rate * 3: i + env_rate * 3]).max():
        t_b = nearest_beat = float(beats[np.argmin(np.abs(beats - (i + env_rate) / env_rate))]) if len(beats) else (i + env_rate) / env_rate
        if min(abs(t_b - x) for x in bound_times) > 3: bound_times.append(t_b)
bound_times = sorted(bound_times)
print('section boundaries', [round(b, 1) for b in bound_times])

# ---- choose the best window ----
T = min(args.target, dur)
def nearest(arr, t):
    if len(arr) == 0: return t
    return float(arr[np.argmin(np.abs(np.asarray(arr) - t))])
cands = [0.0] + [float(d) for d in downbeats if d + T <= dur + 0.01]
best, best_s = 0.0, -1e9
hi_thresh = np.percentile(env_s, 65)
for s in cands:
    a, b = int(s * env_rate), int(min(dur, s + T) * env_rate)
    seg = env_s[a:b]
    if len(seg) < 10: continue
    energy = seg.mean()
    hot = (seg > hi_thresh).mean()
    # a lift (quiet -> loud) somewhere in the middle third is what makes the journey land
    d = np.diff(np.convolve(seg, np.ones(env_rate * 4) / (env_rate * 4), mode='same'))
    mid = d[int(len(d) * 0.3): int(len(d) * 0.62)]
    lift = mid.max() * env_rate * 2 if len(mid) else 0
    sb = 0.2 if (s < 0.5 or min(abs(s - x) for x in bound_times) < 1.5) else 0.0
    eb = 0.15 if (s + T >= dur - 0.5 or min(abs(s + T - x) for x in bound_times) < 2.0) else 0.0
    # the film opens quietly in space: prefer windows whose first 8 s are calmer than their middle
    calm = seg[: env_rate * 8].mean()
    quiet_start = 0.3 * max(0.0, seg[int(len(seg) * 0.4): int(len(seg) * 0.8)].mean() - calm)
    score = 0.45 * energy + 0.3 * hot + 0.35 * lift + sb + eb + quiet_start
    if score > best_s: best, best_s = s, score
if args.start is not None: best = float(args.start)
W0, W1 = best, min(dur, best + T)
print(f'window {W0:.2f}s -> {W1:.2f}s (score {best_s:.3f})')

# ---- write the audio segment with fades ----
fade_in = 0.0 if W0 < 0.5 else 0.6
fade_out = 2.5 if W1 < dur - 0.5 else 0.5
seg_wav = os.path.join(args.outdir, 'segment.wav')
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', f'{W0:.3f}', '-t', f'{W1 - W0:.3f}', '-i', wav_full,
                '-af', f'afade=t=in:st=0:d={fade_in},afade=t=out:st={max(0, W1 - W0 - fade_out):.3f}:d={fade_out},loudnorm=I=-14:TP=-1.5:LRA=11',
                '-ar', '48000', seg_wav], check=True)
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', seg_wav, '-c:a', 'libmp3lame', '-b:a', '192k', os.path.join(args.outdir, 'segment.mp3')], check=True)

# ---- window-relative beat data for the page ----
rel = lambda arr: [round(float(t) - W0, 4) for t in arr if W0 - 0.01 <= t <= W1]
a, b = int(W0 * env_rate), int(W1 * env_rate)
beats_json = {
    'tempo': round(tempo, 2),
    'beats': rel(beats), 'downbeats': rel(downbeats),
    'onsets': [[round(float(t) - W0, 4), round(float(s), 3)] for t, s in zip(on_times, on_str) if W0 <= t <= W1],
    'envRate': env_rate, 'env': [round(float(v), 3) for v in env[a:b]], 'perc': [round(float(v), 3) for v in perc[a:b]],
    'sections': [round(x - W0, 3) for x in bound_times if W0 <= x <= W1],
    'window': [round(W0, 3), round(W1, 3)],
}
json.dump(beats_json, open(os.path.join(args.outdir, 'beats.json'), 'w'))

# ---- re-time the edit ----
base = json.load(open(args.edl))
rows, acts = base['rows'], base['acts']  # acts: list of [rowIndex, name]
L = W1 - W0
base_total = sum(r[2] for r in rows)
# anchor: the journey act (chorus) starts on the biggest lift in the 35..62% range
seg = env_s[a:b]
sm = np.convolve(seg, np.ones(env_rate * 3) / (env_rate * 3), mode='same')
d = np.diff(sm)
lo_i, hi_i = int(len(d) * 0.35), int(len(d) * 0.62)
lift_t = (lo_i + int(np.argmax(d[lo_i:hi_i]))) / env_rate if hi_i > lo_i else L * 0.46
db = np.asarray(beats_json['downbeats']) if beats_json['downbeats'] else np.asarray(beats_json['beats'])
lift_t = nearest(db, lift_t)
journey_row = base['journeyRow']
base_journey = sum(r[2] for r in rows[:journey_row])
# piecewise-linear time map: [0, base_journey] -> [0, lift_t], [base_journey, base_total] -> [lift_t, L]
def tmap(t):
    if t <= base_journey: return t * lift_t / base_journey
    return lift_t + (t - base_journey) * (L - lift_t) / (base_total - base_journey)
cuts, acc_t = [0.0], 0.0
for r in rows:
    acc_t += r[2]
    cuts.append(tmap(acc_t))
# snap interior cuts to downbeats (or beats) keeping shots >= 2.2 s
snap_to = db if len(db) > 8 else np.asarray(beats_json['beats'])
snapped = [0.0]
for i in range(1, len(cuts) - 1):
    c = nearest(snap_to, cuts[i])
    if abs(c - cuts[i]) > 1.6: c = nearest(beats_json['beats'], cuts[i])
    c = max(c, snapped[-1] + 2.2)
    snapped.append(c)
snapped.append(L)
new_rows = []
for i, r in enumerate(rows):
    d_ = round(snapped[i + 1] - snapped[i], 4)
    new_rows.append([r[0], r[1], d_] + r[3:])
json.dump({'rows': new_rows, 'total': round(L, 4), 'lift': lift_t}, open(os.path.join(args.outdir, 'edl.json'), 'w'), indent=1)
json.dump({'duration': dur, 'tempo': tempo, 'window': [W0, W1], 'sections': bound_times, 'lift': lift_t, 'cuts': snapped}, open(os.path.join(args.outdir, 'analysis.json'), 'w'), indent=1)
os.remove(wav_full)
print('journey lift at', round(lift_t, 2), 's; cuts:', [round(c, 2) for c in snapped])
