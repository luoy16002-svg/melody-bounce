"""Deterministic 'ball escapes spinning rings' simulation.

Writes out/<name>.json with per-frame ball state, ring parameters (rotation is analytic),
ring break times and bounce events. Rendering and audio read this file, so every sound
lines up exactly with a collision.

Usage: python sim/escape.py <seed> [name]
"""
import json
import math
import random
import sys

FPS = 60
SUB = 8                    # physics substeps per frame
W, H = 1080, 1920
CX, CY = W / 2, H / 2 + 60
BALL_R = 20
G = 1750.0                 # gravity px/s^2
MAX_T = 62.0


def make_rings(rng, n=22):
    rings = []
    r0, step = 150, 30
    for i in range(n):
        R = r0 + i * step
        gap = max(0.34, 0.66 - i * 0.012)          # gap half-width (rad): wide inside, tighter outside
        speed = (0.55 + 0.45 * rng.random()) * (1 if i % 2 == 0 else -1) * (1.0 + i * 0.015)
        rings.append({'R': R, 'gap': gap, 'a0': rng.random() * math.tau, 'w': speed, 'hue': (i * 360 / n) % 360, 'broken': None})
    return rings


def run(seed):
    rng = random.Random(seed)
    rings = make_rings(rng)
    x, y = 0.0, 0.0                      # ball position relative to the centre
    ang = rng.uniform(0, math.tau)
    vx, vy = math.cos(ang) * 520, math.sin(ang) * 520
    frames, bounces, breaks = [], [], []
    t, dt = 0.0, 1.0 / (FPS * SUB)
    k = 0                                 # innermost ring still standing
    escaped_at = None
    while t < MAX_T:
        for _ in range(SUB):
            vy += G * dt
            x += vx * dt
            y += vy * dt
            t += dt
            if k >= len(rings):
                continue
            ring = rings[k]
            d = math.hypot(x, y)
            inner = ring['R'] - 6
            if d + BALL_R >= inner:
                theta = math.atan2(y, x)
                rot = ring['a0'] + ring['w'] * t
                phi = (theta - rot + math.pi) % math.tau - math.pi
                margin = ring['gap'] - (BALL_R / ring['R']) * 0.9
                outward = (x * vx + y * vy) > 0
                if abs(phi) < margin and outward:
                    if d - BALL_R > ring['R'] + 6:           # fully through the gap
                        ring['broken'] = round(t, 4)
                        breaks.append({'t': round(t, 4), 'ring': k})
                        k += 1
                        if k >= len(rings):
                            escaped_at = t
                    continue
                if abs(phi) < margin:
                    continue
                # bounce off the ring wall
                nx, ny = x / d, y / d
                vn = vx * nx + vy * ny
                if vn > 0:
                    vx -= 2 * vn * nx
                    vy -= 2 * vn * ny
                    # keep it lively: restore speed, add a tiny tangential kick
                    sp = math.hypot(vx, vy)
                    target = min(1700, max(900, sp * 1.02))
                    kick = rng.uniform(-0.06, 0.06)
                    c, s = math.cos(kick), math.sin(kick)
                    vx, vy = (vx * c - vy * s) * target / sp, (vx * s + vy * c) * target / sp
                    bounces.append({'t': round(t, 4), 'ring': k, 'speed': round(target)})
                # push back inside the wall
                pen = d + BALL_R - inner
                x -= nx * pen
                y -= ny * pen
        frames.append([round(x, 2), round(y, 2)])
        if escaped_at is not None and t > escaped_at + 3.0:
            break
    return {'seed': seed, 'fps': FPS, 'w': W, 'h': H, 'cx': CX, 'cy': CY, 'ballR': BALL_R,
            'rings': rings, 'frames': frames, 'bounces': bounces, 'breaks': breaks,
            'escapedAt': escaped_at, 'duration': len(frames) / FPS}


if __name__ == '__main__':
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    name = sys.argv[2] if len(sys.argv) > 2 else f'escape-{seed}'
    out = run(seed)
    json.dump(out, open(f'out/{name}.json', 'w'))
    print(f"seed {seed}: duration {out['duration']:.1f}s, escaped {out['escapedAt']}, rings broken {len(out['breaks'])}/{len(out['rings'])}, bounces {len(out['bounces'])}")
