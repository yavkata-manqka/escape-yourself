"""Soundtrack for the puzzle reel: 15 s, 128 BPM (32 beats), loops seamlessly.

Two identical loops are synthesised back to back and the second one is kept,
so reverb/decay tails from the end wrap into the start when the Reel loops.
A short bright blip marks each one-frame hidden digit (fair audio hint).

Usage: python3 -I scripts/audio.py out.wav
"""
import sys
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 48000
LOOP = 15.0
BEAT = 60 / 128
FPS = 30
N = int(SR * LOOP * 2)
rng = np.random.default_rng(1910)
bus = np.zeros((N, 2))
send = np.zeros((N, 2))


def tt(d):
    return np.arange(int(d * SR)) / SR


def place(sig, start, gain=1.0, pan=0.0, rev=0.0):
    for off in (0.0, LOOP):  # both loops
        i0 = int(round((start + off) * SR))
        if i0 >= N:
            continue
        s = sig[: N - i0] * gain
        l, r = np.sqrt(0.5 * (1 - pan)) * np.sqrt(2), np.sqrt(0.5 * (1 + pan)) * np.sqrt(2)
        bus[i0:i0 + len(s), 0] += s * l
        bus[i0:i0 + len(s), 1] += s * r
        if rev:
            send[i0:i0 + len(s), 0] += s * l * rev
            send[i0:i0 + len(s), 1] += s * r * rev


def lp(x, f): return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
def hp(x, f): return sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)
def bp(x, a, b): return sosfilt(butter(2, [a, b], 'band', fs=SR, output='sos'), x)
def noise(d): return rng.standard_normal(int(d * SR))
def env(t, d, a=0.002): return np.clip(t / a, 0, 1) * np.exp(-t / d)
def sine(f, t): return np.sin(2 * np.pi * np.cumsum(np.broadcast_to(f, t.shape)) / SR)
def saw(f, t): return 2 * ((np.cumsum(np.broadcast_to(f, t.shape)) / SR) % 1) - 1
def note(m): return 440 * 2 ** ((m - 69) / 12)


def kick():
    t = tt(0.4)
    return np.tanh(1.8 * sine(48 + 120 * np.exp(-t / 0.025), t) * env(t, 0.14))


def snare():
    t = tt(0.25)
    return bp(noise(0.25), 1200, 7000) * env(t, 0.06) * 0.8 + sine(190, t) * env(t, 0.04) * 0.5


def hat(o=False):
    d = 0.12 if o else 0.04
    t = tt(d)
    return hp(noise(d), 8000) * env(t, 0.05 if o else 0.012) * 0.45


def tick():
    t = tt(0.05)
    return (np.sin(2 * np.pi * 3100 * t) * np.exp(-t / 0.006) + bp(noise(0.05), 3000, 9000) * np.exp(-t / 0.003) * 0.5) * 0.35


def stab(chord, d=0.32):
    t = tt(d)
    s = sum(saw(note(m), t) + saw(note(m) * 1.004, t) for m in chord) / (2 * len(chord))
    s = lp(s, 2400) * env(t, 0.12, 0.004)
    return s


def bass(m, d):
    t = tt(d)
    s = lp(saw(note(m), t), 420) * 0.7 + sine(note(m), t) * 0.6
    a = np.clip(t / 0.005, 0, 1) * np.clip((d - t) / 0.03, 0, 1)
    return s * a * 0.6


def slam():  # paper/print stamp for each text line
    t = tt(0.3)
    thud = sine(70 + 90 * np.exp(-t / 0.02), t) * env(t, 0.07)
    paper = bp(noise(0.3), 600, 5000) * env(t, 0.03)
    return thud * 0.7 + paper * 0.6


def whoosh(d=0.25):
    t = tt(d)
    n = noise(d)
    out = np.zeros_like(n)
    blocks = 24
    for b in range(blocks):
        a, z = b * len(n) // blocks, (b + 1) * len(n) // blocks
        fc = 500 * (8000 / 500) ** (b / blocks)
        out[a:z] = bp(n[a:z], fc * 0.6, min(fc * 1.6, 20000))
    return out * np.sin(np.pi * t / d) ** 2 * 0.5


