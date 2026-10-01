"""Soundtrack for the strings sim: Ode to Joy (Beethoven, public domain), one note per bounce.
Each bounce also plucks a soft string an octave down (the string being tied). Bass joins at 25 strings,
bells at 50, a strain riser from 80; the break is a boom, a cascade of snapping strings and a D-major chord.

Usage: python audio/synth_strings.py out/strings-4.json out/strings-4.wav
"""
import json, sys
import numpy as np
import soundfile as sf
sys.path.insert(0, 'audio')
from synth import SR, piano, bell, shimmer, reverb, hz

A1 = [66, 66, 67, 69, 69, 67, 66, 64, 62, 62, 64, 66, 66, 64, 64]
A2 = [66, 66, 67, 69, 69, 67, 66, 64, 62, 62, 64, 66, 64, 62, 62]
B = [64, 64, 66, 62, 64, 66, 67, 66, 62, 64, 66, 67, 66, 64, 62, 64, 57]
ODE = A1 + A2 + B + A2
MIN_GAP = 0.07
END_AFTER = 3.6


def chord_root(m):
    pc = m % 12
    if pc in (2, 6, 9):      # D F# A
        return 38
    if pc in (4, 7, 1):      # E G C#
        return 45
    return 43                # B -> G


def pluck(f, dur, amp, bright=0.6, seed=0):
    n = int(SR * dur)
    N = max(2, int(SR / f))
    rng = np.random.default_rng(seed)
    exc = rng.uniform(-1, 1, N)
    for _ in range(int((1 - bright) * 4)):               # soften the excitation
        exc = 0.5 * (exc + np.roll(exc, 1))
    out = np.zeros(n)
    out[:N] = exc
    decay = 0.996
    i = N
    while i < n:
        j = min(n, i + N)
        prev = out[i - N:j - N]
        prev2 = out[i - N - 1:j - N - 1] if i - N - 1 >= 0 else np.concatenate([[0.0], out[:j - N - 1]])
        out[i:j] = decay * 0.5 * (prev + prev2)
        i = j
    return out * amp


def main(src, dst):
    d = json.load(open(src))
    TB = d['breakAt']
    total = TB + END_AFTER
    L = np.zeros(int(SR * (total + 1))); Rt = np.zeros_like(L)

    def add(sig, t, pan=0.0):
        i = int(t * SR); j = min(len(L), i + len(sig))
        if i >= len(L) or i < 0: return
        L[i:j] += sig[: j - i] * (1 - pan) ** 0.5; Rt[i:j] += sig[: j - i] * (1 + pan) ** 0.5

    last, k, root = -1.0, 0, None
    t80 = None
    for b in d['bounces']:
        t, n = b['t'], b['n']
        if n >= d['nBreak']:
            break
        if n >= 80 and t80 is None:
            t80 = t
        if t - last < MIN_GAP:
            continue
        last = t
        m = ODE[k % len(ODE)]
        k += 1
        pan = max(-0.7, min(0.7, b['ax'] / 520))
        f = n / d['nBreak']
        add(piano(m, 1.4 if f < 0.6 else 0.9, 0.72 + 0.28 * f), t, pan)
        add(pluck(hz(m - 12), 1.2, 0.10, bright=0.5, seed=n), t, -pan)
        r = chord_root(m)
        if n >= 25 and r != root:
            add(piano(r, 2.2, 0.5 + 0.2 * f), t)
            root = r
        if n >= 50:
            add(bell(hz(m + 12), 0.7, 0.03 + 0.02 * f), t, -pan)

    # strain riser: trembling high D + brightening noise from 80 strings to the break
    if t80 is not None:
        n = int(SR * (TB - t80))
        env = np.linspace(0, 1, n) ** 2
        tt = np.arange(n) / SR
        trem = (0.5 + 0.5 * np.sin(2 * np.pi * (6 + 10 * env) * tt))
        add((np.sin(2 * np.pi * hz(86) * tt) + 0.5 * np.sin(2 * np.pi * hz(81) * tt)) * trem * env * 0.05, t80)
        noise = np.diff(np.random.default_rng(4).normal(0, 1, n + 1))
        add(noise * env ** 1.6 * 0.03, t80)

    # BREAK: boom, crash, a cascade of snapping strings, then D major
    n = int(SR * 0.9); tt = np.arange(n) / SR
    add(np.sin(2 * np.pi * (62 * tt - 22 * tt * tt)) * np.exp(-tt * 5) * 0.7, TB)
    crash = np.diff(np.random.default_rng(8).normal(0, 1, int(SR * 1.2) + 1)) * np.exp(-np.arange(int(SR * 1.2)) / SR * 4.5) * 0.12
    add(crash, TB)
    rng = np.random.default_rng(21)
    penta = [62, 64, 66, 69, 71]
    for i in range(60):
        m = penta[i % 5] + 12 * (1 + (i // 5) % 3)
        add(pluck(hz(m), 1.0, 0.05, bright=0.8, seed=100 + i), TB + 0.02 + i * 0.013 + rng.uniform(0, 0.01), pan=rng.uniform(-0.8, 0.8))
    for i, m in enumerate([38, 45, 50, 54, 57, 62, 66, 69, 74, 78, 81]):
        add(piano(m, 4.0, 0.95), TB + 0.08 + 0.02 * i, pan=(i - 5) * 0.08)
    add(bell(hz(86), 2.4, 0.06), TB + 0.2)
    add(shimmer(1.4, 0.05, seed=6), TB + 0.05)

    mix = np.stack([reverb(L), reverb(Rt, seed=8)], axis=1)[: int(SR * total)]
    fade = int(SR * 0.45); mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
    mix = mix / np.abs(mix).max() * 0.89
    sf.write(dst, mix.astype(np.float32), SR, subtype='PCM_16')
    print(f'{dst}: {len(mix) / SR:.1f}s, notes {k}, strain from {t80:.1f}s, break at {TB:.1f}s')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
