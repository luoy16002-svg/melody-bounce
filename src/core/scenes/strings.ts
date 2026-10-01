import { Random } from '../random.js';
import { hypot, round } from '../math.js';
export function run(seed: number) {
  const rng = new Random(seed);
  let x = 0, y = 0.66 * 440, v = 1100, vx = rng.choice([-1, 1]) * v, vy = 0, t = 0;
  const dt = 1 / (60 * 12), frames: number[][] = [], bounces: {t: number; ax: number; ay: number; n: number; v: number}[] = [];
  let breakAt: number | null = null;
  while (true) {
    for (let sub = 0; sub < 12; sub++) {
      t += dt; x += vx * dt; y += vy * dt;
      const d = hypot(x, y);
      if (breakAt === null && d + 20 >= 440) {
        const nx = x / d, ny = y / d, vn = vx * nx + vy * ny;
        if (vn > 0) {
          const n = bounces.length + 1;
          bounces.push({ t: round(t, 4), ax: round(nx * 440, 1), ay: round(ny * 440, 1), n, v: round(v) });
          if (n >= 100) { breakAt = round(t, 4); continue; }
          vx -= 2 * vn * nx; vy -= 2 * vn * ny;
          const bx = vx, by = vy;
          for (let attempt = 0; attempt < 40; attempt++) {
            const k = rng.uniform(-0.18, 0.18), c = Math.cos(k), s = Math.sin(k);
            [vx, vy] = [bx * c - by * s, bx * s + by * c];
            const p = Math.abs(x * vy - y * vx) / hypot(vx, vy);
            if (0.55 * 440 <= p && p <= 0.8 * 440 && vx * nx + vy * ny < 0) break;
          }
          v = Math.min(6000, v * 1.022);
          const sp = hypot(vx, vy); vx = vx * v / sp; vy = vy * v / sp;
          const pen = d + 20 - 440; x -= nx * pen; y -= ny * pen;
        }
      }
    }
    frames.push([round(x, 1), round(y, 1), bounces.length]);
    if ((breakAt !== null && t > breakAt + 1.2) || t > 90) break;
  }
  return { seed, fps: 60, cx: 540, cy: 1020, R: 440, ballR: 20, nBreak: 100, frames, bounces, breakAt, duration: frames.length / 60 };
}
