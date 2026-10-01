"""'Every bounce ties a string': a ball inside a ring, no gravity. Each wall bounce anchors a string
from the contact point to the ball and speeds the ball up. On bounce N_BREAK the ring snaps and
the ball flies out. Writes out/<name>.json with per-frame ball positions and every bounce/anchor.

Usage: python sim/strings.py <seed> [name]
"""
import json, math, random, sys

FPS, SUB = 60, 12
W, H = 1080, 1920
CX, CY = W / 2, H / 2 + 60
R = 440            # inner edge of the ring
BALL_R = 20
N_BREAK = 100
V0, GROW, VCAP = 1100.0, 1.022, 6000.0
P_MIN, P_MAX = 0.55, 0.8   # keep the path's distance from the centre in this band (x R): star-shaped string art
AFTER = 1.2        # seconds simulated after the break


def run(seed):
    rng = random.Random(seed)
    x, y = 0.0, 0.66 * R
    v = V0
    vx, vy = rng.choice([-1, 1]) * v, 0.0
    bounces, frames = [], []
    t, dt = 0.0, 1 / (FPS * SUB)
    broke = None
    while True:
        for _ in range(SUB):
            t += dt
            x += vx * dt; y += vy * dt
            d = math.hypot(x, y)
            if broke is None and d + BALL_R >= R:
                nx, ny = x / d, y / d
                vn = vx * nx + vy * ny
                if vn > 0:
                    n = len(bounces) + 1
                    bounces.append({'t': round(t, 4), 'ax': round(nx * R, 1), 'ay': round(ny * R, 1), 'n': n, 'v': round(v)})
                    if n >= N_BREAK:
                        broke = round(t, 4)       # the ring snaps; keep flying straight out
                        continue
                    vx -= 2 * vn * nx; vy -= 2 * vn * ny
                    # small random deflection so the pattern never repeats, but never skim the wall
                    bx, by = vx, vy
                    for _try in range(40):
                        k = rng.uniform(-0.18, 0.18)
                        c, s = math.cos(k), math.sin(k)
                        vx, vy = bx * c - by * s, bx * s + by * c
                        p = abs(x * vy - y * vx) / math.hypot(vx, vy)
                        if P_MIN * R <= p <= P_MAX * R and (vx * nx + vy * ny) < 0:
                            break
                    v = min(VCAP, v * GROW)
                    sp = math.hypot(vx, vy); vx, vy = vx * v / sp, vy * v / sp
                    pen = d + BALL_R - R
                    x -= nx * pen; y -= ny * pen
        frames.append([round(x, 1), round(y, 1), len(bounces)])
        if broke is not None and t > broke + AFTER:
            break
        if t > 90:
            break
    return {'seed': seed, 'fps': FPS, 'cx': CX, 'cy': CY, 'R': R, 'ballR': BALL_R, 'nBreak': N_BREAK,
            'frames': frames, 'bounces': bounces, 'breakAt': broke, 'duration': len(frames) / FPS}


if __name__ == '__main__':
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    name = sys.argv[2] if len(sys.argv) > 2 else f'strings-{seed}'
    out = run(seed)
    json.dump(out, open(f'out/{name}.json', 'w'), separators=(',', ':'))
    b = out['bounces']
    g = [b[i + 1]['t'] - b[i]['t'] for i in range(len(b) - 1)]
    print(f"seed {seed}: break {out['breakAt']}s, first gap {g[0]:.2f}, max gap {max(g):.2f}, last-10 mean {sum(g[-10:]) / 10:.3f}, halfway {b[49]['t']:.1f}s")
