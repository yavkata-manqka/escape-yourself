"""Soundtrack for the finals teaser: epic hybrid-trailer score at 100 BPM (beat = 0.6 s), 32 s.

Synthesised in code (numpy/scipy), no samples. If voice-over files are given, each recorded
line is placed at its window from src/timeline.js and the music is ducked underneath it.

Usage:
  python3 -I scripts/audio.py out.wav                      # music + effects only
  python3 -I scripts/audio.py out.wav vo1.wav ... vo6.wav  # with the six recorded lines
"""
import sys
import re
import os
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 48000
DUR = 32.0
N = int(SR * DUR)
BEAT = 0.6
rng = np.random.default_rng(711)
music = np.zeros((N, 2))
sfx = np.zeros((N, 2))
send = np.zeros((N, 2))

# timeline (read from the JS file so picture and sound share one source of truth)
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'timeline.js'), encoding='utf-8').read()
T = {k: float(v) for k, v in re.findall(r"^\s+(\w+): ([\d.]+),", src, re.M)}
WAVES = [float(x) for x in re.search(r"waves: \[([^\]]+)\]", src).group(1).split(',')]
VO = [(float(a), float(b), float(at)) for a, b, at in re.findall(r"src: \[([\d.]+), ([\d.]+)\], at: ([\d.]+)", src)]


def tt(d): return np.arange(int(d * SR)) / SR
def lp(x, f): return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
def hp(x, f): return sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)
def bp(x, a, b): return sosfilt(butter(2, [a, b], 'band', fs=SR, output='sos'), x)
def noise(d): return rng.standard_normal(int(d * SR))
def env(t, d, a=0.003): return np.clip(t / a, 0, 1) * np.exp(-t / d)
def sine(f, t): return np.sin(2 * np.pi * np.cumsum(np.broadcast_to(f, t.shape)) / SR)
def saw(f, t): return 2 * ((np.cumsum(np.broadcast_to(f, t.shape)) / SR) % 1) - 1
def note(m): return 440 * 2 ** ((m - 69) / 12)


def place(bus, sig, start, gain=1.0, pan=0.0, rev=0.0):
    i0 = int(round(start * SR))
    if i0 >= N or len(sig) == 0:
        return
    s = sig[: N - i0] * gain
    l, r = np.sqrt(1 - pan), np.sqrt(1 + pan)
    bus[i0:i0 + len(s), 0] += s * l
    bus[i0:i0 + len(s), 1] += s * r
    if rev:
        send[i0:i0 + len(s), 0] += s * l * rev
        send[i0:i0 + len(s), 1] += s * r * rev


def sweep(x, f0, f1, kind='low', blocks=48):
    out = np.zeros_like(x)
    for b in range(blocks):
        a, z = b * len(x) // blocks, (b + 1) * len(x) // blocks
        f = f0 * (f1 / f0) ** (b / max(1, blocks - 1))
        out[a:z] = lp(x[a:z], f) if kind == 'low' else bp(x[a:z], f * 0.7, min(f * 1.4, 20000))
    return out


# ------------------------------------------------------------------ instruments
def braam(d=2.2, root=36, bright=1600, gain=1.0):
    t = tt(d)
    s = sum(a * saw(note(m) * dt, t) for m, a, dt in ((root, 1, 1), (root, 0.8, 1.006), (root + 7, 0.6, 1), (root + 12, 0.5, 0.997), (root + 19, 0.2, 1)))
    s = np.tanh(2.2 * sweep(s / 3, bright, 160))
    boom = sine(30 + 50 * np.exp(-t / 0.35), t) * env(t, 0.6)
    tr = hp(noise(d), 1800) * env(t, 0.03) * 0.3
    e = np.clip(t / 0.012, 0, 1) * (0.4 + 0.6 * np.exp(-t / 0.7)) * np.clip((d - t) / 0.2, 0, 1)
    return (s * e * 0.9 + boom + tr) * gain


def taiko(gain=1.0, pitch=1.0):
    t = tt(0.7)
    body = sine((55 + 70 * np.exp(-t / 0.03)) * pitch, t) * env(t, 0.22)
    skin = bp(noise(0.7), 120, 900) * env(t, 0.05)
    return np.tanh(1.6 * (body + skin * 0.6)) * gain


