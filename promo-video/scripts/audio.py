"""Synthesise the full 30 s soundtrack at exactly 120 BPM (one beat = 0.5 s).

Everything is generated in code (numpy/scipy) with a fixed random seed:
menu groove (0-8 s), dark gameplay bed (8-20.5 s), slow motion (20.5-23 s),
silence + menu hum (23-30 s), plus every sound effect synced to the picture.

Usage: python3 -I scripts/audio.py out.wav
"""
import sys
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 48000
DUR = 30.0
N = int(SR * DUR)
BEAT = 0.5
rng = np.random.default_rng(2026)

buses = {k: np.zeros((N, 2)) for k in ("music", "sfx", "hits", "body", "pause")}


# ------------------------------------------------------------------ helpers
def tt(d):
    return np.arange(int(d * SR)) / SR


def place(bus, sig, start, gain=1.0, pan=0.0):
    i0 = int(round(start * SR))
    if sig.ndim == 1:
        l = np.sqrt(0.5 * (1 - pan)); r = np.sqrt(0.5 * (1 + pan))
        sig = np.stack([sig * l, sig * r], axis=1) * np.sqrt(2)
    i1 = min(N, i0 + len(sig))
    if i1 <= i0 or i0 >= N:
        return
    s0 = max(0, -i0)
    buses[bus][max(0, i0):i1] += sig[s0:i1 - i0] * gain


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)


def noise(d):
    return rng.standard_normal(int(d * SR))


def saw(freq, t):
    ph = np.cumsum(np.broadcast_to(freq, t.shape) / SR)
    return 2 * (ph % 1.0) - 1


def sine(freq, t):
    ph = np.cumsum(np.broadcast_to(freq, t.shape) / SR)
    return np.sin(2 * np.pi * ph)


def square(freq, t):
    return np.sign(sine(freq, t))


def env_exp(t, decay, attack=0.002):
    a = np.clip(t / attack, 0, 1)
    return a * np.exp(-t / decay)


