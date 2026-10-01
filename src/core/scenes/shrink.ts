import { Random } from '../random.js';
import { hypot, round, TAU } from '../math.js';
export function run(seed: number) {
  const rng = new Random(seed), a = rng.uniform(0, TAU);
  let x = 0, y = 0, vx = 1500 * Math.cos(a), vy = 1500 * Math.sin(a), R = 470, t = 0;
  const dt = 1 / (60 * 12), frames: number[][] = [], bounces: {t: number; n: number; ax: number; ay: number; R: number}[] = [];
  let squeezed: number | null = null;
  while (squeezed === null || t < squeezed + 3.6) {
    for (let sub = 0; sub < 12; sub++) {
      t += dt;
      if (t < 2.4 || squeezed !== null) continue;
      x += vx * dt; y += vy * dt;
      const d = hypot(x, y);
      if (d + 24 >= R) {
        const nx = x / d, ny = y / d, vn = vx * nx + vy * ny;
        if (vn > 0) {
          vx -= 2 * vn * nx; vy -= 2 * vn * ny;
          const sp = Math.min(2500, hypot(vx, vy) * 1.003), k = sp / hypot(vx, vy);
          vx *= k; vy *= k; R *= 0.985;
          bounces.push({ t: round(t, 4), n: bounces.length + 1, ax: round(nx * R, 1), ay: round(ny * R, 1), R: round(R, 2) });
          const lim = R - 24 - 0.5;
          if (hypot(x, y) > lim) { x = nx * lim; y = ny * lim; }
          if (R < 24 * 1.7) { squeezed = round(t, 4); break; }
        }
      }
    }
    frames.push([round(x + 540, 1), round(y + 1020, 1), round(R, 2)]);
  }
  return { cx: 540, cy: 1020, R0: 470, ballR: 24, t0: 2.4, squeezed, frames, bounces };
}
