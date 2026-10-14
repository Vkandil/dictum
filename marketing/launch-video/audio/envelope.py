"""Writes src/envelope.json: voice loudness (0..1) per 60 fps frame.

usage: python envelope.py public/vo.mp3 src/envelope.json
"""
import json
import sys

import numpy as np
import soundfile as sf

FPS = 60

a, sr = sf.read(sys.argv[1], dtype="float32")
if a.ndim > 1:
    a = a.mean(1)
hop = sr // FPS
n = int(np.ceil(len(a) / hop))
rms = np.array([np.sqrt(np.mean(a[i * hop:(i + 1) * hop] ** 2) + 1e-12) for i in range(n)])
v = np.clip((20 * np.log10(rms) + 50) / 40, 0, 1)
# fast attack, slower release, so bars snap up and fall back smoothly
out, c = np.zeros_like(v), 0.0
for i, x in enumerate(v):
    c = x if x > c else c * 0.82 + x * 0.18
    out[i] = c
json.dump([round(float(x), 3) for x in out], open(sys.argv[2], "w"))
