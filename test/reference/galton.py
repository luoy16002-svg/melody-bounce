"""'300 balls, one bell curve': a Galton board. Balls drop every 0.08 s through 12 rows of pegs, going left
or right at random at each peg, and stack in 13 bins. Writes out/<name>.json with every ball's spawn time,
path bits, peg-hit times, bin, stack slot and landing time; the Remotion scene animates from these.

Picking a seed: `python sim/galton.py search` prints seeds whose final histogram is closest to the
binomial curve (and whose middle bin is the tallest).
Usage: python sim/galton.py <seed> [name]
"""
import json
import math
import random
import sys

ROWS, BALLS = 12, 300
T0, EVERY = 2.4, 0.08
DROP, HOP = 0.2, 0.12
PER_ROW = 4          # balls side by side in one bin
BIN_BOTTOM = 1540
BALL_D = 13.5


def run(seed):
    rng = random.Random(seed)
    counts = [0] * (ROWS + 1)
    balls = []
    for b in range(BALLS):
        spawn = T0 + b * EVERY
        bits = [rng.random() < 0.5 for _ in range(ROWS)]
        k = sum(bits)
        slot = counts[k]
        counts[k] += 1
        hits = [round(spawn + DROP + r * HOP, 4) for r in range(ROWS)]
        stack_y = BIN_BOTTOM - (slot // PER_ROW) * BALL_D - BALL_D / 2
        fall = 0.14 + 0.12 * max(0.0, (stack_y - 1176) / 360)
        land = round(hits[-1] + HOP + fall, 4)
        balls.append({'spawn': round(spawn, 4), 'bits': ''.join('1' if x else '0' for x in bits), 'bin': k, 'slot': slot, 'hits': hits, 'land': land})
    return {'rows': ROWS, 'balls': balls, 'counts': counts, 'perRow': PER_ROW, 'binBottom': BIN_BOTTOM, 'ballD': BALL_D,
            'drop': DROP, 'hop': HOP, 't0': T0, 'done': max(b['land'] for b in balls)}


def fit(d):
    n = ROWS
    exp = [BALLS * math.comb(n, k) / 2 ** n for k in range(n + 1)]
    chi = sum((c - e) ** 2 / e for c, e in zip(d['counts'], exp) if e > 0.5)
    middle_top = d['counts'][n // 2] == max(d['counts'])
    return chi, middle_top


if __name__ == '__main__':
    if sys.argv[1] == 'search':
        best = sorted((fit(run(s))[0], s) for s in range(1, 600) if fit(run(s))[1])[:8]
        for chi, s in best:
            print(s, round(chi, 2), run(s)['counts'])
    else:
        seed = int(sys.argv[1])
        name = sys.argv[2] if len(sys.argv) > 2 else f'galton-{seed}'
        d = run(seed)
        json.dump(d, open(f'out/{name}.json', 'w'))
        print(name, d['counts'], 'done at', d['done'], 'chi2', round(fit(d)[0], 2))
