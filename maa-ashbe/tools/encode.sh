#!/usr/bin/env bash
# Encode rendered frames (+ the chosen music window if present) into the final 16:9 letterboxed MP4.
# usage: tools/encode.sh [frames_dir] [out.mp4]
set -euo pipefail
cd "$(dirname "$0")/.."
FRAMES="${1:-out/frames}"
OUT="${2:-out/maa-ashbe.mp4}"
FPS=24
VF="pad=1920:1080:0:132:black,format=yuv420p"
if [ -f audio/segment.wav ]; then
  ffmpeg -y -framerate $FPS -i "$FRAMES/f_%05d.jpg" -i audio/segment.wav -vf "$VF" \
    -c:v libx264 -preset slow -crf 18 -tune animation -profile:v high -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT"
else
  ffmpeg -y -framerate $FPS -i "$FRAMES/f_%05d.jpg" -vf "$VF" \
    -c:v libx264 -preset slow -crf 18 -tune animation -profile:v high -movflags +faststart "$OUT"
fi
echo "wrote $OUT"
