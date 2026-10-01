"""Soundtrack for the multiply sim: In the Hall of the Mountain King (Grieg, public domain).
Each wall hit advances the melody (rate-limited), so the tune accelerates as balls multiply.

Usage: python audio/synth_multiply.py out/multiply-4.json out/multiply-4.wav
"""
import json, sys
import numpy as np
import soundfile as sf
sys.path.insert(0, 'audio')
from synth import SR, piano, bell, shimmer, reverb, hz

THEME = [59, 61, 62, 64, 66, 62, 66, 65, 61, 65, 64, 60, 64,
         59, 61, 62, 64, 66, 62, 66, 71, 69, 66, 62, 66, 69]
MIN_GAP = 0.075


def main(src, dst):
    d = json.load(open(src))
    total = d['duration'] + 3.2
    L = np.zeros(int(SR * total) + SR); R = np.zeros_like(L)

    def add(sig, t, pan=0.0):
        i = int(t * SR); j = min(len(L), i + len(sig))
        if i >= len(L): return
        L[i:j] += sig[: j - i] * (1 - pan) ** 0.5; R[i:j] += sig[: j - i] * (1 + pan) ** 0.5

    # live-ball count per frame, to scale intensity
    alive = [sum(1 for b in f if not b[3]) for f in d['frames']]
    last, n = -1.0, 0
    for h in d['hits']:
        t = h['t']
        if t - last < MIN_GAP:
            continue
        last = t
        m = THEME[n % len(THEME)]
        n += 1
        a = alive[min(len(alive) - 1, int(t * 60))]
        pan = max(-0.8, min(0.8, h['x'] / 500))
        add(piano(m, 0.9, 0.8), t, pan)
        if a > 60:
            add(piano(m + 12, 0.7, 0.45), t, -pan)
        if a > 100 and n % 2 == 0:
            add(piano(m - 24, 1.2, 0.6), t)
    end = d['escapes'][-1]['t']
    for k, m in enumerate([47, 54, 59, 62, 66, 71, 74]):        # B minor, arpeggiated
        add(piano(m, 3.8, 0.95), end + 0.05 * k, pan=(k - 3) * 0.1)
    add(shimmer(1.6, 0.07, seed=11), end)
    add(bell(hz(83), 2.8, 0.06), end + 0.3)

    mix = np.stack([reverb(L), reverb(R, seed=8)], axis=1)[: int(SR * total)]
    fade = int(SR * 0.9); mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    mix = mix / np.abs(mix).max() * 0.89
    sf.write(dst, mix.astype(np.float32), SR, subtype='PCM_16')
    print(f'{dst}: {len(mix) / SR:.1f}s, notes {n}, final at {end:.1f}s')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
