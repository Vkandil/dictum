"""Builds public/mix.wav: voice-over + synthesized SFX + a minimal electronic bed.

Everything is synthesized here (no third-party samples), so the soundtrack is
free to publish. Cue times match src/timeline.ts.

usage: python mix.py <vo.mp3 or wav decoded to 48k> <out.wav> [--no-music]
"""
import sys
import numpy as np
import soundfile as sf
from scipy import signal

SR = 48000
DUR = 41.8
N = int(SR * DUR)
rng = np.random.default_rng(7)


def t_axis(sec):
    return np.arange(int(sec * SR)) / SR


def env_exp(sec, decay):
    return np.exp(-t_axis(sec) / decay)


def place(buf, x, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(x))
    buf[i:j] += x[: j - i] * gain


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="high", fs=SR, output="sos"), x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="low", fs=SR, output="sos"), x)


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) or 1
    return x / m * peak


# ---------- SFX ----------
def whoosh(sec=0.42, lo=300, hi=5000, up=True):
    n = int(sec * SR)
    noise = rng.normal(0, 1, n)
    out = np.zeros(n)
    blocks = 24
    for b in range(blocks):
        k = b / (blocks - 1)
        f = lo * (hi / lo) ** (k if up else 1 - k)
        seg = bp(noise, max(40, f * 0.6), min(SR / 2 - 100, f * 1.6))
        w = np.exp(-((np.arange(n) / n - k) ** 2) / 0.012)
        out += seg * w
    shape = np.sin(np.linspace(0, np.pi, n)) ** 1.5
    return norm(out * shape)


def impact(sec=0.9, f0=110, f1=38, body=0.22, noise=0.5):
    t = t_axis(sec)
    f = f1 + (f0 - f1) * np.exp(-t / 0.06)
    ph = 2 * np.pi * np.cumsum(f) / SR
    sub = np.sin(ph) * np.exp(-t / body)
    n = lp(rng.normal(0, 1, len(t)), 2500) * np.exp(-t / 0.05) * noise
    return norm(np.tanh((sub + n) * 1.6))


def click(sec=0.06, f=2400, decay=0.008):
    t = t_axis(sec)
    x = bp(rng.normal(0, 1, len(t)), f * 0.5, min(f * 2, 20000)) * np.exp(-t / decay)
    return norm(x)


def clack(sec=0.12):
    t = t_axis(sec)
    x = bp(rng.normal(0, 1, len(t)), 900, 5200) * np.exp(-t / 0.018)
    x += np.sin(2 * np.pi * 320 * t) * np.exp(-t / 0.025) * 0.6
    return norm(x)


def pop(sec=0.16, f0=900, f1=300):
    t = t_axis(sec)
    f = f1 + (f0 - f1) * np.exp(-t / 0.03)
    return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.05))


def ding(freqs=(1318.5, 1975.5), sec=1.0):
    t = t_axis(sec)
    x = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / (0.35 / (i + 1))) for i, f in enumerate(freqs))
    x *= 1 - np.exp(-t / 0.002)
    return norm(x)


def buzz(sec=0.22):
    t = t_axis(sec)
    x = signal.sawtooth(2 * np.pi * 110 * t) * np.exp(-t / 0.08)
    return norm(lp(x, 1400))


def riser(sec=1.0):
    n = int(sec * SR)
    noise = rng.normal(0, 1, n)
    out = np.zeros(n)
    for b in range(20):
        k = b / 19
        f = 400 * (8000 / 400) ** k
        seg = bp(noise, f * 0.7, min(f * 1.4, 23000))
        out += seg * np.exp(-((np.arange(n) / n - k) ** 2) / 0.01)
    return norm(out * np.linspace(0, 1, n) ** 2)


def sparkle(sec=0.7):
    t = t_axis(sec)
    x = np.zeros(len(t))
    for i in range(10):
        f = 2000 + rng.random() * 4000
        d = rng.random() * 0.35
        g = np.where(t > d, np.exp(-(t - d) / 0.06), 0)
        x += np.sin(2 * np.pi * f * t) * g
    return norm(x)


def tick(sec=0.03):
    return click(sec, 5000, 0.004)


sfx = np.zeros(N)
W = lambda at, g=0.35, **k: place(sfx, whoosh(**k), at - 0.2, g)

place(sfx, impact(1.2, 90, 32, 0.35), 0.0, 0.55)
place(sfx, click(0.05, 3500), 0.7, 0.25)
W(1.62, 0.28)
for i in range(5):
    place(sfx, pop(0.14, 700 + i * 60, 260), 1.72 + i * 0.11, 0.22)
for i in range(6):
    for k in range(4):
        place(sfx, tick(), 3.96 + i * 0.1 + k * 0.07, 0.25)
