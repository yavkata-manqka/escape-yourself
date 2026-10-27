# Escape Yourself — finals teaser ("8-те")

`escape-yourself-finals.mp4`: 1080×1920, 30 fps, H.264 + AAC, 32 s, Bulgarian voice-over.

The qualifications are over: 50+ teams, 5 cities, 1 week — only 8 go on to the final
(7.11, София). No team names are shown; the call to action is "Следи имейла си" because the
finalists are told by email by 29.10.

| Time | Scene |
|---|---|
| 0–3 s | Dark-glass 3D map of Bulgaria with a gold pulse — "КВАЛИФИКАЦИИТЕ ПРИКЛЮЧИХА." |
| 3–7.8 s | Team lights appear in the 5 cities; counters 50+ ОТБОРА · 5 ГРАДА · 1 СЕДМИЦА |
| 7.8–13 s | The teams rise into a wall of light and go dark in waves (52 → 38 → 24 → 14 → 8) — "САМО 8 ПРОДЪЛЖАВАТ." |
| 13–18.6 s | 8 gold light columns with locked "?" emblems in a line-up — "НАЙ-СИЛНИТЕ 8." |
| 18.6–23.4 s | Fly-through and hit — "ФИНАЛ · 7.11 · СОФИЯ" |
| 23.4–28.2 s | Email notification — "Финалистите — до 29.10", "СЛЕДИ ИМЕЙЛА СИ.", "и папката за спам" |
| 28.2–32 s | End card: Escape Yourself + USYC, 12 partners (white tiles), 5 escape partners (dark tiles) |

The 8 survivors are picked at random from the wall after the teams have left the map, so the
video does not hint at which cities the finalists come from.

## Files

- `src/timeline.js` — every cue (seconds, 100 BPM) and the voice-over phrase map; read by both the
  renderer and `scripts/audio.py`.
- `src/scene.js` — Three.js scene (map, team lights, wall, columns, dust), bloom + grade.
- `src/main.js`, `src/style.css`, `src/index.html` — text overlays, notification, end card.
- `scripts/audio.py` — synthesised trailer score + effects, voice clean-up (high-pass, spectral
  noise gate, presence, compression), phrase placement and ducking.
- `assets/voice/recording.m4a` — the recorded voice-over (single take, 12 phrases).

## Rebuild

```bash
npm install
node scripts/frames.mjs build/frames 0 960
ffmpeg -i assets/voice/recording.m4a -ac 1 -ar 48000 build/vo_raw.wav
python3 -I scripts/audio.py build/soundtrack.wav build/vo_raw.wav
ffmpeg -framerate 30 -i build/frames/f%05d.jpg -i build/soundtrack.wav -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -c:a aac -b:a 256k -t 32 -movflags +faststart escape-yourself-finals.mp4
```

Fonts: Oswald, Manrope (Google Fonts, OFL). Map: Natural Earth (public domain). Music and effects are
synthesised in code; no samples.
