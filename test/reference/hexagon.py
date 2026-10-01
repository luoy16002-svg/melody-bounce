"""'Spinning hexagon': the ball-in-a-spinning-hexagon test, with gravity and friction and a gap in one side.
The walls push the ball as they turn (the wall's own velocity goes into every bounce). The spin speeds up a
little with every bounce; the ball leaves when it finds the gap. Writes out/<name>.json with per-frame ball
position and hexagon angle and every bounce.

Picking a seed: `python sim/hexagon.py search` prints seeds whose escape falls between 22 and 30 s.
Usage: python sim/hexagon.py <seed> [name]
"""
import json
import math
import random
import sys

FPS, SUB = 60, 16
W, H = 1080, 1920
CX, CY = W / 2, H / 2 + 40
RV = 430.0            # centre to vertex
BALL_R = 22
G = 1400.0            # gravity, px/s^2
E, FRIC = 0.98, 0.02  # restitution, tangential friction
OMEGA0, OMEGA_UP, OMEGA_MAX = 1.3, 0.01, 3.0  # rad/s, +x per bounce
GAP_SIDE, GAP = 0, 0.16  # side 0 has a gap: the middle 16 % of that edge is open
VCAP, VMIN = 2600.0, 1050.0  # every bounce leaves the ball at least this lively
T0, AFTER = 2.4, 3.6


def corners(theta):
    return [(RV * math.cos(theta + k * math.pi / 3), RV * math.sin(theta + k * math.pi / 3)) for k in range(6)]


def run(seed, limit=40.0):
    rng = random.Random(seed)
    x, y = rng.uniform(-80, 80), -120.0
    vx, vy = rng.uniform(-500, 500), 0.0
    theta, omega = rng.uniform(0, math.tau), OMEGA0
    frames, bounces = [], []
    t, dt = 0.0, 1 / (FPS * SUB)
    escaped = None
    while t < limit and (escaped is None or t < escaped + AFTER):
        for _ in range(SUB):
            t += dt
            if t < T0:
                continue
            theta += omega * dt
            vy += G * dt
            x += vx * dt
            y += vy * dt
            if escaped is not None:
                continue
            cs = corners(theta)
            for k in range(6):
                (x1, y1), (x2, y2) = cs[k], cs[(k + 1) % 6]
                ex, ey = x2 - x1, y2 - y1
                L = math.hypot(ex, ey)
                ux, uy = ex / L, ey / L
                nx, ny = uy, -ux                       # outward normal (corners go counter-clockwise)
                if nx * (x1) + ny * (y1) < 0:
                    nx, ny = -nx, -ny
                s = (x - x1) * ux + (y - y1) * uy     # position along the edge
                dist = (x - x1) * nx + (y - y1) * ny  # signed distance, negative inside
                if dist > -BALL_R and -BALL_R * 2 < dist and -BALL_R < s < L + BALL_R:
                    if k == GAP_SIDE and abs(s / L - 0.5) < GAP / 2:
                        if dist > 0:
                            escaped = round(t, 4)
                        continue
                    wvx, wvy = -omega * y, omega * x   # wall velocity at the contact point
                    rvx, rvy = vx - wvx, vy - wvy
                    rn = rvx * nx + rvy * ny
                    if rn > 0:
                        rtx, rty = rvx - rn * nx, rvy - rn * ny
                        rvx, rvy = -E * rn * nx + (1 - FRIC) * rtx, -E * rn * ny + (1 - FRIC) * rty
                        vx, vy = rvx + wvx, rvy + wvy
                        sp = math.hypot(vx, vy)
                        if rn > 100 and sp < VMIN:
                            vx, vy = vx * VMIN / sp, vy * VMIN / sp
                        elif sp > VCAP:
                            vx, vy = vx * VCAP / sp, vy * VCAP / sp
                        x -= (dist + BALL_R) * nx
                        y -= (dist + BALL_R) * ny
                        if rn > 100 and (not bounces or t - bounces[-1]['t'] > 0.05):  # a real bounce, not rolling contact
                            omega = min(OMEGA_MAX, omega * (1 + OMEGA_UP))
                            bounces.append({'t': round(t, 4), 'n': len(bounces) + 1, 'side': k, 'x': round(x, 1), 'y': round(y, 1), 'v': round(math.hypot(vx, vy))})
        frames.append([round(x + CX, 1), round(y + CY, 1), round(theta, 5)])
    return {'cx': CX, 'cy': CY, 'rv': RV, 'ballR': BALL_R, 'gapSide': GAP_SIDE, 'gap': GAP, 't0': T0,
            'escaped': escaped, 'frames': frames, 'bounces': bounces}


if __name__ == '__main__':
    if sys.argv[1] == 'search':
        n = 0
        for seed in range(1, 300):
            d = run(seed)
            if d['escaped'] and 22 <= d['escaped'] <= 30 and len(d['bounces']) >= 60:
                print(seed, d['escaped'], len(d['bounces']))
                n += 1
                if n >= 12:
                    break
    else:
        seed = int(sys.argv[1])
        name = sys.argv[2] if len(sys.argv) > 2 else f'hexagon-{seed}'
        d = run(seed)
        json.dump(d, open(f'out/{name}.json', 'w'))
        print(name, 'escaped at', d['escaped'], 'bounces', len(d['bounces']))
