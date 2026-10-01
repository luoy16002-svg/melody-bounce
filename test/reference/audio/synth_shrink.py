"""Soundtrack for the shrinking ring: In the Hall of the Mountain King (Grieg, public domain), one note per
bounce. The ring shrinks 1.5 % per bounce, so the bounces, and the tune, speed up by themselves, the way
Grieg's own piece does. Bass octaves join at 40 bounces, bells at 90, a strain riser in the last seconds;
the squeeze is a boom, a crash and a falling cascade.
Usage: python audio/synth_shrink.py out/shrink-7.json out/shrink-7.wav
"""
import json
import sys

import numpy as np
import soundfile as sf

sys.path.insert(0, 'audio')
from synth import SR, bell, hz, piano, reverb, shimmer  # noqa: E402
from synth_multiply import THEME  # noqa: E402

MIN_GAP = 0.06
END_AFTER = 3.6


def main(src, dst):
    d = json.load(open(src))
    sq = d['squeezed']
    total = sq + END_AFTER
    L = np.zeros(int(SR * (total + 1)))
    R = np.zeros_like(L)

    def add(sig, t, pan=0.0):
        i = int(t * SR)
        j = min(len(L), i + len(sig))
        if i < 0 or i >= len(L):
            return
        L[i:j] += sig[: j - i] * (1 - pan) ** 0.5
        R[i:j] += sig[: j - i] * (1 + pan) ** 0.5

    add(shimmer(1.8, 0.03, seed=7), 0.5)
    last, k = -1.0, 0
    nb = len(d['bounces'])
    for b in d['bounces']:
        t = b['t']
        if t - last < MIN_GAP:
            continue
        last = t
        m = THEME[k % len(THEME)]
        k += 1
        f = b['n'] / nb
        pan = max(-0.7, min(0.7, b['ax'] / 500))
        add(piano(m, 1.0 if f < 0.6 else 0.6, 0.62 + 0.3 * f), t, pan)
        if b['n'] >= 40:
            add(piano(m - 12, 0.8, 0.35 + 0.2 * f), t, -pan)
        if b['n'] >= 90:
            add(bell(hz(m + 12), 0.4, 0.02 + 0.02 * f), t, -pan)
    # strain riser over the last four seconds
    n = int(SR * 4)
    tt = np.arange(n) / SR
    env = (tt / 4) ** 2
    trem = 0.5 + 0.5 * np.sin(2 * np.pi * (6 + 12 * env) * tt)
    add((np.sin(2 * np.pi * hz(83) * tt) + 0.5 * np.sin(2 * np.pi * hz(78) * tt)) * trem * env * 0.05, sq - 4)
    noise = np.diff(np.random.default_rng(4).normal(0, 1, n + 1))
    add(noise * env ** 1.6 * 0.025, sq - 4)
    # squeeze: boom, crash, a falling cascade, then a B-minor chord
    tb = np.arange(int(SR * 1.0)) / SR
    add(np.sin(2 * np.pi * (62 * tb - 22 * tb * tb)) * np.exp(-tb * 5) * 0.7, sq)
    crash = np.diff(np.random.default_rng(8).normal(0, 1, int(SR * 1.2) + 1)) * np.exp(-np.arange(int(SR * 1.2)) / SR * 4.5) * 0.12
    add(crash, sq)
    for i, m in enumerate([83, 81, 78, 76, 74, 71, 69, 66, 62, 59]):
        add(bell(hz(m), 0.6, 0.03), sq + 0.05 + i * 0.05, (i % 2 - 0.5))
    for m in (35, 47, 54, 59, 62, 66):
        add(piano(m, 2.8, 0.5), sq + 0.6)

    mix = np.stack([reverb(L, secs=1.8, wet=0.22), reverb(R, secs=1.8, wet=0.22, seed=8)], 1)[: int(SR * total)]
    fade = int(0.08 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    mix /= np.abs(mix).max() + 1e-9
    sf.write(dst, (mix * 0.85).astype(np.float32), SR)
    print(f'{dst} {total:.1f}s, {k} notes')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
