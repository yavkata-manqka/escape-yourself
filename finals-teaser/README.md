# Escape Yourself — finals teaser ("8-те")

`escape-yourself-finals.mp4`: 1080×1920, 30 fps, H.264 + AAC, 25.6 s, Bulgarian voice-over
(`assets/voice/recording2.m4a`; every scene starts on its spoken phrase).

| Time | Scene |
|---|---|
| 0–4.6 s | Map of Bulgaria lights up; counters slam in: 50+ ОТБОРА · 200+ ИГРАЧИ · 5 ГРАДА · 1 СЕДМИЦА |
| 4.6–10.9 s | "На косъм": anonymous light lanes race — СЕКУНДИ. / УБЕДИТЕЛНО. / МНОГО ЗА МАЛКО. / НА КОСЪМ. (symbolic, no real results) |
| 10.9–12.9 s | Wall of 52 team lights goes dark in waves → "САМО 8 ПРОДЪЛЖАВАТ." |
| 12.9–16.5 s | 8 gold columns with "?" emblems — "ЕДНО Е СИГУРНО · ОСПОРВАН ДО ПОСЛЕДНАТА СЕКУНДА." |
| 16.5–18.1 s | Hit — "ФИНАЛ · 7.11 · СОФИЯ" |
| 18.1–21.4 s | Email notification — "Финалистите — до 29.10", "СЛЕДИ ИМЕЙЛА СИ.", "и папката за спам" |
| 21.4–25.6 s | End card: Escape Yourself + USYC, 12 partners, 5 escape partners |

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
node scripts/frames.mjs build/frames 0 768
ffmpeg -i assets/voice/recording2.m4a -ac 1 -ar 48000 build/vo2_raw.wav
python3 -I scripts/audio.py build/soundtrack.wav build/vo2_raw.wav
ffmpeg -framerate 30 -i build/frames/f%05d.jpg -i build/soundtrack.wav -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -c:a aac -b:a 256k -t 25.6 -movflags +faststart escape-yourself-finals.mp4
```

Fonts: Oswald, Manrope (Google Fonts, OFL). Map: Natural Earth (public domain). Music and effects are
synthesised in code; no samples.
