import { Random } from '../random.js';
import { hypot, round, mod, TAU } from '../math.js';
export function run(seed: number) {
  const rng = new Random(seed);
  const balls = Array.from({ length: 4 }, (_, i) => {
    const a = -Math.PI / 2 + (i - 1.5) * 0.5;
    return { x: Math.cos(a) * 150, y: Math.sin(a) * 150 + 60, vx: rng.uniform(-420, 420), vy: rng.uniform(-200, 200), out: null as number | null };
  });
  const hits: {t: number; ball: number; x: number; y: number}[] = [], near: typeof hits = [];
  const clacks: {t: number; x: number; y: number; a: number; b: number}[] = [], frames: number[][][] = [];
  let t = 0, winner: number | null = null, winAt: number | null = null;
  const dt = 1 / (60 * 10);
  while (t < 40) {
    for (let sub = 0; sub < 10; sub++) {
      t += dt;
      const rot = 0.55 * t;
      for (const [i, b] of balls.entries()) {
        b.vy += 1400 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.out !== null) continue;
        const d = hypot(b.x, b.y), phi = mod(Math.atan2(b.y, b.x) - rot + Math.PI, TAU) - Math.PI;
        if (winner === null && d > 430 + 34) { b.out = round(t, 4); winner = i; winAt = round(t, 4); continue; }
        if (d + 34 >= 430 && !(Math.abs(phi) < 0.15 - 34 / 430 * 0.9)) {
          const nx = b.x / d, ny = b.y / d, vn = b.vx * nx + b.vy * ny;
          if (vn > 0 && d < 430 + 2) {
            b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny;
            const sp = hypot(b.vx, b.vy), target = Math.min(1250, Math.max(780, sp));
            const k = rng.uniform(-0.12, 0.12), c = Math.cos(k), s = Math.sin(k);
            [b.vx, b.vy] = [(b.vx * c - b.vy * s) * target / sp, (b.vx * s + b.vy * c) * target / sp];
            const hit = { t: round(t, 4), ball: i, x: round(b.x, 1), y: round(b.y, 1) };
            hits.push(hit);
            if (0.15 <= Math.abs(phi) && Math.abs(phi) < 0.15 + 0.11) near.push({ ...hit });
            const pen = d + 34 - 430;
            if (pen > 0) { b.x -= nx * pen; b.y -= ny * pen; }
          }
        }
      }
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
        const a = balls[i], b = balls[j];
        if (a.out !== null || b.out !== null) continue;
        const dx = b.x - a.x, dy = b.y - a.y, dist = hypot(dx, dy);
        if (0 < dist && dist < 2 * 34) {
          const nx = dx / dist, ny = dy / dist, rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (rel > 0) {
            a.vx -= rel * nx; a.vy -= rel * ny; b.vx += rel * nx; b.vy += rel * ny;
            clacks.push({ t: round(t, 4), x: round((a.x + b.x) / 2, 1), y: round((a.y + b.y) / 2, 1), a: i, b: j });
          }
          const push = (2 * 34 - dist) / 2;
          a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
        }
      }
    }
    frames.push(balls.map(b => [round(b.x, 1), round(b.y, 1)]));
    if (winAt !== null && t > winAt + 1.5) break;
  }
  return { seed, fps: 60, cx: 540, cy: 1020, R: 430, ballR: 34, gap: 0.15, spin: 0.55, colors: ['red', 'blue', 'green', 'yellow'], frames, hits, near, clacks, winner, winAt, duration: frames.length / 60 };
}