def sweep_filter(x, f0, f1, kind="low", block=512, q_band=0.6):
    """Time-varying filter (block-wise) with cutoff sliding exponentially from f0 to f1."""
    out = np.zeros_like(x)
    nb = int(np.ceil(len(x) / block))
    zi = None
    for b in range(nb):
        k = b / max(1, nb - 1)
        f = f0 * (f1 / f0) ** k
        if kind == "low":
            sos = butter(2, min(f, SR / 2 - 100), btype="low", fs=SR, output="sos")
        else:
            lo, hi = f * (1 - q_band / 2), f * (1 + q_band / 2)
            sos = butter(2, [max(20, lo), min(hi, SR / 2 - 100)], btype="band", fs=SR, output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        seg = x[b * block:(b + 1) * block]
        y, zi = sosfilt(sos, seg, zi=zi)
        out[b * block:(b + 1) * block] = y
    return out


def fade(sig, fin=0.003, fout=0.01):
    n = len(sig)
    a = np.ones(n)
    i = int(fin * SR); o = int(fout * SR)
    if i: a[:i] = np.linspace(0, 1, i)
    if o: a[-o:] *= np.linspace(1, 0, o)
    return sig * a


def note(n):  # MIDI -> Hz
    return 440.0 * 2 ** ((n - 69) / 12)


# ------------------------------------------------------------------ instruments
def kick(gain=1.0):
    t = tt(0.45)
    f = 45 + 110 * np.exp(-t / 0.03)
    s = sine(f, t) * env_exp(t, 0.16) + 0.25 * np.exp(-t / 0.004) * noise(0.45)[: len(t)]
    return np.tanh(1.6 * s) * gain


def clap():
    t = tt(0.25)
    n = bp(noise(0.25), 900, 5000)
    e = np.zeros_like(t)
    for d in (0, 0.012, 0.024):
        e += np.where(t >= d, np.exp(-(t - d) / 0.012), 0) * 0.5
    e += np.where(t >= 0.03, np.exp(-(t - 0.03) / 0.09), 0)
    return n * e * 0.8


def hat(open_=False):
    d = 0.18 if open_ else 0.05
    t = tt(d)
    return hp(noise(d), 7000) * env_exp(t, 0.06 if open_ else 0.015) * 0.5


def pluck(freq, d=0.22):
    t = tt(d)
    s = saw(freq, t) * 0.6 + saw(freq * 1.007, t) * 0.4
    s = sweep_filter(s, 5000, 600, "low", block=256)
    return s * env_exp(t, 0.09) * 0.5


def bass_note(freq, d=0.22):
    t = tt(d)
    s = saw(freq, t)
    s = lp(s, 380) + 0.6 * sine(freq, t)
    return fade(s * env_exp(t, 0.12, 0.004), 0.002, 0.03) * 0.7


def blip(f0, f1, d=0.06, gain=0.5):
    t = tt(d)
    f = f0 * (f1 / f0) ** (t / d)
    return fade(sine(f, t) * env_exp(t, d / 2.5), 0.001, 0.01) * gain


def click(gain=0.6, bright=4000):
    t = tt(0.03)
    return bp(noise(0.03), bright * 0.6, min(bright * 2.2, 20000)) * env_exp(t, 0.004) * gain


def chime(freqs, d=1.2, gain=0.35):
    t = tt(d)
    s = np.zeros_like(t)
    for i, f in enumerate(freqs):
        for p, a in ((1, 1), (2.76, 0.35), (5.4, 0.12)):
            s += a * np.sin(2 * np.pi * f * p * t) * np.exp(-t / (0.5 / (1 + 0.6 * i * 0 + p * 0.4)))
    return fade(s * gain / len(freqs), 0.002, 0.05)


def whoosh(d=0.45, f0=300, f1=4000, gain=0.6):
    t = tt(d)
    s = sweep_filter(noise(d), f0, f1, "band", q_band=1.0)
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    return s * e * gain


def braam(d=1.6, root=55.0, gain=1.0, bright=1500):
    t = tt(d)
    s = np.zeros_like(t)
    for f, a in ((root, 1.0), (root * 1.006, 0.8), (root * 1.4983, 0.6), (root * 2 * 0.997, 0.5), (root * 2.9966, 0.25)):
        s += a * saw(f, t)
    s /= 3.0
    s = sweep_filter(s, bright, 180, "low", block=256)
    s = np.tanh(2.2 * s)
    boom_f = 62 * np.exp(-t / 0.5) + 30
    boom = sine(boom_f, t) * env_exp(t, 0.45, 0.004)
    e = np.clip(t / 0.015, 0, 1) * (0.35 + 0.65 * np.exp(-t / 0.5))
    out = s * e * 0.9 + boom * 0.9
    out += hp(noise(d), 2000) * env_exp(t, 0.03) * 0.25  # transient
    return fade(out, 0.001, 0.08) * gain


def heartbeat_thump(gain=1.0):
    t = tt(0.5)
    def thump(delay, a):
        tt_ = np.clip(t - delay, 0, None)
        f = 38 + 30 * np.exp(-tt_ / 0.03)
        return np.where(t >= delay, sine(f, t) * np.exp(-tt_ / 0.07) * a, 0)
    s = thump(0, 1.0) + thump(0.17, 0.7)
    s += lp(noise(0.5), 160) * (np.exp(-t / 0.05) + 0.6 * np.where(t > 0.17, np.exp(-(t - 0.17) / 0.05), 0)) * 0.6
    return np.tanh(1.5 * s) * gain


def breath(d_in, d_out, gain=0.25, tone=1.0):
    d = d_in + d_out
    t = tt(d)
    n = noise(d)
    s = bp(n, 400 * tone, 2400 * tone) * 0.7 + bp(n, 1100 * tone, 1500 * tone, 2) * 0.6
    e_in = np.sin(np.pi / 2 * np.clip(t / d_in, 0, 1)) ** 1.5
    e_out = np.clip(np.cos(np.pi / 2 * np.clip((t - d_in) / d_out, 0, 1)), 0, 1) ** 1.2
    e = np.where(t < d_in, e_in, e_out)
    # exhale is a bit louder and lower
    s_out = bp(n, 250 * tone, 1600 * tone)
    sig = np.where(t < d_in, s * 0.75, s_out * 1.1) * e
    return fade(sig, 0.01, 0.02) * gain


def footstep(gain=0.6, heavy=1.0):
    t = tt(0.25)
    body = sine(110 + 40 * np.exp(-t / 0.02), t) * env_exp(t, 0.05)
    n = lp(noise(0.25), 900) * env_exp(t, 0.03)
    creak = bp(noise(0.25), 1800, 3000) * env_exp(t, 0.02) * 0.2
    return (body * 0.7 * heavy + n * 0.8 + creak) * gain


def metal_clank(gain=0.5, base=1.0):
    t = tt(0.35)
    s = np.zeros_like(t)
    for f, a, dcy in ((1870, 1, 0.12), (3020, 0.7, 0.08), (4410, 0.5, 0.05), (690, 0.6, 0.1)):
        s += a * np.sin(2 * np.pi * f * base * t) * np.exp(-t / dcy)
    s += bp(noise(0.35), 2000, 8000) * env_exp(t, 0.01) * 1.2
    return s * gain * 0.4


def buzzer(d=0.48, gain=0.6):
    t = tt(d)
    s = square(118, t) * 0.6 + square(177, t) * 0.4 + saw(236, t) * 0.3
    s = bp(s, 150, 3500)
    gate = ((t % 0.16) < 0.13).astype(float)
    return fade(np.tanh(2.5 * s) * gate * gain, 0.002, 0.03)


def elec_buzz(d, gain=0.25, seed=0):
    t = tt(d)
    s = saw(100, t) * 0.5 + saw(200, t) * 0.3 + square(50, t) * 0.2
    s = bp(s, 80, 2500)
    r = np.random.default_rng(seed)
    frames = int(np.ceil(d * 30))
    g = r.random(frames) < 0.55
    gate = np.repeat(g.astype(float), int(SR / 30) + 1)[: len(t)]
    gate = lp(gate, 200)
    return s * gate * gain


def tick(hi=True, gain=0.4):
    t = tt(0.06)
    f = 2400 if hi else 1800
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.008) + bp(noise(0.06), 2500, 7000) * np.exp(-t / 0.004) * 0.6
    return s * gain


