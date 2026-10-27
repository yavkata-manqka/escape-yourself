# Escape Yourself — finals reel

`escape-yourself-finals-reel.mp4`: 1080×1920, 30 fps, H.264 + AAC, 31.6 s. Kinetic typography in the
brand palette (yellow / cream / ink), no sound effects and no music — only the recorded voice
(`assets/voice/recording2.m4a`), lightly cleaned so it stays natural. Music is added in Instagram.

| Voice | Scene |
|---|---|
| Над петдесет отбора. | 50+ ОТБОРА |
| Над двеста играчи. | 200+ ИГРАЧИ |
| Пет града. Една седмица. | Map of Bulgaria, 5 ГРАДА, 1 СЕДМИЦА |
| В някои градове решаваха секундите. | Stopwatch, СЕКУНДИТЕ. |
| В други разликата беше убедителна. | Bars, УБЕДИТЕЛНА. |
| Много за малко. Всичко — на косъм. | Two blocks closing — на косъм. |
| Само осем отбора продължават. | Tokens fall, 8 remain — САМО 8 ПРОДЪЛЖАВАТ. |
| Едно е сигурно — финалът ще е оспорван до последната секунда. | ОСПОРВАН, draining bar |
| Седми ноември. София. | ФИНАЛ 7.11 СОФИЯ |
| Финалистите — до двайсет и девети октомври. Следи имейла си. | Envelope, СЛЕДИ ИМЕЙЛА СИ. |
| — | End card 1: logos, ФИНАЛ · 7.11 · СОФИЯ, partners |
| — | End card 2: ESCAPE ПАРТНЬОРИ на квалификациите |

## Rebuild

```bash
npm install
ffmpeg -i assets/voice/recording2.m4a -ac 1 -ar 48000 build/vo2_raw.wav
python3 -I scripts/voice_natural.py          # assets/voice/voice.wav + src/voice.json
node scripts/frames.mjs build/frames 0 948
ffmpeg -framerate 30 -i build/frames/f%05d.jpg -i assets/voice/voice.wav -map 0:v -map 1:a -af apad \
  -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -c:a aac -b:a 192k -t 31.6 -movflags +faststart \
  escape-yourself-finals-reel.mp4
```

Fonts: Inter, Playfair Display (OFL). Map: Natural Earth (public domain).
