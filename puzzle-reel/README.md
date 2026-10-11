# Escape Yourself — puzzle Reel ("Видеото е стаята")

`escape-yourself-puzzle.mp4`: 1080×1920, 30 fps, H.264 + AAC, exactly 15.0 s (450 frames), 128 BPM, loops seamlessly.

The video is itself an escape room. The exit code is **1 9 1 0**, the day the qualifications start.
Each digit is on screen for exactly **one frame** (a pink flash that says which position it is),
so viewers have to pause or screenshot to read it:

| Frame (counter on screen) | Time | Clue |
|---|---|---|
| КАДЪР 237 | 7.87 s | ЦИФРА 1 ОТ 4 → **1** |
| КАДЪР 302 | 10.03 s | ЦИФРА 2 ОТ 4 → **9** |
| КАДЪР 158 | 5.23 s | ЦИФРА 3 ОТ 4 → **1** |
| КАДЪР 001 | 0.00 s | ЦИФРА 4 ОТ 4 → **0** (only found when the Reel loops) |

A short audio blip marks every hidden frame. "4718" (the code from the first promo) appears as a decoy.

Posting tips: pick a cover frame that is not frame 1 (frame 1 is the hidden "0"); write the caption
as a challenge, e.g. "Заключени сте. Кодът е в коментарите… ако го намерите." Reveal the answer on 19.10.

Look: risograph print — three inks (ultramarine, fluorescent pink, brand yellow) overprinting on paper,
halftone, grainy edges and misregistration (`src/riso.js`, WebGL). Fonts: Unbounded + JetBrains Mono
(Google Fonts, OFL). Logos are composited unmodified on top of the print effect.

## Rebuild

```bash
npm install
python3 -I scripts/audio.py build/soundtrack.wav
node scripts/frames.mjs build/frames 0 450        # ~3 min
ffmpeg -framerate 30 -i build/frames/f%05d.jpg -i build/soundtrack.wav -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p -g 30 -c:a aac -b:a 256k -t 15 -movflags +faststart escape-yourself-puzzle.mp4
```