place(sfx, impact(1.4, 140, 36, 0.4, 0.9), 4.78, 0.85)
W(5.42, 0.32)
ticks = np.cumsum(np.linspace(0.05, 0.14, 12)) + 5.66
for x in ticks:
    if x < 6.75:
        place(sfx, tick(), x, 0.3)
place(sfx, pop(0.25, 600, 120), 6.72, 0.35)
W(7.98, 0.3)
place(sfx, riser(0.5), 7.95, 0.18)
place(sfx, sparkle(0.6), 8.3, 0.18)
place(sfx, impact(1.2, 120, 40, 0.3, 0.6), 8.48, 0.6)
W(9.15, 0.3)
for i in range(3):
    place(sfx, clack(), 9.2 + i * 0.07, 0.35)
place(sfx, clack(), 9.64, 0.6)
place(sfx, impact(0.35, 200, 90, 0.05, 0.2), 9.64, 0.25)
place(sfx, pop(0.2, 500, 900), 10.38, 0.3)
place(sfx, impact(1.4, 150, 34, 0.42, 0.9), 11.02, 0.85)
for at in (11.66, 12.74, 13.3):
    place(sfx, click(0.08, 1800, 0.012), at, 0.35)
    place(sfx, ding((2637, 3951), 0.4), at + 0.02, 0.05)
W(12.66, 0.3, sec=0.3)
W(13.22, 0.3, sec=0.3)
W(14.08, 0.35)
place(sfx, impact(1.0, 130, 40, 0.28, 0.6), 14.52, 0.6)
for x in np.linspace(14.35, 15.55, 18):
    place(sfx, tick(), x, 0.12)
for i in range(10):
    place(sfx, tick(), 16.42 + i * 0.015, 0.15)
for i in range(10):
    place(sfx, clack(), 16.95 + rng.random() * 0.45, 0.3)
place(sfx, whoosh(0.25, 800, 6000), 17.4, 0.3)
W(17.98, 0.3)
place(sfx, pop(0.12, 1200, 700), 18.24, 0.2)
place(sfx, pop(0.12, 1200, 700), 19.04, 0.2)
place(sfx, sparkle(0.5), 19.84, 0.25)
place(sfx, impact(0.5, 300, 80, 0.06, 0.8), 19.84, 0.35)
place(sfx, buzz(), 20.48, 0.12)
place(sfx, ding((1318.5, 1975.5, 2637)), 21.28, 0.22)
W(21.9, 0.3)
place(sfx, pop(0.18, 900, 400), 22.2, 0.3)
W(26.32, 0.3)
place(sfx, pop(0.2, 600, 250), 26.42, 0.3)
W(27.02, 0.25, up=True)
for at in (27.49, 27.99, 28.97):
    place(sfx, click(0.05, 2600, 0.006), at, 0.5)
W(28.33, 0.3, sec=0.3)
place(sfx, whoosh(0.2, 1500, 7000), 28.56, 0.2)
place(sfx, ding((1568, 2349, 3136)), 29.12, 0.24)
place(sfx, sparkle(0.6), 29.14, 0.18)
W(29.5, 0.3)
place(sfx, impact(1.0, 130, 40, 0.28, 0.6), 29.55, 0.55)
W(30.72, 0.3)
place(sfx, click(0.06, 1400, 0.01), 31.0, 0.45)
W(31.95, 0.3)
place(sfx, pop(0.2, 600, 250), 32.08, 0.3)
place(sfx, whoosh(0.28, 700, 5000), 32.42, 0.3)
W(33.1, 0.3)
place(sfx, impact(0.6, 160, 60, 0.12, 0.5), 34.6, 0.45)
place(sfx, riser(0.4), 35.0, 0.18)
place(sfx, impact(1.6, 120, 34, 0.45, 0.7), 35.48, 0.7)
for at in (36.0, 36.64, 36.96):
    place(sfx, pop(0.16, 800, 350), at - 0.05, 0.28)
W(37.72, 0.3, up=True)
place(sfx, click(0.05, 2600, 0.006), 38.36, 0.55)
place(sfx, sparkle(0.8), 38.37, 0.3)
place(sfx, ding((1760, 2637)), 38.38, 0.12)
place(sfx, impact(2.4, 110, 30, 0.7, 0.6), 40.08, 0.75)

# Live mode: a soft keystroke tick for every character as it appears.
live = [("your", 23.2, 23.44), ("words", 23.44, 24.16), ("appear", 24.16, 25.12), ("as", 25.12, 25.44), ("you", 25.44, 25.68), ("speak.", 25.68, 26.13)]
for w, a, b in live:
    dur = min(b - a, 0.38)
    for k in range(len(w)):
        place(sfx, click(0.03, 3000 + rng.random() * 1500, 0.004), a + dur * k / len(w), 0.12)


