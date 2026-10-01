import { Random } from '../random.js';
import { hypot, round, mod, TAU } from '../math.js';
export function run(seed: number) {
  const rng = new Random(seed);
  const balls = [-1, 1].map(side => {
    const a = rng.uniform(0, TAU);
    return { x: side * 130, y: rng.uniform(-60, 60), vx: 1250 * Math.cos(a), vy: 1250 * Math.sin(a) };
  });
  const owner = Array<number>(72).fill(-1), frames: number[][] = [];
  const bounces: {t: number; who: number; seg: number; ax: number; ay: number}[] = [], clashes: {t: number; x: number; y: number}[] = [];
  let t = 0;
  const dt = 1 / (60 * 12), end = 2.4 + 30;
  while (t < end + 3.7) {
    for (let sub = 0; sub < 12; sub++) {
      t += dt;
      if (2.4 <= t && t < end) {
        for (const b of balls) { b.x += b.vx * dt; b.y += b.vy * dt; }
        for (const [i, b] of balls.entries()) {
          const d = hypot(b.x, b.y);
          if (d + 26 >= 440) {
            const nx = b.x / d, ny = b.y / d, vn = b.vx * nx + b.vy * ny;
            if (vn > 0) {
              b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny;
              const sp = Math.min(2300, hypot(b.vx, b.vy) * 1.004), k = sp / hypot(b.vx, b.vy);
              b.vx *= k; b.vy *= k;
              const ang = Math.atan2(ny, nx), s = Math.trunc((mod(ang, TAU) / TAU) * 72) % 72;
              for (let j = -2; j <= 2; j++) owner[mod(s + j, 72)] = i;
              bounces.push({ t: round(t, 4), who: i, seg: s, ax: round(nx * 440, 1), ay: round(ny * 440, 1) });
            }
          }
        }
        const [a, b] = balls, dx = b.x - a.x, dy = b.y - a.y, dist = hypot(dx, dy);
        if (dist < 2 * 26 && dist > 1e-6) {
          const nx = dx / dist, ny = dy / dist, rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (rel > 0) {
            a.vx -= rel * nx; a.vy -= rel * ny; b.vx += rel * nx; b.vy += rel * ny;
            clashes.push({ t: round(t, 4), x: round((a.x + b.x) / 2, 1), y: round((a.y + b.y) / 2, 1) });
          }
        }
      }
    }
    frames.push([round(balls[0].x + 540, 1), round(balls[0].y + 1020, 1), round(balls[1].x + 540, 1), round(balls[1].y + 1020, 1)]);
  }
  return { cx: 540, cy: 1020, R: 440, ballR: 26, seg: 72, paint: 2, t0: 2.4, end, frames, bounces, clashes, final: [owner.filter(o => o === 0).length, owner.filter(o => o === 1).length] };
}
