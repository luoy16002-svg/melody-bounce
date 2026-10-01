import { Random } from '../random.js';
import { hypot, round } from '../math.js';
export function run(seed: number) {
  const rng = new Random(seed);
  let x = 0, y = 120, r = 26, vx = rng.choice([-1, 1]) * rng.uniform(380, 900), vy = rng.uniform(500, 950);
  const frames: number[][] = [], bounces: {t: number; x: number; y: number; nx: number; ny: number; n: number; r: number; speed: number}[] = [];
  let t = 0, n = 0, fillAt: number | null = null;
  const dt = 1 / (60 * 10);
  while (t < 60 && fillAt === null) {
    for (let sub = 0; sub < 10; sub++) {
      t += dt; vy += 2200 * dt; x += vx * dt; y += vy * dt;
      const d = hypot(x, y);
      if (d + r >= 440) {
        const nx = x / d, ny = y / d, vn = vx * nx + vy * ny;
        if (vn > 0) {
          vx -= 2 * vn * nx; vy -= 2 * vn * ny;
          let sp = hypot(vx, vy);
          const free = 440 - r;
          const target = Math.min(1800, Math.max(1450, sp)) * (0.26 + 0.74 * Math.min(1, free / 260)) * (r < 150 ? 1.22 : 1);
          const k = rng.uniform(-0.22, 0.22), c = Math.cos(k), s = Math.sin(k);
          [vx, vy] = [(vx * c - vy * s) * target / sp, (vx * s + vy * c) * target / sp];
          if (vx * nx + vy * ny > -0.35 * target) {
            vx -= 0.5 * target * nx; vy -= 0.5 * target * ny;
            sp = hypot(vx, vy); vx = vx * target / sp; vy = vy * target / sp;
          }
          n++;
          r = Math.min(440 - 2.5, r + Math.min(r < 150 ? 8 : 5, Math.max(0.9, 0.05 * (440 - r))));
          bounces.push({ t: round(t, 4), x: round(x + nx * r, 1), y: round(y + ny * r, 1), nx: round(nx, 4), ny: round(ny, 4), n, r: round(r, 2), speed: round(target) });
          if (440 - r <= 2.5 + 1e-6) fillAt = round(t, 4);
        }
        const pen = d + r - 440;
        if (pen > 0) { x -= nx * pen; y -= ny * pen; }
      }
      if (fillAt !== null) break;
    }
    frames.push([round(x, 1), round(y, 1), round(r, 2), n]);
  }
  return { seed, fps: 60, cx: 540, cy: 1020, R: 440, r0: 26, dr: 5, frames, bounces, fillAt, count: n, duration: frames.length / 60 };
}
