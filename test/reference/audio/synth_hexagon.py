"""Soundtrack for the spinning hexagon: Minuet in G (from the Anna Magdalena Bach notebook, public domain),
one note per bounce, with a light bass on the first beat of each bar. The spin winds up with every bounce;
the escape is an upward G-major run, a boom and a ringing chord.
Usage: python audio/synth_hexagon.py out/hexagon-14.json out/hexagon-14.wav
"""
import json
import sys

import numpy as np
import soundfile as sf

sys.path.insert(0, 'audio')
from synth import SR, bell, hz, piano, reverb, shimmer  # noqa: E402

MINUET = [74, 67, 69, 71, 72, 74, 67, 67, 76, 72, 74, 76, 78, 79, 67, 67,
          72, 74, 72, 71, 69, 71, 72, 71, 69, 67, 66, 67, 69, 71, 67, 69,
          74, 67, 69, 71, 72, 74, 67, 67, 76, 72, 74, 76, 78, 79, 67, 67,
          72, 74, 72, 71, 69, 71, 72, 71, 69, 67, 69, 71, 69, 67, 66, 67]
BASS = {0: 43, 5: 47, 8: 48, 13: 47, 16: 45, 21: 43, 26: 38, 29: 38}
END_AFTER = 3.6


def main(src, dst):
    d = json.load(open(src))
    esc = d['escaped']
    total = esc + END_AFTER
    L = np.zeros(int(SR * (total + 1)))
    R = np.zeros_like(L)

    def add(sig, t, pan=0.0):
        i = int(t * SR)
        j = min(len(L), i + len(sig))
        if i < 0 or i >= len(L):
            return
        L[i:j] += sig[: j - i] * (1 - pan) ** 0.5
        R[i:j] += sig[: j - i] * (1 + pan) ** 0.5

    add(shimmer(1.8, 0.03, seed=5), 0.5)
    for k, b in enumerate(d['bounces']):
        m = MINUET[k % len(MINUET)]
        pan = max(-0.7, min(0.7, b['x'] / 450))
        vel = 0.6 + 0.25 * min(1, b['v'] / 2200)
        add(piano(m, 1.3, vel), b['t'], pan)
        if k % 32 in BASS:
            add(piano(BASS[k % 32], 1.8, 0.4), b['t'], -pan * 0.5)
        if k >= 32:
            add(bell(hz(m + 12), 0.5, 0.015), b['t'], -pan)
    # escape: an upward run, a boom, a ringing G-major chord
    for i, m in enumerate([67, 71, 74, 79, 83, 86]):
        add(piano(m, 0.8, 0.55), esc + i * 0.06, 0.3)
    tb = np.arange(int(SR * 1.0)) / SR
    add(np.sin(2 * np.pi * (60 * tb - 20 * tb * tb)) * np.exp(-tb * 4.5) * 0.5, esc + 0.4)
    add(shimmer(1.2, 0.06, seed=9), esc + 0.4)
    for m in (43, 55, 62, 67, 71, 74):
        add(piano(m, 3.0, 0.45), esc + 0.45)
    add(bell(hz(91), 2.0, 0.04), esc + 0.6)

    mix = np.stack([reverb(L, secs=2.0, wet=0.24), reverb(R, secs=2.0, wet=0.24, seed=8)], 1)[: int(SR * total)]
    fade = int(0.08 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    mix /= np.abs(mix).max() + 1e-9
    sf.write(dst, (mix * 0.85).astype(np.float32), SR)
    print(f'{dst} {total:.1f}s, {len(d["bounces"])} notes')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
