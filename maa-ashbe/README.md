# মা আসবে — *Maa Ashbe: The Homecoming*

A two-minute animated short for SastaSundar's Agomoni song *Maa Ashbe | সুর থেকে সুস্থতা*,
built entirely in **Three.js**: a 90s hand-inked cartoon look (cel shading, ink outlines, painted skies)
shot like an 80s space-opera epic (2.39:1 frame, starfields, anamorphic flares, film grain, gate weave).

The story is in [STORY.md](STORY.md).

## How it works

* Every frame is a pure function of time: `window.seek(t)` (in `src/main.js`) builds the shot active at
  `t`, renders it with the cel/ink materials (`src/core/cel.js`) and the film post chain (`src/core/post.js`).
* `src/timeline.js` is the edit (23 shots). After music analysis, `audio/edl.json` overrides it so cuts land
  on downbeats and the journey starts on the song's lift; `audio/beats.json` drives the beat-synced light
  pulses, drum strikes and camera bumps (`src/core/audio.js`).
* Sets (`src/sets/*`): cosmos, kailash, house (Ma's home), flight, bengal, town (+ finale).
  Models (`src/models/*`): the human rig (Uma, Ma, the Dhaki, the ten-armed goddess), Singho the lion,
  nature, props, magic effects.

## Make the film

```bash
npm install                                   # three, playwright-core, fonts
python3 -m venv .venv && .venv/bin/pip install librosa soundfile scipy
.venv/bin/python tools/analyze.py "song.mp3"  # picks the best 2 minutes, writes audio/{beats,edl}.json + segment.wav
node tools/render.mjs --workers 3             # renders out/frames/f_XXXXX.jpg at 1920x816, 24 fps
tools/encode.sh                               # letterboxes to 1920x1080 and muxes audio/segment.wav
```

Useful flags: `node tools/render.mjs --from 40 --to 60 --every 24` (preview one frame per second),
`--edl "house.radio:6"` (render a single shot), `--resume` (continue an interrupted render).
Open `index.html?play=1` from a local server for a real-time preview with the music.

Fonts: Galada, Baloo Da 2 and Cinzel (SIL Open Font License) via `@fontsource`.