def ping(m, gain=0.4):
    t = tt(1.4)
    s = sum(a * np.sin(2 * np.pi * note(m) * p * t) * np.exp(-t / (0.9 / p)) for p, a in ((1, 1), (2.01, 0.4), (3.0, 0.15)))
    return s * gain * np.clip(t / 0.004, 0, 1)


def pad(chord, d, gain=0.25, cutoff=1400):
    t = tt(d)
    s = sum(saw(note(m), t) + saw(note(m) * 1.004, t) + saw(note(m) * 0.996, t) for m in chord) / (3 * len(chord))
    s = lp(s, cutoff)
    e = np.clip(t / 0.6, 0, 1) * np.clip((d - t) / 0.8, 0, 1)
    return s * e * gain


def riser(d, f0=200, f1=6000, gain=0.5):
    t = tt(d)
    n = sweep(noise(d), f0, f1, 'band')
    tone = saw(110 * (4 ** (t / d)), t) * 0.25 + saw(110.7 * (4 ** (t / d)), t) * 0.25
    return (n * 0.6 + lp(tone, 3000)) * (t / d) ** 2 * gain


def whoosh(d=0.5, gain=0.5):
    t = tt(d)
    return sweep(noise(d), 4000, 300, 'band') * np.sin(np.pi * t / d) ** 2 * gain


def tick(gain=0.3):
    t = tt(0.04)
    return (np.sin(2 * np.pi * 2800 * t) * np.exp(-t / 0.006) + bp(noise(0.04), 3000, 9000) * np.exp(-t / 0.003) * 0.4) * gain


def notify(gain=0.5):  # two-tone phone notification
    out = np.zeros(int(0.7 * SR))
    for k, (m, at) in enumerate(((88, 0.0), (93, 0.13))):
        s = ping(m, 1.0)[: int(0.55 * SR)]
        i0 = int(at * SR)
        out[i0:i0 + len(s)] += s[: len(out) - i0]
    return out * gain


def crash(d=3.0, gain=0.5):
    t = tt(d)
    return hp(noise(d), 4500) * env(t, 0.9) * gain


# ------------------------------------------------------------------ score
# 0-3: drone + shimmer under the title
t = tt(8.0)
drone = lp(saw(note(26), t) + saw(note(26) * 1.005, t) + 0.6 * sine(note(38), t), 220) * 0.25
drone *= np.clip(t / 1.5, 0, 1) * np.clip((8.0 - t) / 0.8, 0, 1)
place(music, drone, 0.0)
place(sfx, whoosh(1.2, 0.35)[::-1], 0.0)          # reverse swell into the title
place(sfx, ping(93, 0.25), T['title1'], rev=0.6)
place(sfx, ping(100, 0.15), T['title1'] + 0.05, pan=0.4, rev=0.6)

# 3-7.8: pulse of low drums, a ping per city (one per beat), counter ticks
for b in range(int((T['rise'] - T['teams']) / BEAT)):
    t0 = T['teams'] + b * BEAT
    place(music, taiko(0.55 if b % 2 == 0 else 0.35), t0)
for i, m in enumerate((69, 72, 76, 79, 81)):
    place(sfx, ping(m, 0.28), T['teams'] + i * BEAT, pan=-0.5 + i * 0.25, rev=0.5)
for i in range(3):
    t0 = T[f'counter{i + 1}']
    for k in range(10):
        place(sfx, tick(0.18), t0 + k * 0.11, pan=-0.3 + i * 0.3)
place(music, pad([50, 57, 62, 65], 4.8, 0.18, 900), 3.0)

# 7.8-9.6: everything rises into the wall
place(sfx, riser(1.8, 200, 4000, 0.45), T['rise'])
# 9.6-12.0: each wave of teams going dark is a BRAAM; survivors shimmer at 12.0
for i, w in enumerate(WAVES[:4]):
    place(music, braam(BEAT * 1.0 + 0.05, 36 - i, 1300 + i * 200, 0.9), w, rev=0.3)