def blip():  # the hidden-digit cue
    t = tt(0.09)
    return (sine(2400, t) * 0.6 + sine(3600, t) * 0.3) * env(t, 0.025)


def wrong():
    t = tt(0.32)
    s = (saw(note(50), t) + saw(note(49), t)) * 0.3
    return lp(s, 1800) * env(t, 0.1)


# ------------------------------------------------------------------ groove (32 beats)
CHORDS = [[62, 65, 69, 72], [58, 62, 65, 69], [55, 58, 62, 65], [57, 61, 64, 67]]  # Dm7 Bbmaj7 Gm7 A7
ROOTS = [38, 34, 31, 33]
for b in range(32):
    t0 = b * BEAT
    bar = b // 4
    sect_break = 22 <= b < 24  # stop-time before the hint section
    if not sect_break:
        if b % 4 in (0, 2) or (b % 4 == 3 and b % 8 == 7):
            place(kick(), t0, 0.9)
        if b % 4 == 3 and b % 8 != 7:
            place(kick(), t0 + BEAT * 0.75, 0.6)
        if b % 2 == 1:
            place(snare(), t0, 0.55, rev=0.3)
        for s16 in range(4):
            if (b + s16) % 2 == 0 or s16 == 2:
                place(hat(o=(s16 == 2 and b % 2 == 0)), t0 + s16 * BEAT / 4 + (0.02 if s16 % 2 else 0), 0.35, pan=0.3)
    place(tick(), t0, 0.5, pan=-0.2)
    place(tick(), t0 + BEAT / 2, 0.3, pan=0.2)
    ch = (bar // 2) % 4
    if b % 2 == 0 and not sect_break:
        place(stab(CHORDS[ch]), t0 + BEAT * 0.5, 0.45, pan=-0.15, rev=0.4)
    if not sect_break:
        for e in range(2):
            place(bass(ROOTS[ch] + (12 if (b + e) % 3 == 2 else 0), BEAT * 0.45), t0 + e * BEAT / 2, 0.75)

# montage section build (frames 211-323): rising filtered noise
d = (323 - 211) / FPS
t = tt(d)
n = noise(d)
riser = np.zeros_like(n)
for blk in range(40):
    a, z = blk * len(n) // 40, (blk + 1) * len(n) // 40
    fc = 300 * (6000 / 300) ** (blk / 40)
    riser[a:z] = bp(n[a:z], fc * 0.7, fc * 1.3)
place(riser * (t / d) ** 2 * 0.35, 211 / FPS, pan=0.1, rev=0.2)

# ------------------------------------------------------------------ picture-synced hits
LINE_SLAMS = [1, 14, 28, 72, 86, 100, 141, 155, 169, 183, 324, 338, 352, 362, 379, 386, 393, 400, 421, 428]
for f in LINE_SLAMS:
    place(slam(), f / FPS, 0.75, rev=0.25)
for f in [72, 141, 211, 261, 291, 324, 379, 421]:
    place(whoosh(), f / FPS - 0.12, 0.5, pan=0.4)
for f in (0, 157, 236, 301):
    place(blip(), f / FPS, 0.55, rev=0.5)
place(wrong(), 267 / FPS, 0.5)
place(slam(), 273 / FPS, 0.7)

# ------------------------------------------------------------------ mix: keep the second loop
ir_t = tt(1.2)
ir = rng.standard_normal((len(ir_t), 2)) * np.exp(-ir_t / 0.3)[:, None]
ir /= np.sqrt((ir ** 2).sum(axis=0))
wet = np.stack([fftconvolve(send[:, c], ir[:, c])[:N] for c in range(2)], axis=1) * 0.35
mix = bus + wet
mix = mix[int(LOOP * SR):]
mix = np.tanh(mix / np.max(np.abs(mix)) * 1.5) / np.tanh(1.5)
mix *= 10 ** (-1 / 20) / np.max(np.abs(mix))
out = sys.argv[1] if len(sys.argv) > 1 else 'soundtrack.wav'
wavfile.write(out, SR, (mix * 32767).astype(np.int16))
print('wrote', out, f'{len(mix) / SR:.3f}s')