# ---------- MUSIC ----------
def music():
    m = np.zeros(N)
    bpm = 120
    beat = 60 / bpm
    drop = 8.48
    end = 39.98
    # chord roots per 2 bars (4 s): Am F C G
    prog = [(55.0, [220.0, 261.63, 329.63]), (43.65, [174.61, 220.0, 261.63]), (65.41, [196.0, 261.63, 329.63]), (49.0, [196.0, 246.94, 293.66])]

    def chord_at(sec):
        k = int(max(0, sec - drop) // (beat * 8)) % 4
        return prog[k]

    # pad (whole film), detuned saws, filter opens toward the drop
    t = np.arange(N) / SR
    pad = np.zeros(N)
    seg = int(beat * 8 * SR)
    starts = list(range(int(drop * SR) - 2 * seg, N, seg))
    for s in starts:
        s0 = max(0, s)
        e = min(N, s + seg)
        if e <= s0:
            continue
        root, notes = chord_at((s + seg / 2) / SR)
        tt = t[s0:e]
        x = sum(signal.sawtooth(2 * np.pi * f * d * tt) for f in notes for d in (0.997, 1.003))
        fade = np.minimum(1, np.minimum((tt - s / SR) / 0.05, (e / SR - tt) / 0.05))
        pad[s0:e] += x * fade
    cutoff = np.where(t < drop, 300 + 1500 * np.clip(t / drop, 0, 1) ** 2, 1400)
    # time-varying LP via blocks
    out = np.zeros(N)
    blk = 2400
    zi = None
    for i in range(0, N, blk):
        sos = signal.butter(2, cutoff[min(i, N - 1)], fs=SR, output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        out[i : i + blk], zi = signal.sosfilt(sos, pad[i : i + blk], zi=zi)
    m += norm(out) * 0.22

    # intro pulse: sub thump on quarters (tension), 0.4 → drop
    q = 0.4
    while q < drop - 0.05:
        place(m, impact(0.3, 70, 50, 0.12, 0.0), q, 0.25)
        q += beat
    place(m, riser(1.0), drop - 1.0, 0.25)

    # drums + bass after the drop
    k = 0
    tt = drop
    while tt < end - 1e-6:
        place(m, impact(0.35, 150, 45, 0.11, 0.15), tt, 0.7)  # kick
        if k % 2 == 1:
            sn = bp(rng.normal(0, 1, int(0.18 * SR)), 900, 6000) * env_exp(0.18, 0.045)
            place(m, norm(sn), tt, 0.28)
        hat = hp(rng.normal(0, 1, int(0.05 * SR)), 7000) * env_exp(0.05, 0.012)
        place(m, norm(hat), tt + beat / 2, 0.16)
        place(m, norm(hat), tt, 0.06)
        root, _ = chord_at(tt + 0.01)
        for h in (0, 1):
            bt = t_axis(beat / 2)
            b = lp(signal.sawtooth(2 * np.pi * root * 2 * bt), 380) * np.exp(-bt / 0.12)
            place(m, norm(b), tt + h * beat / 2, 0.35)
        tt += beat
        k += 1
    # Live-mode breakdown: thin the drums so the typing ticks come forward.
    tv = np.arange(N) / SR
    dip = 1 - 0.45 * np.clip(np.minimum((tv - 22.0) / 0.3, (26.2 - tv) / 0.3), 0, 1)
    m *= dip
    # tail fade after the last hit
    m *= np.clip((41.6 - tv) / 1.6, 0, 1)
    return m


def main():
    vo, sr = sf.read(sys.argv[1], dtype="float64")
    if vo.ndim > 1:
        vo = vo.mean(1)
    assert sr == SR, sr
    voice = np.zeros(N)
    voice[: min(N, len(vo))] = vo[:N]
    voice = norm(voice, 0.89)

    # ducking envelope from the voice
    e = np.abs(voice)
    e = signal.sosfilt(signal.butter(1, 6, fs=SR, output="sos"), e)
    e = np.clip(e / (np.percentile(e, 95) or 1), 0, 1)
    duck = 1 - 0.55 * e

    mix = voice.copy()
    mix += sfx * 0.31 * (1 - 0.35 * e)
    if "--no-music" not in sys.argv:
        mix += norm(music()) * 0.2 * duck
    if "--stems" in sys.argv:
        sf.write(sys.argv[2] + ".voice.wav", voice.astype(np.float32), SR)
        sf.write(sys.argv[2] + ".sfx.wav", (sfx * 0.31 * (1 - 0.35 * e)).astype(np.float32), SR)
        sf.write(sys.argv[2] + ".music.wav", (norm(music()) * 0.2 * duck).astype(np.float32), SR)
    # gentle limiter
    mix = np.tanh(mix * 1.15) / np.tanh(1.15)
    mix = norm(mix, 0.95)
    st = np.stack([mix, mix], 1)
    sf.write(sys.argv[2], st.astype(np.float32), SR, subtype="PCM_24")
    print("wrote", sys.argv[2])


main()