place(sfx, ping(88, 0.3), WAVES[4], rev=0.7); place(sfx, ping(95, 0.25), WAVES[4] + 0.08, pan=0.4, rev=0.7)
place(music, pad([50, 57, 62, 69], 1.6, 0.14, 700), 12.0)

# 13.2-17.4: a column per beat; taiko groove builds; choir-like pad climbs
for i in range(8):
    tc = T['lineup'] + i * T['columnStep']
    place(music, taiko(0.8, 0.9), tc)
    place(sfx, braam(0.55, 48, 2500, 0.35), tc, pan=-0.6 + i * 0.17, rev=0.3)
for b in range(int((T['finalHit'] - 0.3 - T['lineup']) / (BEAT / 2))):
    t0 = T['lineup'] + b * BEAT / 2
    if b % 2 == 1:
        place(music, taiko(0.3, 1.6), t0)
place(music, pad([50, 57, 62, 65, 69], 3.0, 0.22, 1200), T['lineup'])
place(music, pad([46, 53, 58, 62, 65], 3.2, 0.26, 1800), T['lineup'] + 3.0)
# 17.4-19.8: build to the final, silence on the last beat before the hit
place(sfx, riser(T['finalHit'] - 0.25 - 17.4, 150, 9000, 0.6), 17.4)

# 19.8: the final - massive hit, crash, epic chord with drums
place(music, braam(3.6, 33, 2600, 1.35), T['finalHit'], rev=0.4)
place(sfx, crash(3.2, 0.45), T['finalHit'], rev=0.3)
place(music, pad([45, 52, 57, 61, 64, 69], T['cta'] - T['finalHit'] + 0.8, 0.3, 2400), T['finalHit'] + 0.1, rev=0.3)
for b in range(int((T['cta'] - T['finalHit']) / BEAT)):
    place(music, taiko(0.7 if b % 2 == 0 else 0.45), T['finalHit'] + BEAT + b * BEAT)

# 23.4: the email notification; music steps back to a pulse
place(sfx, notify(0.55), T['cta'] + 0.15, rev=0.2)
for b in range(int((T['endCard'] - T['cta']) / BEAT)):
    place(music, taiko(0.35, 0.8), T['cta'] + b * BEAT)
place(music, pad([50, 57, 62, 65], T['endCard'] - T['cta'] + 0.5, 0.16, 800), T['cta'])

# 28.2: end card - last chord rings out to the end
place(music, braam(3.8, 38, 1200, 0.6), T['endCard'], rev=0.4)
place(music, pad([50, 57, 62, 66, 69], DUR - T['endCard'], 0.24, 1600), T['endCard'], rev=0.4)
place(sfx, whoosh(0.6, 0.3), T['endCard'] - 0.3)

# ------------------------------------------------------------------ voice-over (optional) + ducking
def clean_voice(x, sr):
    """Phone recording -> broadcast-ish voice: high-pass, spectral noise gate, presence lift, compression."""
    x = hp(x, 85)
    # spectral gate: estimate the noise floor from the quietest 10% of short frames
    nf, hop = 2048, 512
    win = np.hanning(nf)
    frames = [x[i:i + nf] * win for i in range(0, len(x) - nf, hop)]
    S = np.array([np.fft.rfft(f) for f in frames])
    mag = np.abs(S)
    energy = mag.sum(axis=1)
    noise_prof = np.median(mag[energy <= np.percentile(energy, 10)], axis=0)
    gain = np.clip((mag - 1.8 * noise_prof) / (mag + 1e-9), 0.08, 1.0)
    gain = np.apply_along_axis(lambda g: np.convolve(g, np.ones(5) / 5, 'same'), 0, gain)  # smooth over time
    S2 = S * gain
    y = np.zeros(len(x))
    norm = np.zeros(len(x))
    for k, i in enumerate(range(0, len(x) - nf, hop)):
        y[i:i + nf] += np.fft.irfft(S2[k], nf) * win
        norm[i:i + nf] += win ** 2
    y /= np.maximum(norm, 1e-6)
    y += bp(y, 2500, 6000) * 0.35          # presence
    y += lp(y, 180) * 0.25                 # a little body/warmth
    # gentle compression (RMS follower)
    envl = np.sqrt(np.abs(lp(y ** 2, 12)) + 1e-9)
    y = y * (np.clip(envl, 0.02, None) ** -0.45) * 0.12
    return y / (np.max(np.abs(y)) + 1e-9)


