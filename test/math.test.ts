import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { Random } from '../src/core/random.js';
import { round, hypot, mod } from '../src/core/math.js';
const vectors = JSON.parse(readFileSync(new URL('./golden/random.json', import.meta.url), 'utf8')) as {seed: number; random: number[]; choices: number[]; uniform: number[]}[];
for (const v of vectors) it(`matches CPython random/choice/uniform, seed ${v.seed}`, () => {
  const rng = new Random(v.seed);
  expect(v.random.map(() => rng.random())).toEqual(v.random);
  expect(v.choices.map(() => rng.choice([-1, 1]))).toEqual(v.choices);
  expect(v.uniform.map(() => rng.uniform(-0.22, 0.22))).toEqual(v.uniform);
});
it('preserves Python rounding and compensated distance at floating-point boundaries', () => {
  expect(round(2.675, 2)).toBe(2.67);
  expect(round(1.25, 1)).toBe(1.2);
  expect(round(1.35, 1)).toBe(1.4);
  expect(round(-2.5)).toBe(-2);
  expect(round(3.5)).toBe(4);
  expect(mod(-1, 72)).toBe(71);
  expect(hypot(-1.8207963267948966, -1.7207963267948965)).toBe(2.5052822719167986);
  expect(hypot(3, 4)).toBe(5);
  expect(hypot(0, 0)).toBe(0);
  expect(() => new Random(NaN)).toThrow('safe integer');
});
