"""Natural voice-over from the raw take: no noise gate, no compressor, no reverb.

Keeps the speaker's own rhythm inside each sentence; only the long gaps between
sentences are shortened. Writes a 48 kHz mono WAV and a JSON with where each
sentence (and each spoken sub-phrase) lands in the new track; the picture reads it.

Usage: python3 -I scripts/voice_natural.py raw.wav out.wav out.json
"""
import sys
import json
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

raw, out_wav, out_json = sys.argv[1:4]
sr, x = wavfile.read(raw)
x = x.astype(np.float64) / 32768.0
if x.ndim > 1:
    x = x.mean(axis=1)
x = sosfilt(butter(2, 75, 'high', fs=sr, output='sos'), x)  # remove rumble only

# sentences: (text, [(start, end) of each spoken sub-phrase in the raw take])
SENT = [
    ('Над петдесет отбора.', [(0.70, 2.06)]),
    ('Над двеста играчи.', [(2.91, 3.07), (3.49, 3.95)]),
    ('Пет града. Една седмица.', [(4.88, 5.23), (5.89, 6.56)]),
    ('В някои градове решаваха секундите.', [(7.26, 8.00), (8.41, 9.32)]),
    ('В други — разликата беше убедителна.', [(10.01, 10.43), (10.78, 11.90)]),
    ('Много за малко. Всичко — на косъм.', [(12.80, 13.36), (14.05, 14.51)]),
    ('Само осем отбора продължават.', [(15.73, 17.12)]),
    ('Едно е сигурно — финалът ще е оспорван до последната секунда.', [(17.96, 18.51), (19.26, 20.12), (20.44, 21.27)]),
    ('Седми ноември. София.', [(21.95, 22.47), (22.96, 23.30)]),
    ('Финалистите — до двайсет и девети октомври. Следи имейла си.', [(23.97, 24.48), (25.21, 26.29), (26.87, 27.39)]),
]
GAP, LEAD, PRE, POST = 0.30, 0.35, 0.10, 0.22
out = [np.zeros(int(LEAD * sr))]
t = LEAD
marks = []
for text, parts in SENT:
    a, b = parts[0][0], parts[-1][1]
    seg = x[int((a - PRE) * sr):int((b + POST) * sr)].copy()
    f = int(0.015 * sr)
    seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)
    off = t + PRE - a  # raw time -> new time
    marks.append({'text': text, 'at': round(a + off, 3), 'end': round(b + off, 3),
                  'parts': [[round(p0 + off, 3), round(p1 + off, 3)] for p0, p1 in parts]})
    out.append(seg)
    t += len(seg) / sr
    out.append(np.zeros(int(GAP * sr)))
    t += GAP
y = np.concatenate(out)
# even out the sentence levels a little (plain gain per sentence, no compressor)
ref = None
for m in marks:
    i0, i1 = int(m['at'] * sr), int(m['end'] * sr)
    r = np.sqrt(np.mean(y[i0:i1] ** 2)) + 1e-9
    ref = ref or r
    y[int((m['at'] - PRE) * sr):int((m['end'] + POST) * sr)] *= np.clip(ref / r, 0.75, 1.35)
y *= 10 ** (-1.5 / 20) / np.max(np.abs(y))
wavfile.write(out_wav, sr, (y * 32767).astype(np.int16))
json.dump({'duration': round(len(y) / sr, 3), 'sentences': marks}, open(out_json, 'w'), ensure_ascii=False, indent=1)
print(f'voice {len(y) / sr:.2f}s')
for m in marks:
    print(f"{m['at']:6.2f}-{m['end']:6.2f}  {m['text']}")
