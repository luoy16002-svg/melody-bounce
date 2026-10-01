"""'The ring shrinks every bounce': a ball inside a ring, no gravity. Each wall bounce shrinks the ring by
1.5 %, so the bounces come faster and faster until the ring is too small for the ball and it is squeezed.
Writes out/<name>.json with per-frame ball position and ring radius and every bounce.

Usage: python sim/shrink.py <seed> [name]
"""
import json
import math
import random
import sys

FPS, SUB = 60, 12
W, H = 1080, 1920
CX, CY = W / 2, H / 2 + 60
R0 = 470.0
BALL_R = 24
SHRINK = 0.985
V0, VCAP = 1500.0, 2500.0
T0 = 2.4
AFTER = 3.6


def run(seed):
    rng = random.Random(seed)
    x, y = 0.0, 0.0
    a = rng.uniform(0, math.tau)
    vx, vy = V0 * math.cos(a), V0 * math.sin(a)
    R = R0
    frames, bounces = [], []
    t, dt = 0.0, 1 / (FPS * SUB)
    squeezed = None
    while squeezed is None or t < squeezed + AFTER:
        for _ in range(SUB):
            t += dt
            if t < T0 or squeezed is not None:
                continue
            x += vx * dt
            y += vy * dt
            d = math.hypot(x, y)
            if d + BALL_R >= R:
                nx, ny = x / d, y / d
                vn = vx * nx + vy * ny
                if vn > 0:
                    vx -= 2 * vn * nx
                    vy -= 2 * vn * ny
                    sp = min(VCAP, math.hypot(vx, vy) * 1.003)
                    k = sp / math.hypot(vx, vy)
                    vx *= k
                    vy *= k
                    R *= SHRINK
                    bounces.append({'t': round(t, 4), 'n': len(bounces) + 1, 'ax': round(nx * R, 1), 'ay': round(ny * R, 1), 'R': round(R, 2)})
                    # keep the ball inside the smaller ring
                    lim = R - BALL_R - 0.5
                    if math.hypot(x, y) > lim:
                        x, y = nx * lim, ny * lim
                    if R < BALL_R * 1.7:
                        squeezed = round(t, 4)
                        break
        frames.append([round(x + CX, 1), round(y + CY, 1), round(R, 2)])
    return {'cx': CX, 'cy': CY, 'R0': R0, 'ballR': BALL_R, 't0': T0, 'squeezed': squeezed, 'frames': frames, 'bounces': bounces}


if __name__ == '__main__':
    seed = int(sys.argv[1])
    name = sys.argv[2] if len(sys.argv) > 2 else f'shrink-{seed}'
    d = run(seed)
    json.dump(d, open(f'out/{name}.json', 'w'))
    print(name, 'bounces', len(d['bounces']), 'squeezed at', d['squeezed'])
