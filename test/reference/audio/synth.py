"""Sound design for an escape simulation: every bounce plays the next note of Fur Elise
(Beethoven, public domain), every ring break adds a low note + shimmer, the escape gets a chord.

Usage: python audio/synth.py out/escape-10.json out/escape-10.wav
"""
import json
import sys

import numpy as np
import soundfile as sf

SR = 48000
FUR_ELISE = [76, 75, 76, 75, 76, 71, 74, 72, 69, 60, 64, 69, 71, 64, 68, 71, 72,
             64, 76, 75, 76, 75, 76, 71, 74, 72, 69, 60, 64, 69, 71, 64, 72, 71, 69]


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def piano(m, dur=1.6, vel=1.0):
    """Additive piano-ish tone: decaying partials, slight inharmonicity, soft hammer."""
    n = int(SR * dur)
    t = np.arange(n) / SR
    f0 = hz(m)
    out = np.zeros(n)
    for k in range(1, 9):
        fk = f0 * k * (1 + 0.0004 * k * k)
        if fk > SR / 2.2:
            break
        amp = 1 / k ** 1.25
        decay = 2.2 + 1.1 * k + f0 / 900
        out += amp * np.exp(-decay * t) * np.sin(2 * np.pi * fk * t + k)
    hammer = np.random.default_rng(m).normal(0, 1, n) * np.exp(-t * 120) * 0.04
    env = np.minimum(1, t / 0.004)
    return (out + hammer) * env * vel * 0.32


def bell(f, dur=1.2, amp=0.1):
    n = int(SR * dur)
    t = np.arange(n) / SR
    out = sum(np.exp(-t * (3 + 2 * i)) * np.sin(2 * np.pi * f * r * t) / (1 + i) for i, r in enumerate([1, 2.76, 5.4, 8.93]))
    return out * amp * np.minimum(1, t / 0.002)


def shimmer(dur=0.5, amp=0.05, seed=0):
    rng = np.random.default_rng(seed)
    n = int(SR * dur)
    t = np.arange(n) / SR
    noise = rng.normal(0, 1, n)
    # crude high-pass: difference of the noise
    hp = np.diff(noise, prepend=0)
    return hp * np.exp(-t * 9) * amp


def reverb(x, secs=1.6, wet=0.22, seed=7):
    rng = np.random.default_rng(seed)
    n = int(SR * secs)
    t = np.arange(n) / SR
    ir = rng.normal(0, 1, n) * np.exp(-t * 4.2)
    ir /= np.sqrt((ir ** 2).sum())
    size = len(x) + n
    nfft = 1 << (size - 1).bit_length()
    wetsig = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[: len(x)]
    return x * (1 - wet) + wetsig * wet * 1.6


def main(src, dst):
    d = json.load(open(src))
    total = d['duration'] + 1.0
    L = np.zeros(int(SR * total) + SR * 2)
    R = np.zeros_like(L)

    def add(sig, t, pan=0.0):
        i = int(t * SR)
        j = min(len(L), i + len(sig))
        if i >= len(L):
            return
        L[i:j] += sig[: j - i] * (1 - pan) ** 0.5
        R[i:j] += sig[: j - i] * (1 + pan) ** 0.5

    events = [(b['t'], 'b', b) for b in d['bounces']] + [(b['t'], 'x', b) for b in d['breaks']]
    events.sort(key=lambda e: e[0])
    note_i = 0
    last_t = -1
    for t, kind, e in events:
        if t - last_t < 0.045:          # merge near-simultaneous hits into one note
            continue
        last_t = t
        m = FUR_ELISE[note_i % len(FUR_ELISE)]
        note_i += 1
        vel = 0.75 + 0.25 * min(1, e.get('speed', 1200) / 1600)
        add(piano(m, 1.8, vel), t, pan=np.sin(note_i * 0.7) * 0.25)
        if kind == 'x':
            add(piano(m - 24, 2.4, 0.55), t)
            add(bell(hz(m + 12), 1.0, 0.05), t, pan=0.3)
            add(shimmer(0.45, 0.035, seed=note_i), t)

    if d['escapedAt']:
        te = d['escapedAt']
        for k, m in enumerate([57, 64, 69, 72, 76, 81]):      # A minor spread, arpeggiated
            add(piano(m, 3.5, 0.9), te + 0.06 * k, pan=(k - 2.5) * 0.12)
        add(shimmer(1.4, 0.06, seed=99), te)
        add(bell(hz(88), 2.5, 0.06), te + 0.35)

    mix = np.stack([reverb(L), reverb(R, seed=8)], axis=1)
    mix = mix[: int(SR * total)]
    fade = int(SR * 0.8)
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    peak = np.abs(mix).max()
    mix = mix / peak * 0.89
    sf.write(dst, mix.astype(np.float32), SR, subtype='PCM_16')
    rms = np.sqrt((mix ** 2).mean())
    print(f'{dst}: {len(mix) / SR:.1f}s, notes {note_i}, rms {20 * np.log10(rms):.1f} dBFS')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