VO_GAIN = float(os.environ.get('VO_GAIN', '1.0'))
vo = np.zeros(N)
if len(sys.argv) > 2:
    sr, raw = wavfile.read(sys.argv[2])  # the single recorded take (mono wav)
    raw = raw.astype(np.float64)
    if raw.ndim > 1:
        raw = raw.mean(axis=1)
    if sr != SR:
        raw = np.interp(np.arange(int(len(raw) * SR / sr)) * sr / SR, np.arange(len(raw)), raw)
    clean = clean_voice(raw / (np.max(np.abs(raw)) + 1e-9), SR)
    for a, b, at in VO:
        i0, i1 = int((a - 0.08) * SR), int((b + 0.18) * SR)
        seg = clean[max(0, i0):i1].copy()
        fi, fo = int(0.02 * SR), int(0.08 * SR)
        seg[:fi] *= np.linspace(0, 1, fi)
        seg[-fo:] *= np.linspace(1, 0, fo)
        j0 = int((at - 0.08) * SR)
        vo[j0:j0 + len(seg)] += seg[: N - j0] * 0.95
    # a touch of the hall reverb on the voice
    vir = rng.standard_normal(int(0.9 * SR)) * np.exp(-np.arange(int(0.9 * SR)) / SR / 0.25)
    vir = lp(vir, 4500); vir /= np.sqrt((vir ** 2).sum())
    vo = vo + fftconvolve(vo, vir)[:N] * 0.12
# level-match: voice phrases at a fixed loudness relative to the music bed
if np.any(np.abs(vo) > 1e-3):
    vo *= 0.34 / np.sqrt(np.mean(vo[np.abs(vo) > 1e-3] ** 2))
duck = 1.0 - 0.7 * np.clip(np.abs(lp(np.abs(vo), 6)) * 8, 0, 1)

ir_t = tt(1.8)
ir = rng.standard_normal((len(ir_t), 2)) * np.exp(-ir_t / 0.5)[:, None]
ir[:, 0] = lp(ir[:, 0], 5000); ir[:, 1] = lp(ir[:, 1], 5000)
ir /= np.sqrt((ir ** 2).sum(axis=0))
wet = np.stack([fftconvolve(send[:, c], ir[:, c])[:N] for c in range(2)], axis=1) * 0.6
mix = (music * 0.8 + sfx * 0.85 + wet) * duck[:, None] + vo[:, None] * VO_GAIN
if os.environ.get('STEMS'):  # debug: write the voice and the music bed separately
    wavfile.write('build/stem_vo.wav', SR, (vo / (np.max(np.abs(vo)) + 1e-9) * 0.5 * 32767).astype(np.int16))
    bed = (music * 0.8 + sfx * 0.85 + wet) * duck[:, None]
    print('voice peak', round(float(np.max(np.abs(vo))), 3), 'bed peak', round(float(np.max(np.abs(bed))), 3),
          'voice rms in phrases', round(float(np.sqrt(np.mean(vo[np.abs(vo) > 1e-3] ** 2))), 3),
          'bed rms', round(float(np.sqrt(np.mean(bed ** 2))), 3))
mix *= np.clip((DUR - np.arange(N) / SR) / 1.2, 0, 1)[:, None]  # fade out at the very end
mix = np.tanh(mix / np.max(np.abs(mix)) * 1.4) / np.tanh(1.4)
mix *= 10 ** (-1 / 20) / np.max(np.abs(mix))
out = sys.argv[1] if len(sys.argv) > 1 else 'soundtrack.wav'
wavfile.write(out, SR, (mix * 32767).astype(np.int16))
print('wrote', out, f'{N / SR:.2f}s', 'with VO' if len(sys.argv) > 2 else 'without VO')
