"""Soundtrack for Red vs Blue: Rondo alla Turca (Mozart, public domain), one note per wall bounce. Red's
bounces play on the piano, panned left; Blue's on a plucked string, panned right. A clash between the balls
is a short woodblock. The last five seconds add a ticking riser; the whistle at 30 s is a boom, a crash and
the winner's chord.
Usage: python audio/synth_colorwar.py out/colorwar-166.json out/colorwar-166.wav
"""
import json
import sys

import numpy as np
import soundfile as sf

sys.path.insert(0, 'audio')
from synth import SR, bell, hz, piano, reverb, shimmer  # noqa: E402
from synth_strings import pluck  # noqa: E402

# The opening of the Rondo (A minor): the part everyone knows, looped.
TURCA = [71, 69, 68, 69, 72, 74, 72, 71, 72, 76, 77, 76, 75, 76, 83, 81, 80, 81, 83, 81, 80, 81, 84, 81, 84]
MIN_GAP = 0.06
END_AFTER = 3.6


def woodblock(amp=0.12):
    n = int(SR * 0.08)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 1850 * t) + 0.5 * np.sin(2 * np.pi * 2750 * t)) * np.exp(-t * 60) * amp


def main(src, dst):
    d = json.load(open(src))
    end = d['end']
    total = end + END_AFTER
    L = np.zeros(int(SR * (total + 1)))
    R = np.zeros_like(L)

    def add(sig, t, pan=0.0):
        i = int(t * SR)
        j = min(len(L), i + len(sig))
        if i < 0 or i >= len(L):
            return
        L[i:j] += sig[: j - i] * (1 - pan) ** 0.5
        R[i:j] += sig[: j - i] * (1 + pan) ** 0.5

    add(shimmer(1.8, 0.03, seed=3), 0.5)
    last, k = -1.0, 0
    for b in d['bounces']:
        t = b['t']
        if t >= end:
            break
        if t - last < MIN_GAP:
            continue
        last = t
        m = TURCA[k % len(TURCA)]
        k += 1
        f = (t - d['t0']) / (end - d['t0'])
        if b['who'] == 0:
            add(piano(m, 1.0, 0.7 + 0.25 * f), t, -0.55)
        else:
            add(pluck(hz(m), 1.0, 0.33 + 0.1 * f, bright=0.75, seed=k), t, 0.55)
            add(bell(hz(m + 12), 0.35, 0.012), t, 0.55)
        if k % 5 == 0:  # a light bass under every phrase
            add(piano(45 if m % 12 in (9, 0, 4) else 40, 1.4, 0.35), t)
    for c in d['clashes']:
        if c['t'] < end:
            add(woodblock(), c['t'])
    # last five seconds: ticking riser
    for i in range(20):
        add(woodblock(0.05 + 0.004 * i), end - 5 + i * 0.25)
    n = int(SR * 5)
    tt = np.arange(n) / SR
    env = (tt / 5) ** 2
    add(np.sin(2 * np.pi * hz(81) * tt) * (0.5 + 0.5 * np.sin(2 * np.pi * (6 + 8 * env) * tt)) * env * 0.04, end - 5)
    # the whistle: boom, crash, the winner's chord in the winner's timbre
    tb = np.arange(int(SR * 1.0)) / SR
    add(np.sin(2 * np.pi * (60 * tb - 20 * tb * tb)) * np.exp(-tb * 4.5) * 0.6, end)
    add(shimmer(1.2, 0.08, seed=5), end)
    red_wins = d['final'][0] > d['final'][1]
    for i, m in enumerate((57, 64, 69, 72, 76, 81)):
        if red_wins:
            add(piano(m, 2.8, 0.55), end + 0.05 + i * 0.07, -0.3)
        else:
            add(pluck(hz(m), 2.4, 0.4, bright=0.8, seed=90 + i), end + 0.05 + i * 0.07, 0.3)
    add(bell(hz(93), 2.0, 0.05), end + 0.5)

    mix = np.stack([reverb(L, secs=1.8, wet=0.22), reverb(R, secs=1.8, wet=0.22, seed=8)], 1)[: int(SR * total)]
    fade = int(0.08 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    mix /= np.abs(mix).max() + 1e-9
    sf.write(dst, (mix * 0.85).astype(np.float32), SR)
    print(f'{dst} {total:.1f}s, {k} notes')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
