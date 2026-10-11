#!/usr/bin/env bash
# Encode rendered frames + soundtrack into the final vertical MP4.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -I scripts/audio.py build/soundtrack.wav
ffmpeg -y -loglevel error -framerate 30 -i build/frames/f%05d.jpg -i build/soundtrack.wav \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 17 -profile:v high -pix_fmt yuv420p \
  -vf "scale=1080:1920:flags=lanczos,format=yuv420p" -r 30 \
  -c:a aac -b:a 256k -ar 48000 -t 30 -movflags +faststart escape-yourself-promo.mp4
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt,sample_rate -show_entries format=duration -of compact escape-yourself-promo.mp4
