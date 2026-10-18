# Escape Yourself — puzzle Reel ("Видеото е стаята")

`escape-yourself-puzzle.mp4`: 1080×1920, 30 fps, H.264 + AAC, 23.9 s (717 frames), 128 BPM.

Structure: 1.5 s "loading" intro (nothing essential — the first second is often missed),
the puzzle (each text block holds ~0.8 s extra so it can be read calmly), then a 3 s+ hold on the
final card (call to action, Escape Yourself + USYC logos, 11 partners). All timing lives in
`src/timeline.json` (story frames, text holds, digit flash length) and is shared by the renderer and the audio.

The video is itself an escape room. The exit code is **1 9 1 0**, the day the qualifications start.
Each digit flashes for 0.2 s (6 frames) as a pink screen that says which position it is,
so viewers have to tap to pause to read it:

| Time | Clue |
|---|---|
| 11.77 s | ЦИФРА 1 ОТ 4 → **1** |
| 14.33 s | ЦИФРА 2 ОТ 4 → **9** |
| 10.23 s | ЦИФРА 3 ОТ 4 → **1** |
| 1.50 s | ЦИФРА 4 ОТ 4 → **0** (right after the intro: "where it started") |

A short audio blip and tone mark every digit. "4718" (the code from the first promo) appears as a decoy.

Posting tips: pick a cover frame that is not a hidden frame; write the caption
as a challenge, e.g. "Заключени сте. Кодът е в коментарите… ако го намерите." Reveal the answer on 19.10.

Look: risograph print — three inks (ultramarine, fluorescent pink, brand yellow) overprinting on paper,
halftone, grainy edges and misregistration (`src/riso.js`, WebGL). Fonts: Unbounded + JetBrains Mono
(Google Fonts, OFL). Logos are composited unmodified on top of the print effect.

## Rebuild

```bash
npm install
python3 -I scripts/audio.py build/soundtrack.wav
node scripts/frames.mjs build/frames 0 717        # ~5 min
ffmpeg -framerate 30 -i build/frames/f%05d.jpg -i build/soundtrack.wav -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p -g 30 -c:a aac -b:a 256k -t 23.9 -movflags +faststart escape-yourself-puzzle.mp4
```

Partner logos: put the files in `assets/partners/` and list them in `assets/partners/partners.json`
(`{ "name": ..., "file": ... }`, display order). Tiles without a file render as red dashed placeholders.
