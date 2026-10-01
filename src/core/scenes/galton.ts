import { Random } from '../random.js';
import { round } from '../math.js';
export function run(seed: number) {
  const rng = new Random(seed), rows = 12, counts = Array<number>(13).fill(0);
  const balls = Array.from({ length: 300 }, (_, b) => {
    const spawn = 2.4 + b * 0.08;
    const bits = Array.from({ length: rows }, () => rng.random() < 0.5 ? 1 : 0);
    const bin = bits.reduce<number>((s, x) => s + x, 0), slot = counts[bin]++;
    const hits = Array.from({ length: rows }, (_, r) => round(spawn + 0.2 + r * 0.12, 4));
    const stackY = 1540 - Math.floor(slot / 4) * 13.5 - 13.5 / 2;
    const fall = 0.14 + 0.12 * Math.max(0, (stackY - 1176) / 360);
    return { spawn: round(spawn, 4), bits: bits.join(''), bin, slot, hits, land: round(hits[hits.length - 1] + 0.12 + fall, 4) };
  });
  return { rows, balls, counts, perRow: 4, binBottom: 1540, ballD: 13.5, drop: 0.2, hop: 0.12, t0: 2.4, done: Math.max(...balls.map(b => b.land)) };
}
