"""'4 balls, 1 exit': four coloured balls under gravity inside a ring with one small rotating gap.
Balls collide with the wall and with each other. The first ball through the gap wins.
Near-misses (a wall hit just beside the gap) are recorded for on-screen call-outs.

Usage: python sim/race.py <seed> [name]
"""
import json, math, random, sys

FPS, SUB = 60, 10
W, H = 1080, 1920
CX, CY = W / 2, H / 2 + 60
R = 430
BALL_R = 34
G = 1400.0
GAP = 0.15          # half-width of the exit (rad)
SPIN = 0.55         # exit rotation speed (rad/s)
VMIN, VMAX = 780.0, 1250.0
NEAR = 0.11         # a wall hit within this much of the gap edge counts as a near miss
MAX_T = 40.0
COLORS = ['red', 'blue', 'green', 'yellow']


def run(seed):
    rng = random.Random(seed)
    balls = []
    for i in range(4):
        a = -math.pi / 2 + (i - 1.5) * 0.5
        balls.append({'x': math.cos(a) * 150, 'y': math.sin(a) * 150 + 60, 'vx': rng.uniform(-420, 420), 'vy': rng.uniform(-200, 200), 'out': None})
    hits, near, clacks, frames = [], [], [], []
    t, dt = 0.0, 1 / (FPS * SUB)
    winner, win_t = None, None
    while t < MAX_T:
        for _ in range(SUB):
            t += dt
            rot = SPIN * t
            for i, b in enumerate(balls):
                b['vy'] += G * dt
                b['x'] += b['vx'] * dt; b['y'] += b['vy'] * dt
                if b['out'] is not None:
                    continue
                d = math.hypot(b['x'], b['y'])
                theta = math.atan2(b['y'], b['x'])
                phi = (theta - rot + math.pi) % math.tau - math.pi   # angle from the exit centre
                if winner is None and d > R + BALL_R:
                    b['out'] = round(t, 4); winner, win_t = i, round(t, 4)
                    continue
                if d + BALL_R >= R and not (abs(phi) < GAP - BALL_R / R * 0.9):
                    nx, ny = b['x'] / d, b['y'] / d
                    vn = b['vx'] * nx + b['vy'] * ny
                    if vn > 0 and d < R + 2:
                        b['vx'] -= 2 * vn * nx; b['vy'] -= 2 * vn * ny
                        sp = math.hypot(b['vx'], b['vy']); target = min(VMAX, max(VMIN, sp))
                        k = rng.uniform(-0.12, 0.12); c, s = math.cos(k), math.sin(k)
                        b['vx'], b['vy'] = (b['vx'] * c - b['vy'] * s) * target / sp, (b['vx'] * s + b['vy'] * c) * target / sp
                        hits.append({'t': round(t, 4), 'ball': i, 'x': round(b['x'], 1), 'y': round(b['y'], 1)})
                        if GAP <= abs(phi) < GAP + NEAR:
                            near.append({'t': round(t, 4), 'ball': i, 'x': round(b['x'], 1), 'y': round(b['y'], 1)})
                        pen = d + BALL_R - R
                        if pen > 0:
                            b['x'] -= nx * pen; b['y'] -= ny * pen
            # ball-ball collisions (equal mass, elastic)
            for i in range(4):
                for j in range(i + 1, 4):
                    a, b = balls[i], balls[j]
                    if a['out'] is not None or b['out'] is not None:
                        continue
                    dx, dy = b['x'] - a['x'], b['y'] - a['y']
                    dist = math.hypot(dx, dy)
                    if 0 < dist < 2 * BALL_R:
                        nx, ny = dx / dist, dy / dist
                        rel = (a['vx'] - b['vx']) * nx + (a['vy'] - b['vy']) * ny
                        if rel > 0:
                            a['vx'] -= rel * nx; a['vy'] -= rel * ny
                            b['vx'] += rel * nx; b['vy'] += rel * ny
                            clacks.append({'t': round(t, 4), 'x': round((a['x'] + b['x']) / 2, 1), 'y': round((a['y'] + b['y']) / 2, 1), 'a': i, 'b': j})
                        push = (2 * BALL_R - dist) / 2
                        a['x'] -= nx * push; a['y'] -= ny * push; b['x'] += nx * push; b['y'] += ny * push
        frames.append([[round(b['x'], 1), round(b['y'], 1)] for b in balls])
        if win_t is not None and t > win_t + 1.5:
            break
    return {'seed': seed, 'fps': FPS, 'cx': CX, 'cy': CY, 'R': R, 'ballR': BALL_R, 'gap': GAP, 'spin': SPIN, 'colors': COLORS,
            'frames': frames, 'hits': hits, 'near': near, 'clacks': clacks, 'winner': winner, 'winAt': win_t, 'duration': len(frames) / FPS}


if __name__ == '__main__':
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    name = sys.argv[2] if len(sys.argv) > 2 else f'race-{seed}'
    out = run(seed)
    json.dump(out, open(f'out/{name}.json', 'w'), separators=(',', ':'))
    w = COLORS[out['winner']] if out['winner'] is not None else None
    print(f"seed {seed}: winner {w} at {out['winAt']}s, near misses {len(out['near'])}, clacks {len(out['clacks'])}, hits {len(out['hits'])}")