# ------------------------------------------------------------------ 0-8 s: menus
# boot: power-on sweep, glitch noise, logo hit at 0.5
t = tt(0.5)
place("sfx", fade(sine(80 * (800 / 80) ** (t / 0.5), t) * 0.25 * np.clip(t / 0.4, 0, 1), 0.01, 0.02), 0.0)
for k in range(8):
    if rng.random() < 0.7:
        place("sfx", bp(noise(0.03), 1500, 9000) * 0.25, 0.12 + k * 0.06)
place("hits", kick(1.0), 0.5)
place("sfx", chime([note(81), note(88)], 0.8, 0.25), 0.5)
place("sfx", whoosh(0.35, 2000, 300, 0.25), 0.15)

# groove from 0.5 s: kick on every beat, clap on 2 and 4, hats on 8ths, plucks + bass
arp = [69, 72, 76, 81, 79, 76, 72, 76]
arp2 = [67, 71, 74, 79, 77, 74, 71, 74]
for i in range(int(0.5 / 0.25), int(8.0 / 0.25)):
    ts = i * 0.25
    beat = ts / BEAT
    if ts >= 7.75:
        break  # near-silence before the gameplay hit
    if ts >= 7.1 and ts < 7.75:
        continue  # the zoom-in: only the riser
    if abs(beat - round(beat)) < 1e-6:
        place("music", kick(0.9), ts)
        if int(round(beat)) % 2 == 1 and ts >= 2.0:
            place("music", clap(), ts, 0.55)
    if ts >= 1.0:
        place("music", hat(open_=(i % 4 == 2)), ts, 0.35, pan=0.3)
    if ts >= 2.0:
        bar = int(ts // 2.0)
        seq = arp if bar % 2 == 0 else arp2
        place("music", pluck(note(seq[i % 8])), ts, 0.33, pan=-0.25 if i % 2 else 0.25)
        if i % 2 == 1:
            place("music", bass_note(note(45 if bar % 2 == 0 else 43)), ts, 0.55)

# menu SFX
place("sfx", click(0.5, 3000), 1.75); place("sfx", chime([note(84), note(91)], 0.6, 0.3), 1.75)
place("sfx", whoosh(0.3, 400, 5000, 0.35), 1.85)
place("hits", kick(0.8), 2.0)
for i, ts in enumerate([2.5, 3.0, 3.5, 4.0]):
    place("sfx", click(0.4, 3500), ts)
    place("sfx", blip(note(76 + i * 3), note(88 + i * 3), 0.08, 0.3), ts)
place("sfx", chime([note(81), note(85), note(88)], 0.9, 0.35), 4.5)
place("hits", kick(0.8), 4.5)
place("sfx", whoosh(0.3, 400, 5000, 0.35), 4.85)
for i in range(5):
    place("sfx", blip(note(72 + i * 2), note(84 + i * 2), 0.07, 0.28), 5.5 + i * 0.25)
place("sfx", click(0.6, 2500), 6.98)
place("sfx", chime([note(88), note(93)], 0.6, 0.35), 7.0)
# zoom-in riser into the cut
t = tt(0.7)
r = sweep_filter(noise(0.7), 300, 6000, "band", q_band=0.8) * (t / 0.7) ** 2 * 0.6
r += saw(110 * (440 / 110) ** (t / 0.7), t) * 0.12 * (t / 0.7) ** 2
place("sfx", fade(r, 0.01, 0.02), 7.1)

# ------------------------------------------------------------------ 8-20 s: gameplay
# 8.0 BRAAM "НИВО 1" + door creak
HITS = [8.0, 9.5, 11.0, 13.5, 15.0, 16.0, 17.0, 18.0]
for i, h in enumerate(HITS):
    nxt = HITS[i + 1] if i + 1 < len(HITS) else 20.5
    d = min(1.8, nxt - h + 0.05)
    if h == 13.5:
        d = 1.0
    place("hits", braam(d, 55.0 if h != 13.5 else 49.0, 1.0, 1800 if h >= 15.0 else 1400), h)

# door creak 8.0-8.55
t = tt(0.55)
f = 380 + 160 * np.sin(2 * np.pi * 1.3 * t) + 40 * rng.standard_normal(len(t)).cumsum() / np.sqrt(len(t))
stick = (np.sin(2 * np.pi * (28 + 12 * t) * t) > 0.2).astype(float)
creak = bp(saw(f, t) * stick, 250, 2600) * np.sin(np.pi * t / 0.55) * 0.5
place("sfx", creak, 8.0, 0.8, pan=-0.2)
# flashlight click + flicker buzz
place("sfx", click(0.9, 2500), 8.5); place("sfx", click(0.5, 3500), 8.53)
place("sfx", elec_buzz(0.1, 0.15, 3), 8.53)

# dark bed: pulsing sub bass on 8ths + drone (8-20.5)
t = tt(12.5)
sub = sine(55, t) * 0.8 + lp(saw(55, t), 220) * 0.5
pulse = 0.35 + 0.65 * np.exp(-((t % 0.25) / 0.09))
drone = lp(saw(55, t) + saw(55.4, t) + 0.6 * saw(82.6, t), 260) * 0.25
swell = np.clip(t / 1.5, 0, 1) * (0.7 + 0.3 * np.clip((t - 7.5) / 4.5, 0, 1))
place("music", (sub * pulse * 0.55 + drone) * swell, 8.0, 0.85)

# ticking clock, speeding up: 8ths -> 16ths -> 32nds
ts = 8.5
k = 0
while ts < 20.5:
    step = 0.5 if ts < 12.0 else 0.25 if ts < 15.0 else 0.125
    place("music", tick(k % 2 == 0, 0.32 + 0.12 * (ts >= 15.0)), ts, 1.0, pan=0.15 if k % 2 else -0.15)
    ts += step; k += 1

# heartbeat (quiet at 8 s, faster + louder until 20 s) and breathing
hb_times = [8.0 + i * 1.0 for i in range(3)] + [11.0 + i * 0.5 for i in range(19)]
for h in hb_times:
    g = 0.25 + 0.55 * np.clip((h - 8) / 12.5, 0, 1)
    place("body", heartbeat_thump(g), h)
br = 8.1
while br < 20.2:
    cyc = 1.2 if br < 12 else 0.8 if br < 15.0 else 0.5
    place("body", breath(cyc * 0.42, cyc * 0.5, 0.12 + 0.12 * (br > 15.0)), br, 1.0, pan=0.05)
    br += cyc

# footsteps on wood (walk in), pendant flicker buzz, whooshes
for s_ in (9.08, 9.52, 9.95):
    place("sfx", footstep(0.75), s_)
place("sfx", elec_buzz(0.33, 0.22, 9), 9.5)
place("sfx", whoosh(0.5, 300, 5000, 0.55), 9.98, pan=-0.4)
place("sfx", whoosh(0.18, 2000, 500, 0.4), 10.5)
place("hits", kick(0.6), 10.5)
place("sfx", elec_buzz(0.3, 0.2, 21), 10.7)
place("sfx", click(0.5, 3000), 10.95)
# 11.5 painting; 12.0 UV torch switch + hum + reveal shimmer
place("sfx", click(0.5, 3000), 11.96)
t = tt(0.5)
place("sfx", bp(saw(60, t) + saw(120.5, t), 60, 900) * 0.12 * np.clip(t / 0.05, 0, 1), 12.0)
place("sfx", chime([note(88), note(95), note(100)], 0.6, 0.18), 12.08)
# 12.5 smash zoom on the chest
place("sfx", whoosh(0.16, 3000, 400, 0.55), 12.42)
place("hits", kick(0.9), 12.5)
place("sfx", click(0.5, 3000), 12.96)
# 13.0 dials roll (ratchet clicks), 13.5 rattle + buzzer
for d_ in range(4):
    for c in range(6):
        place("sfx", click(0.35, 5000), 13.02 + d_ * 0.07 + c * 0.045, 1.0, pan=-0.2 + d_ * 0.13)
for i, c in enumerate([13.5, 13.55, 13.61, 13.69, 13.78]):
    place("sfx", metal_clank(0.7 - i * 0.1, 1 + 0.05 * i), c)
place("sfx", buzzer(0.48, 0.55), 13.5)
# 14.0 dial 2->1, 14.38 unlock clunk, 14.6 key chime, 14.93 slot pop
for c in range(4):
    place("sfx", click(0.45, 5000), 14.04 + c * 0.04)
t = tt(0.35)
clunk = sine(90 * np.exp(-t / 0.1) + 50, t) * env_exp(t, 0.08) + metal_clank(0.6, 0.7)[: len(t)]
place("sfx", clunk, 14.38, 1.0)
place("hits", kick(0.6), 14.38)
place("sfx", chime([note(91), note(95), note(98), note(103)], 1.0, 0.5), 14.6)
for i in range(6):
    place("sfx", blip(note(96 + i * 2), note(100 + i * 2), 0.05, 0.12), 14.62 + i * 0.04, pan=(i % 2) * 0.6 - 0.3)
place("sfx", blip(500, 1300, 0.07, 0.45), 14.93)
# 15.0 the lights die: a power-down "thunk" and the alarm siren takes over (no silence)
t = tt(0.3)
place("sfx", sine(120 * np.exp(-t / 0.08) + 30, t) * env_exp(t, 0.12) * 0.8, 15.0)
place("sfx", elec_buzz(0.12, 0.25, 15), 14.97)
t = tt(5.5)
sir_f = 760 + 220 * np.sin(2 * np.pi * 0.9 * t - np.pi / 2)
siren = bp(saw(sir_f, t) * 0.5 + square(sir_f * 0.5, t) * 0.3, 300, 3000)
siren *= (0.6 + 0.4 * np.clip(t / 0.2, 0, 1)) * 0.16
place("music", fade(siren, 0.005, 0.03), 15.0, pan=0.1)
# rising riser from 15.0, climbing until the slow motion
t = tt(5.5)
k_ = t / 5.5
riser = sweep_filter(noise(5.5), 300, 7000, "band", q_band=0.5) * 0.35 + saw(110 * (880 / 110) ** k_, t) * 0.08 + saw(110.7 * (880 / 110) ** k_, t) * 0.08
riser *= (0.15 + 0.85 * k_ ** 2)
place("music", fade(riser, 0.01, 0.02), 15.0)
# 16.0 whip + running steps
place("sfx", whoosh(0.45, 300, 6000, 0.6), 15.98, pan=0.5)
for i in range(10):
    place("sfx", footstep(0.65 - 0.03 * max(0, i - 6), 1.2), 16.02 + i * 0.155)
# keypad presses: click + beep
for kp in (19.06, 19.56, 20.06):
    place("sfx", click(0.8, 2500), kp)
    t = tt(0.12)
    place("sfx", fade(sine(1450, t) * 0.35 + square(1450, t) * 0.05, 0.002, 0.02), kp + 0.01)
    place("hits", kick(0.55), kp)

# ------------------------------------------------------------------ 20.5-23 s: slow motion
# One continuous gesture, nothing repeats: a pitch-down "time stretch", a low drone that
# slowly rises, two heartbeats that drift apart, one held breath.
t = tt(0.9)
down = whoosh(0.9, 3000, 120, 0.45) + sine(80 * np.exp(-t / 0.4) + 28, t) * env_exp(t, 0.5) * 0.9
place("hits", down, 20.5)
t = tt(2.5)
k_ = t / 2.5
f0 = 41.2 * (1 + 0.06 * k_ ** 2)
low = sweep_filter(saw(f0, t) + saw(f0 * 1.007, t) + sine(55 * (1 + 0.06 * k_ ** 2), t) * 1.5, 160, 420, "low") * 0.35
low *= np.clip(t / 0.3, 0, 1) * (0.7 + 0.5 * k_)
place("music", fade(low, 0.01, 0.01), 20.5)
place("hits", braam(2.5, 41.2, 0.5, 600), 20.5)
place("body", heartbeat_thump(0.95), 20.6)
place("body", heartbeat_thump(0.75), 22.0)
place("body", breath(1.6, 0.8, 0.2, 0.85), 20.55)

# ------------------------------------------------------------------ 23-30 s: pause
place("pause", whoosh(0.5, 2500, 300, 0.25), 23.22)
t = tt(6.7)
hum = (sine(55, t) * 0.6 + sine(110, t) * 0.25 + lp(saw(55, t), 300) * 0.15) * 0.12
hum *= np.clip(t / 0.6, 0, 1) * np.clip((6.7 - t) / 1.0, 0, 1) ** 0.5
place("pause", hum, 23.3)
place("pause", blip(900, 1400, 0.05, 0.12), 25.0)

# ------------------------------------------------------------------ mix
tax = np.arange(N) / SR
# near-silence right before the big hits (music + sfx ducked)
duck = np.ones(N)
for h in [11.0, 13.5, 15.0, 20.5]:
    m = (tax >= h - 0.14) & (tax < h)
    duck[m] = np.minimum(duck[m], 0.12)
duck = lp(duck, 40)
for b in ("music", "sfx", "body"):
    buses[b] *= duck[:, None]

# reverb send (synthetic room)
ir_t = tt(1.4)
ir = rng.standard_normal((len(ir_t), 2)) * np.exp(-ir_t / 0.35)[:, None]
ir[:, 0] = lp(ir[:, 0], 6000); ir[:, 1] = lp(ir[:, 1], 6000)
ir /= np.sqrt((ir ** 2).sum(axis=0))
send = buses["sfx"] * 0.35 + buses["hits"] * 0.25 + buses["music"] * 0.1
wet = np.stack([fftconvolve(send[:, c], ir[:, c])[:N] for c in range(2)], axis=1) * 0.5

mix = buses["music"] * 0.75 + buses["sfx"] * 0.9 + buses["hits"] * 1.0 + buses["body"] * 0.9 + wet
# hard silence at the pause cut
for a, b in ((23.0, 30.0),):
    m = (tax >= a) & (tax < b)
    mix[m] = 0
    # 4 ms edges so the cut does not click
    i0 = int(a * SR)
    r = int(0.004 * SR)
    mix[i0 - r:i0] *= np.linspace(1, 0, r)[:, None]
mix += buses["pause"]
# glue: gentle bus compression via soft clip, then normalise to -1 dBFS peak
peak = np.max(np.abs(mix))
mix = mix / peak * 1.6
mix = np.tanh(mix) / np.tanh(1.6)
mix *= 10 ** (-1.0 / 20) / np.max(np.abs(mix))
out = sys.argv[1] if len(sys.argv) > 1 else "soundtrack.wav"
wavfile.write(out, SR, (mix * 32767).astype(np.int16))
rms = np.sqrt(np.mean(mix ** 2))
print(f"wrote {out}: peak -1.0 dBFS, rms {20 * np.log10(rms):.1f} dBFS")
