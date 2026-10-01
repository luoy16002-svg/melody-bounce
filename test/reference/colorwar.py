"""'Red vs Blue': two balls inside a ring, no gravity. Every wall bounce paints the five ring segments around
the contact point in the ball's colour; the balls knock each other away when they meet. After 30 s the ring
is counted. Writes out/<name>.json with per-frame positions, every bounce (who, where) and every clash.

Picking a seed: `python sim/colorwar.py search` prints close finishes with late lead changes.
Usage: python sim/colorwar.py <seed> [name]
"""
import json
import math
import random
import sys

FPS, SUB = 60, 12
W, H = 1080, 1920
CX, CY = W / 2, H / 2 + 60
R = 440
BALL_R = 26
SEG = 72
PAINT = 2  # segments either side of the hit
T0, PLAY = 2.4, 30.0
V0, GROW, VCAP = 1250.0, 1.004, 2300.0


def run(seed):
    rng = random.Random(seed)
    balls = []
    for side in (-1, 1):
        a = rng.uniform(0, math.tau)
        balls.append({'x': side * 130.0, 'y': rng.uniform(-60, 60), 'vx': V0 * math.cos(a), 'vy': V0 * math.sin(a)})
    owner = [-1] * SEG
    frames, bounces, clashes = [], [], []
    t, dt = 0.0, 1 / (FPS * SUB)
    end = T0 + PLAY
    while t < end + 3.7:
        for _ in range(SUB):
            t += dt
            moving = T0 <= t < end
            if moving:
                for b in balls:
                    b['x'] += b['vx'] * dt
                    b['y'] += b['vy'] * dt
                for i, b in enumerate(balls):
                    d = math.hypot(b['x'], b['y'])
                    if d + BALL_R >= R:
                        nx, ny = b['x'] / d, b['y'] / d
                        vn = b['vx'] * nx + b['vy'] * ny
                        if vn > 0:
                            b['vx'] -= 2 * vn * nx
                            b['vy'] -= 2 * vn * ny
                            sp = min(VCAP, math.hypot(b['vx'], b['vy']) * GROW)
                            k = sp / math.hypot(b['vx'], b['vy'])
                            b['vx'] *= k
                            b['vy'] *= k
                            ang = math.atan2(ny, nx)
                            s = int(((ang % math.tau) / math.tau) * SEG) % SEG
                            for j in range(-PAINT, PAINT + 1):
                                owner[(s + j) % SEG] = i
                            bounces.append({'t': round(t, 4), 'who': i, 'seg': s, 'ax': round(nx * R, 1), 'ay': round(ny * R, 1)})
                a, b = balls
                dx, dy = b['x'] - a['x'], b['y'] - a['y']
                dist = math.hypot(dx, dy)
                if dist < 2 * BALL_R and dist > 1e-6:
                    nx, ny = dx / dist, dy / dist
                    rel = (a['vx'] - b['vx']) * nx + (a['vy'] - b['vy']) * ny
                    if rel > 0:  # approaching: swap the normal components (equal masses)
                        a['vx'] -= rel * nx
                        a['vy'] -= rel * ny
                        b['vx'] += rel * nx
                        b['vy'] += rel * ny
                        clashes.append({'t': round(t, 4), 'x': round((a['x'] + b['x']) / 2, 1), 'y': round((a['y'] + b['y']) / 2, 1)})
        frames.append([round(balls[0]['x'] + CX, 1), round(balls[0]['y'] + CY, 1), round(balls[1]['x'] + CX, 1), round(balls[1]['y'] + CY, 1)])
    red = sum(1 for o in owner if o == 0)
    blue = sum(1 for o in owner if o == 1)
    return {'cx': CX, 'cy': CY, 'R': R, 'ballR': BALL_R, 'seg': SEG, 'paint': PAINT, 't0': T0, 'end': end,
            'frames': frames, 'bounces': bounces, 'clashes': clashes, 'final': [red, blue]}


def leads(d):
    """Lead changes in the last 10 s and the final margin."""
    owner = [-1] * d['seg']
    last, changes = None, 0
    for b in d['bounces']:
        for j in range(-d['paint'], d['paint'] + 1):
            owner[(b['seg'] + j) % d['seg']] = b['who']
        r, bl = owner.count(0), owner.count(1)
        lead = 0 if r > bl else 1 if bl > r else last
        if lead != last and b['t'] > d['end'] - 10:
            changes += 1
        last = lead
    return changes, abs(d['final'][0] - d['final'][1])


if __name__ == '__main__':
    if sys.argv[1] == 'search':
        found = []
        for seed in range(1, 400):
            d = run(seed)
            ch, margin = leads(d)
            if margin in (1, 2, 3) and ch >= 3:
                found.append((seed, ch, margin, d['final']))
        for f in found[:15]:
            print(f)
    else:
        seed = int(sys.argv[1])
        name = sys.argv[2] if len(sys.argv) > 2 else f'colorwar-{seed}'
        d = run(seed)
        json.dump(d, open(f'out/{name}.json', 'w'))
        print(name, 'final', d['final'], 'bounces', len(d['bounces']), 'clashes', len(d['clashes']), 'leads', leads(d))
