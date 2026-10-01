import { Random } from '../random.js';
import { hypot, round, TAU } from '../math.js';
export function run(seed: number, limit = 40) {
  const rng = new Random(seed);
  let x = rng.uniform(-80, 80), y = -120, vx = rng.uniform(-500, 500), vy = 0;
  let theta = rng.uniform(0, TAU), omega = 1.3, t = 0;
  const dt = 1 / (60 * 16), frames: number[][] = [];
  const bounces: {t: number; n: number; side: number; x: number; y: number; v: number}[] = [];
  let escaped: number | null = null;
  while (t < limit && (escaped === null || t < escaped + 3.6)) {
    for (let sub = 0; sub < 16; sub++) {
      t += dt;
      if (t < 2.4) continue;
      theta += omega * dt; vy += 1400 * dt; x += vx * dt; y += vy * dt;
      if (escaped !== null) continue;
      const cs = Array.from({ length: 6 }, (_, k) => [430 * Math.cos(theta + k * Math.PI / 3), 430 * Math.sin(theta + k * Math.PI / 3)]);
      for (let k = 0; k < 6; k++) {
        const [x1, y1] = cs[k], [x2, y2] = cs[(k + 1) % 6];
        const ex = x2 - x1, ey = y2 - y1, L = hypot(ex, ey), ux = ex / L, uy = ey / L;
        let nx = uy, ny = -ux;
        if (nx * x1 + ny * y1 < 0) { nx = -nx; ny = -ny; }
        const s = (x - x1) * ux + (y - y1) * uy, dist = (x - x1) * nx + (y - y1) * ny;
        if (dist > -22 && -44 < dist && -22 < s && s < L + 22) {
          if (k === 0 && Math.abs(s / L - 0.5) < 0.16 / 2) {
            if (dist > 0) escaped = round(t, 4);
            continue;
          }
          const wvx = -omega * y, wvy = omega * x;
          let rvx = vx - wvx, rvy = vy - wvy;
          const rn = rvx * nx + rvy * ny;
          if (rn > 0) {
            const rtx = rvx - rn * nx, rty = rvy - rn * ny;
            [rvx, rvy] = [-0.98 * rn * nx + (1 - 0.02) * rtx, -0.98 * rn * ny + (1 - 0.02) * rty];
            [vx, vy] = [rvx + wvx, rvy + wvy];
            const sp = hypot(vx, vy);
            if (rn > 100 && sp < 1050) { vx = vx * 1050 / sp; vy = vy * 1050 / sp; }
            else if (sp > 2600) { vx = vx * 2600 / sp; vy = vy * 2600 / sp; }
            x -= (dist + 22) * nx; y -= (dist + 22) * ny;
            if (rn > 100 && (!bounces.length || t - bounces[bounces.length - 1].t > 0.05)) {
              omega = Math.min(3, omega * (1 + 0.01));
              bounces.push({ t: round(t, 4), n: bounces.length + 1, side: k, x: round(x, 1), y: round(y, 1), v: round(hypot(vx, vy)) });
            }
          }
        }
      }
    }
    frames.push([round(x + 540, 1), round(y + 1000, 1), round(theta, 5)]);
  }
  return { cx: 540, cy: 1000, rv: 430, ballR: 22, gapSide: 0, gap: 0.16, t0: 2.4, escaped, frames, bounces };
}
