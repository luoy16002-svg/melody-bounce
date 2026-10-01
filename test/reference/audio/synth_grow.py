"""Soundtrack for the growing-ball sim: Canon in D (Pachelbel, public domain).
Every bounce plays the next melody note. Layers join as the ball fills the ring:
bass line from 20 %, bell doubling from 45 %, a D pedal riser from 70 %, a full chord at FULL and a pop.

Usage: python audio/synth_grow.py out/grow-115.json out/grow-115.wav
"""
import json, sys
import numpy as np
import soundfile as sf
sys.path.insert(0, 'audio')
from synth import SR, piano, bell, shimmer, reverb, hz

# (melody note, chord index) - chords: D A Bm F#m G D G A
S1 = [(78, 0), (76, 1), (74, 2), (73, 3), (71, 4), (69, 5), (71, 6), (73, 7)]
S2 = [(74, 0), (73, 1), (71, 2), (69, 3), (67, 4), (66, 5), (67, 6), (64, 7)]
S3 = [(74, 0), (78, 0), (81, 1), (79, 1), (78, 2), (74, 2), (78, 3), (76, 3),
      (74, 4), (71, 4), (74, 5), (81, 5), (79, 6), (83, 6), (81, 7), (79, 7)]
CANON = S1 + S2 + S3
BASS = [50, 45, 47, 42, 43, 38, 43, 45]
MIN_GAP = 0.065
END_AFTER = 4.0


def pad(midis, n, detune=0.0025):
    t = np.arange(n) / SR
    out = np.zeros(n)
    for m in midis:
        f = hz(m)
        for d in (-detune, 0, detune):
            ff = f * (1 + d)
            out += np.sin(2 * np.pi * ff * t) + 0.35 * np.sin(4 * np.pi * ff * t) + 0.12 * np.sin(6 * np.pi * ff * t)
    return out / (3 * len(midis))


def main(src, dst):
    d = json.load(open(src))
    R, TF = d['R'], d['fillAt']
    total = TF + END_AFTER
    L = np.zeros(int(SR * (total + 1))); Rt = np.zeros_like(L)

    def add(sig, t, pan=0.0):
        i = int(t * SR); j = min(len(L), i + len(sig))
        if i >= len(L): return
        L[i:j] += sig[: j - i] * (1 - pan) ** 0.5; Rt[i:j] += sig[: j - i] * (1 + pan) ** 0.5

    last, k, chord = -1.0, 0, None
    t70 = None
    for b in d['bounces']:
        t = b['t']
        f = min(1.0, (b['r'] / R) ** 2)
        if f >= 0.7 and t70 is None:
            t70 = t
        if t - last < MIN_GAP:
            continue
        gap = t - last
        last = t
        m, c = CANON[k % len(CANON)]
        k += 1
        pan = max(-0.7, min(0.7, b['x'] / 600))
        dur = 1.8 if gap > 0.3 else 1.1
        add(piano(m, dur, 0.72 + 0.28 * f), t, pan)
        if f >= 0.2 and c != chord:
            add(piano(BASS[c], 2.4, 0.5 + 0.2 * f), t)
            add(piano(BASS[c] + 12, 1.6, 0.22), t)
        if f >= 0.45:
            add(bell(hz(m + 12), 0.8, 0.028 + 0.02 * f), t, -pan)
        chord = c

    # riser: D pedal swelling from 70 % to FULL, with a brightening noise sweep
    if t70 is not None:
        n = int(SR * (TF - t70 + 0.05))
        env = np.linspace(0, 1, n) ** 2
        add(pad([38, 45, 50, 57], n) * env * 0.16, t70)
        rng = np.random.default_rng(3)
        noise = np.diff(rng.normal(0, 1, n + 1))
        add(noise * env ** 1.5 * 0.035, t70)

    # FULL: D major, spread and rolled
    for i, m in enumerate([38, 45, 50, 54, 57, 62, 66, 69, 74, 78, 81, 86]):
        add(piano(m, 4.2, 0.95), TF + 0.022 * i, pan=(i - 5.5) * 0.08)
    add(bell(hz(86), 2.6, 0.06), TF + 0.1)
    add(shimmer(1.2, 0.05, seed=5), TF)

    # POP: thump + noise burst + sparkles
    pop = TF + 0.9
    n = int(SR * 0.5); tt = np.arange(n) / SR
    thump = np.sin(2 * np.pi * (70 * tt - 30 * tt * tt)) * np.exp(-tt * 9) * 0.55
    add(thump, pop)
    burst = np.diff(np.random.default_rng(9).normal(0, 1, int(SR * 0.2) + 1)) * np.exp(-np.arange(int(SR * 0.2)) / SR * 30) * 0.18
    add(burst, pop)
    rng = np.random.default_rng(12)
    for i in range(14):
        m = int(rng.choice([86, 88, 90, 93, 95, 98]))
        add(bell(hz(m), 0.9, 0.03), pop + 0.05 + i * 0.055 + rng.uniform(0, 0.03), pan=rng.uniform(-0.7, 0.7))

    mix = np.stack([reverb(L), reverb(Rt, seed=8)], axis=1)[: int(SR * total)]
    fade = int(SR * 0.45); mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
    mix = mix / np.abs(mix).max() * 0.89
    sf.write(dst, mix.astype(np.float32), SR, subtype='PCM_16')
    print(f'{dst}: {len(mix) / SR:.1f}s, notes {k}, 70% at {t70:.1f}s, full at {TF:.1f}s')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
