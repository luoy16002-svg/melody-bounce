"""Soundtrack for the 4-ball race: Mozart's Symphony No. 40 theme (public domain), one note per wall hit.
Ball-ball hits click like wood, near misses get a rising swoosh + bell, a riser builds from 18 s,
and the win lands on a G-major chord (the minor theme resolves to major).

Usage: python audio/synth_race.py out/race-116.json out/race-116.wav
"""
import json, sys
import numpy as np
import soundfile as sf
sys.path.insert(0, 'audio')
from synth import SR, piano, bell, shimmer, reverb, hz

P1 = [75, 74, 74, 75, 74, 74, 75, 74, 74, 82]
P2 = [82, 81, 79, 79, 77, 75, 75, 74, 72, 72]
P3 = [74, 72, 72, 74, 72, 72, 74, 72, 72, 81]
P4 = [81, 79, 78, 78, 75, 74, 74, 72, 70, 70]
THEME = [(m, 43) for m in P1] + [(m, 48) for m in P2] + [(m, 38) for m in P3] + [(m, 43) for m in P4]
MIN_GAP = 0.07
END_AFTER = 3.4


def clack(amp=0.12, seed=0):
    n = int(SR * 0.06); t = np.arange(n) / SR
    body = np.sin(2 * np.pi * 1850 * t) * np.exp(-t * 90) + 0.6 * np.sin(2 * np.pi * 2900 * t) * np.exp(-t * 120)
    tick = np.random.default_rng(seed).normal(0, 1, n) * np.exp(-t * 400) * 0.4
    return (body + tick) * amp


def swoosh(dur=0.5, amp=0.05, seed=1):
    n = int(SR * dur); t = np.arange(n) / SR
    noise = np.diff(np.random.default_rng(seed).normal(0, 1, n + 1))
    return noise * np.sin(np.pi * t / dur) ** 2 * amp * (0.4 + 0.6 * t / dur)


def main(src, dst):
    d = json.load(open(src))
    TW = d['winAt']
    total = TW + END_AFTER
    L = np.zeros(int(SR * (total + 1))); Rt = np.zeros_like(L)

    def add(sig, t, pan=0.0):
        i = int(t * SR); j = min(len(L), i + len(sig))
        if i >= len(L) or i < 0: return
        L[i:j] += sig[: j - i] * (1 - pan) ** 0.5; Rt[i:j] += sig[: j - i] * (1 + pan) ** 0.5

    last, k, bass = -1.0, 0, None
    for h in d['hits']:
        t = h['t']
        if t > TW or t - last < MIN_GAP:
            continue
        last = t
        m, root = THEME[k % len(THEME)]
        k += 1
        pan = max(-0.7, min(0.7, h['x'] / 520))
        heat = min(1.0, t / TW)
        add(piano(m, 1.1, 0.7 + 0.3 * heat), t, pan)
        if t > 5 and root != bass:
            add(piano(root, 2.4, 0.55), t); add(piano(root + 12, 1.6, 0.25), t)
            bass = root
        if t > 12:
            add(bell(hz(m + 12), 0.6, 0.025), t, -pan)
    for c in d['clacks']:
        if c['t'] < TW:
            add(clack(0.09, seed=int(c['t'] * 1000)), c['t'], max(-0.7, min(0.7, c['x'] / 520)))
    for n in d['near']:
        if n['t'] < TW:
            add(swoosh(0.45, 0.05, seed=int(n['t'] * 100)), n['t'] - 0.25)
            add(bell(hz(91), 0.9, 0.05), n['t'])
    # riser into the win
    t0 = 18.0
    n = int(SR * (TW - t0)); tt = np.arange(n) / SR; env = np.linspace(0, 1, n) ** 2
    trem = 0.5 + 0.5 * np.sin(2 * np.pi * (5 + 9 * env) * tt)
    add((np.sin(2 * np.pi * hz(55) * tt) + 0.6 * np.sin(2 * np.pi * hz(62) * tt) + 0.4 * np.sin(2 * np.pi * hz(67) * tt)) * trem * env * 0.06, t0)
    add(np.diff(np.random.default_rng(5).normal(0, 1, n + 1)) * env ** 1.5 * 0.025, t0)
    # WIN: G major fanfare
    for i, m in enumerate([43, 50, 55, 59, 62, 67, 71, 74, 79, 83]):
        add(piano(m, 3.8, 0.95), TW + 0.03 * i, pan=(i - 4.5) * 0.08)
    for i, m in enumerate([79, 83, 86, 91]):
        add(bell(hz(m), 1.4, 0.05), TW + 0.35 + 0.09 * i, pan=(i - 1.5) * 0.3)
    add(shimmer(1.4, 0.06, seed=9), TW)

    mix = np.stack([reverb(L), reverb(Rt, seed=8)], axis=1)[: int(SR * total)]
    fade = int(SR * 0.45); mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
    mix = mix / np.abs(mix).max() * 0.89
    sf.write(dst, mix.astype(np.float32), SR, subtype='PCM_16')
    print(f'{dst}: {len(mix) / SR:.1f}s, notes {k}, win at {TW:.1f}s')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
