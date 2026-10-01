import { Random } from '../random.js';
import { hypot, mod, round, TAU } from '../math.js';

export function run(seed: number) {
  const rng = new Random(seed);
  const rings = Array.from({ length: 22 }, (_, i) => ({
    R: 150 + i * 30, gap: Math.max(0.34, 0.66 - i * 0.012),
    w: (0.55 + 0.45 * rng.random()) * (i % 2 === 0 ? 1 : -1) * (1 + i * 0.015),
    a0: rng.random() * TAU, hue: mod(i * 360 / 22, 360), broken: null as number | null,
  }));
  let x = 0, y = 0;
  const ang = rng.uniform(0, TAU);
  let vx = Math.cos(ang) * 520, vy = Math.sin(ang) * 520;
  const frames: number[][] = [], bounces: {t: number; ring: number; speed: number}[] = [], breaks: {t: number; ring: number}[] = [];
  let t = 0, k = 0;
  const dt = 1 / (60 * 8);
  let escapedAt: number | null = null;
  while (t < 62) {
    for (let sub = 0; sub < 8; sub++) {
      vy += 1750 * dt; x += vx * dt; y += vy * dt; t += dt;
      if (k >= rings.length) continue;
      const ring = rings[k], d = hypot(x, y), inner = ring.R - 6;
      if (d + 20 >= inner) {
        const phi = mod(Math.atan2(y, x) - (ring.a0 + ring.w * t) + Math.PI, TAU) - Math.PI;
        const margin = ring.gap - (20 / ring.R) * 0.9;
        if (Math.abs(phi) < margin && x * vx + y * vy > 0) {
          if (d - 20 > ring.R + 6) {
            ring.broken = round(t, 4); breaks.push({ t: round(t, 4), ring: k }); k++;
            if (k >= rings.length) escapedAt = t;
          }
          continue;
        }
        if (Math.abs(phi) < margin) continue;
        const nx = x / d, ny = y / d, vn = vx * nx + vy * ny;
        if (vn > 0) {
          vx -= 2 * vn * nx; vy -= 2 * vn * ny;
          const sp = hypot(vx, vy), target = Math.min(1700, Math.max(900, sp * 1.02));
          const kick = rng.uniform(-0.06, 0.06), c = Math.cos(kick), s = Math.sin(kick);
          [vx, vy] = [(vx * c - vy * s) * target / sp, (vx * s + vy * c) * target / sp];
          bounces.push({ t: round(t, 4), ring: k, speed: round(target) });
        }
        const pen = d + 20 - inner; x -= nx * pen; y -= ny * pen;
      }
    }
    frames.push([round(x, 2), round(y, 2)]);
    if (escapedAt !== null && t > escapedAt + 3) break;
  }
  return { seed, fps: 60, w: 1080, h: 1920, cx: 540, cy: 1020, ballR: 20, rings, frames, bounces, breaks, escapedAt, duration: frames.length / 60 };
}
