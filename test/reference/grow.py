"""'Every bounce, the ball grows' inside a circle until it fills it.

One ball under gravity bounces inside a ring. Each wall bounce grows it by DR pixels, so the free
space shrinks and the bounces (and the music) speed up on their own. Ends when the ball fills the ring.
Writes out/<name>.json: per-frame [x, y, r, bounces], bounce events with contact normals, fill time.

Usage: python sim/grow.py <seed> [name]
"""
import json, math, random, sys

FPS, SUB = 60, 10
W, H = 1080, 1920
CX, CY = W / 2, H / 2 + 60
R = 440            # arena radius (inner edge)
R0 = 26            # starting ball radius
DR = 5.0           # growth per bounce
DR_EARLY = 8.0     # faster growth while the ball is small, so the first seconds pay off
END_GAP = 2.5      # considered full when R - r <= END_GAP
G = 2200.0
VMIN, VMAX = 1450.0, 1800.0
MAX_T = 60.0


def run(seed):
    rng = random.Random(seed)
    x, y, r = 0.0, 120.0, float(R0)
    vx, vy = rng.choice([-1, 1]) * rng.uniform(380, 900), rng.uniform(500, 950)
    bounces, frames = [], []
    t, dt, n = 0.0, 1 / (FPS * SUB), 0
    fill = None
    while t < MAX_T and fill is None:
        for _ in range(SUB):
            t += dt
            vy += G * dt
            x += vx * dt; y += vy * dt
            d = math.hypot(x, y)
            if d + r >= R:
                nx, ny = x / d, y / d
                vn = vx * nx + vy * ny
                if vn > 0:
                    vx -= 2 * vn * nx; vy -= 2 * vn * ny
                    sp = math.hypot(vx, vy)
                    free = R - r
                    target = min(VMAX, max(VMIN, sp)) * (0.26 + 0.74 * min(1.0, free / 260)) * (1.22 if r < 150 else 1.0)
                    k = rng.uniform(-0.22, 0.22)
                    c, s = math.cos(k), math.sin(k)
                    vx, vy = (vx * c - vy * s) * target / sp, (vx * s + vy * c) * target / sp
                    # never let the post-bounce velocity skim the wall
                    if vx * nx + vy * ny > -0.35 * target:
                        vx -= 0.5 * target * nx; vy -= 0.5 * target * ny
                        sp = math.hypot(vx, vy); vx, vy = vx * target / sp, vy * target / sp
                    n += 1
                    r = min(R - END_GAP, r + min(DR_EARLY if r < 150 else DR, max(0.9, 0.05 * (R - r))))
                    bounces.append({'t': round(t, 4), 'x': round(x + nx * r, 1), 'y': round(y + ny * r, 1),
                                    'nx': round(nx, 4), 'ny': round(ny, 4), 'n': n, 'r': round(r, 2),
                                    'speed': round(target)})
                    if R - r <= END_GAP + 1e-6:
                        fill = round(t, 4)
                pen = d + r - R
                if pen > 0:
                    x -= nx * pen; y -= ny * pen
            if fill is not None:
                break
        frames.append([round(x, 1), round(y, 1), round(r, 2), n])
    return {'seed': seed, 'fps': FPS, 'cx': CX, 'cy': CY, 'R': R, 'r0': R0, 'dr': DR,
            'frames': frames, 'bounces': bounces, 'fillAt': fill, 'count': n, 'duration': len(frames) / FPS}


if __name__ == '__main__':
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    name = sys.argv[2] if len(sys.argv) > 2 else f'grow-{seed}'
    out = run(seed)
    json.dump(out, open(f'out/{name}.json', 'w'), separators=(',', ':'))
    b = out['bounces']
    q = [round(b[min(len(b) - 1, int(len(b) * p))]['t'], 1) for p in (0.25, 0.5, 0.75, 0.9)]
    t85 = next(e['t'] for e in b if (e['r'] / R) ** 2 >= 0.85)
    gaps = [b[i + 1]['t'] - b[i]['t'] for i in range(len(b) - 1)]
    print(f"seed {seed}: fill {out['fillAt']}s, {out['count']} bounces, quartiles {q}, 85% at {t85:.1f}s, first-10 mean gap {sum(gaps[:10]) / 10:.2f}s")
