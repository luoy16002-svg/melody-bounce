import { Random } from '../random.js';
import { hypot, round, mod, TAU } from '../math.js';
type Ball = {id: number; x: number; y: number; vx: number; vy: number; alive: boolean; hue: number; born: number; out: number | null};
export function run(seed: number) {
  const rng = new Random(seed);
  let balls: Ball[] = [{ id: 0, x: 0, y: 0, vx: 300, vy: 200, alive: true, hue: 0, born: 0, out: null }];
  const hits: {t: number; x: number; y: number; id: number}[] = [], escapes: {t: number; id: number}[] = [], frames: number[][][] = [];
  let nextId = 1, t = 0;
  const dt = 1 / (60 * 6);
  while (t < 45) {
    for (let sub = 0; sub < 6; sub++) {
      t += dt;
      const rot = -Math.PI / 2 + 0.9 * t, born: Ball[] = [];
      for (const b of balls) {
        if (b.out !== null) { b.vy += 1300 * dt; b.x += b.vx * dt; b.y += b.vy * dt; continue; }
        b.vy += 1300 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
        const d = hypot(b.x, b.y);
        if (d + 13 >= 430) {
          const phi = mod(Math.atan2(b.y, b.x) - rot + Math.PI, TAU) - Math.PI;
          const gapNow = 0.26 + 0.035 * Math.max(0, t - 8);
          if (Math.abs(phi) < gapNow - 13 / 430) { b.out = round(t, 4); escapes.push({ t: round(t, 4), id: b.id }); continue; }
          const nx = b.x / d, ny = b.y / d, vn = b.vx * nx + b.vy * ny;
          if (vn > 0) {
            b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny;
            const sp = hypot(b.vx, b.vy), target = Math.min(1400, Math.max(650, sp));
            const k = rng.uniform(-0.08, 0.08), c = Math.cos(k), s = Math.sin(k);
            [b.vx, b.vy] = [(b.vx * c - b.vy * s) * target / sp, (b.vx * s + b.vy * c) * target / sp];
            hits.push({ t: round(t, 4), x: round(b.x, 1), y: round(b.y, 1), id: b.id });
            const alive = balls.filter(q => q.out === null).length + born.length;
            if (alive < 200 && nextId < 200 && rng.random() < (alive < 24 ? 1 : 0.22)) {
              const a = rng.uniform(0, TAU);
              born.push({ id: nextId, x: b.x * 0.92, y: b.y * 0.92, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, alive: true, hue: (nextId * 23) % 360, born: round(t, 4), out: null });
              nextId++;
            }
          }
          const pen = d + 13 - 430; b.x -= nx * pen; b.y -= ny * pen;
        }
      }
      balls = [...balls, ...born].filter(b => b.out === null || b.y < 1500);
    }
    frames.push(balls.map(b => [b.id, round(b.x, 1), round(b.y, 1), b.out !== null ? 1 : 0]));
    if (balls.every(b => b.out !== null) && escapes.length) break;
  }
  return { seed, fps: 60, cx: 540, cy: 1000, R: 430, ballR: 13, gap: 0.26, gapGrow: 0.035, spin: 0.9, frames, hits, escapes, duration: frames.length / 60, spawned: nextId };
}
