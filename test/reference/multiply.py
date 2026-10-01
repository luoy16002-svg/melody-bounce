"""'Every bounce spawns a new ball' inside a circle with a rotating gap.

Balls do not collide with each other (classic format). Every wall bounce spawns a ball
(up to MAX_BALLS) and is a candidate music hit. Balls that leave through the gap fall away.
Writes out/<name>.json: per-frame positions of live balls, spawn/escape events, hits.

Usage: python sim/multiply.py <seed> [name]
"""
import json, math, random, sys

FPS, SUB = 60, 6
W, H = 1080, 1920
CX, CY = W / 2, H / 2 + 40
R = 430           # arena radius
BALL_R = 13
G = 1300.0
GAP = 0.26        # gap half-width at t=0 (rad)
GAP_GROW = 0.035  # gap widens over time so the finale drains
SPAWN_P = 0.22    # chance that a bounce spawns a ball
SPIN = 0.9        # gap rotation speed (rad/s)
MAX_BALLS = 200
MAX_SPAWN = 200
MAX_T = 45.0


def run(seed):
    rng = random.Random(seed)
    balls = [{'id': 0, 'x': 0.0, 'y': 0.0, 'vx': 300.0, 'vy': 200.0, 'alive': True, 'hue': 0, 'born': 0.0, 'out': None}]
    hits, escapes, frames = [], [], []
    next_id, t, dt = 1, 0.0, 1 / (FPS * SUB)
    while t < MAX_T:
        for _ in range(SUB):
            t += dt
            rot = -math.pi / 2 + SPIN * t
            new = []
            for b in balls:
                if b['out'] is not None:
                    b['vy'] += G * dt; b['x'] += b['vx'] * dt; b['y'] += b['vy'] * dt
                    continue
                b['vy'] += G * dt
                b['x'] += b['vx'] * dt; b['y'] += b['vy'] * dt
                d = math.hypot(b['x'], b['y'])
                if d + BALL_R >= R:
                    theta = math.atan2(b['y'], b['x'])
                    phi = (theta - rot + math.pi) % math.tau - math.pi
                    gap_now = GAP + GAP_GROW * max(0.0, t - 8.0)
                    if abs(phi) < gap_now - BALL_R / R:
                        b['out'] = round(t, 4)
                        escapes.append({'t': round(t, 4), 'id': b['id']})
                        continue
                    nx, ny = b['x'] / d, b['y'] / d
                    vn = b['vx'] * nx + b['vy'] * ny
                    if vn > 0:
                        b['vx'] -= 2 * vn * nx; b['vy'] -= 2 * vn * ny
                        sp = math.hypot(b['vx'], b['vy']); target = min(1400, max(650, sp))
                        k = rng.uniform(-0.08, 0.08); c, s = math.cos(k), math.sin(k)
                        b['vx'], b['vy'] = (b['vx'] * c - b['vy'] * s) * target / sp, (b['vx'] * s + b['vy'] * c) * target / sp
                        hits.append({'t': round(t, 4), 'x': round(b['x'], 1), 'y': round(b['y'], 1), 'id': b['id']})
                        alive = sum(1 for q in balls if q['out'] is None) + len(new)
                        if alive < MAX_BALLS and next_id < MAX_SPAWN and rng.random() < (1.0 if alive < 24 else SPAWN_P):
                            a = rng.uniform(0, math.tau)
                            new.append({'id': next_id, 'x': b['x'] * 0.92, 'y': b['y'] * 0.92, 'vx': math.cos(a) * 520, 'vy': math.sin(a) * 520,
                                        'alive': True, 'hue': (next_id * 23) % 360, 'born': round(t, 4), 'out': None})
                            next_id += 1
                    pen = d + BALL_R - R
                    b['x'] -= nx * pen; b['y'] -= ny * pen
            balls += new
            # drop balls that have fallen well off screen
            balls = [b for b in balls if b['out'] is None or b['y'] < 1500]
        frames.append([[b['id'], round(b['x'], 1), round(b['y'], 1), 1 if b['out'] is not None else 0] for b in balls])
        alive = sum(1 for b in balls if b['out'] is None)
        if alive == 0 and escapes:
            break
    return {'seed': seed, 'fps': FPS, 'cx': CX, 'cy': CY, 'R': R, 'ballR': BALL_R, 'gap': GAP, 'gapGrow': GAP_GROW, 'spin': SPIN,
            'frames': frames, 'hits': hits, 'escapes': escapes, 'duration': len(frames) / FPS, 'spawned': next_id}


if __name__ == '__main__':
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    name = sys.argv[2] if len(sys.argv) > 2 else f'multiply-{seed}'
    out = run(seed)
    json.dump(out, open(f'out/{name}.json', 'w'), separators=(',', ':'))
    peak = max(len([b for b in f if not b[3]]) for f in out['frames'])
    print(f"seed {seed}: {out['duration']:.1f}s, spawned {out['spawned']}, escaped {len(out['escapes'])}, peak alive {peak}, hits {len(out['hits'])}")
