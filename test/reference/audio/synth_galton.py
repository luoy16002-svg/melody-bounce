"""Soundtrack for the Galton board: every bin has its own note (a D-major pentatonic scale, the middle bin on
D4), and each ball plays its bin's note as it lands, so the bell curve is something you hear: the middle
notes crowd in and the edges stay rare. Peg contacts are a faint rain of clicks. A pad breathes underneath;
when the last ball lands the curve is drawn over a D-major chord.
Usage: python audio/synth_galton.py out/galton-281.json out/galton-281.wav
"""
import json
import sys

import numpy as np
import soundfile as sf

sys.path.insert(0, 'audio')
from synth import SR, bell, hz, piano, reverb, shimmer  # noqa: E402
from synth_strings import pluck  # noqa: E402

PENT = [0, 2, 4, 7, 9]
END_AFTER = 3.6


def note_of(bin_, rows):
    d = bin_ - rows // 2
    return 62 + 12 * (d // 5) + PENT[d % 5]


def click(freq, amp):
    n = int(SR * 0.02)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * freq * t) * np.exp(-t * 400) * amp


def pad(midis, dur, amp):
    n = int(SR * dur)
    t = np.arange(n) / SR
    env = np.minimum(1, t / 2.0) * np.minimum(1, (dur - t) / 1.5)
    return sum(np.sin(2 * np.pi * hz(m) * t) for m in midis) * env * amp / len(midis)


def main(src, dst):
    d = json.load(open(src))
    rows = d['rows']
    climax = d['done'] + 0.6
    total = climax + END_AFTER
    L = np.zeros(int(SR * (total + 1)))
    R = np.zeros_like(L)

    def add(sig, t, pan=0.0):
        i = int(t * SR)
        j = min(len(L), i + len(sig))
        if i < 0 or i >= len(L):
            return
        L[i:j] += sig[: j - i] * (1 - pan) ** 0.5
        R[i:j] += sig[: j - i] * (1 + pan) ** 0.5

    add(shimmer(1.8, 0.03, seed=4), 0.5)
    rng = np.random.default_rng(11)
    last_click = -1.0
    hits = sorted(h for b in d['balls'] for h in b['hits'])
    for h in hits:
        if h - last_click < 0.006:
            continue
        last_click = h
        add(click(2600 + rng.uniform(-400, 400), 0.02), h, rng.uniform(-0.5, 0.5))
    for i, b in enumerate(d['balls']):
        m = note_of(b['bin'], rows)
        pan = (b['bin'] / rows - 0.5) * 1.3
        add(pluck(hz(m), 1.1, 0.26, bright=0.7, seed=i), b['land'], pan)
        add(bell(hz(m + 12), 0.4, 0.008), b['land'], -pan)
    add(pad([50, 57, 62, 66], climax - 3.0, 0.04), 2.8)
    # the reveal
    tb = np.arange(int(SR * 1.0)) / SR
    add(np.sin(2 * np.pi * (58 * tb - 18 * tb * tb)) * np.exp(-tb * 4.5) * 0.45, climax)
    add(shimmer(1.4, 0.06, seed=6), climax)
    for k, m in enumerate((38, 50, 57, 62, 66, 69, 74, 78)):
        add(piano(m, 3.0, 0.45), climax + 0.03 * k)
    add(bell(hz(86), 2.2, 0.05), climax + 0.3)

    mix = np.stack([reverb(L, secs=2.0, wet=0.24), reverb(R, secs=2.0, wet=0.24, seed=8)], 1)[: int(SR * total)]
    fade = int(0.08 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    mix /= np.abs(mix).max() + 1e-9
    sf.write(dst, (mix * 0.85).astype(np.float32), SR)
    print(f'{dst} {total:.1f}s')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
