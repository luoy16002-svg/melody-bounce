import { KI, WI, FI } from './ziggurat.js';

// NumPy 2.4 PCG64 / SeedSequence / Ziggurat, adapted to JS integer arithmetic.
// Notices: assets/licenses/NumPy*.txt and assets/licenses/PCG64.txt.
const MASK64 = (1n << 64n) - 1n, MASK128 = (1n << 128n) - 1n;
const MULTIPLIER = (2549297995355413924n << 64n) | 4865540595714422341n;

export function seedSequence(seed: number): bigint[] {
  if (!Number.isSafeInteger(seed) || seed < 0) throw new Error('NumPy seed must be a nonnegative safe integer');
  let entropy = BigInt(seed);
  const words: number[] = [];
  do { words.push(Number(entropy & 0xffffffffn)); entropy >>= 32n; } while (entropy);
  let hash = 0x43b0d7e5;
  const hashmix = (value: number) => {
    value ^= hash; hash = Math.imul(hash, 0x931e8875) >>> 0;
    value = Math.imul(value, hash) >>> 0;
    return (value ^ (value >>> 16)) >>> 0;
  };
  const mix = (x: number, y: number) => {
    const r = (Math.imul(0xca01f9dd, x) - Math.imul(0x4973f715, y)) >>> 0;
    return (r ^ (r >>> 16)) >>> 0;
  };
  const pool = Array.from({length: 4}, (_, i) => hashmix(words[i] ?? 0));
  for (let src = 0; src < 4; src++) for (let dst = 0; dst < 4; dst++) {
    if (src !== dst) pool[dst] = mix(pool[dst], hashmix(pool[src]));
  }
  for (let src = 4; src < words.length; src++) for (let dst = 0; dst < 4; dst++) pool[dst] = mix(pool[dst], hashmix(words[src]));
  hash = 0x8b51f9dd;
  const state = Array.from({length: 8}, (_, i) => {
    let value = pool[i % 4] ^ hash;
    hash = Math.imul(hash, 0x58f38ded) >>> 0;
    value = Math.imul(value, hash) >>> 0;
    return (value ^ (value >>> 16)) >>> 0;
  });
  return Array.from({length: 4}, (_, i) => BigInt(state[i * 2]) | (BigInt(state[i * 2 + 1]) << 32n));
}

export class NumpyRandom {
  private state: bigint;
  private increment: bigint;
  private cached32: number | undefined;
  constructor(seed: number) {
    const [a, b, c, d] = seedSequence(seed);
    const initial = (a << 64n) | b;
    this.increment = ((((c << 64n) | d) << 1n) | 1n) & MASK128;
    this.state = this.increment;
    this.state = ((this.state + initial) * MULTIPLIER + this.increment) & MASK128;
  }
  uint64(): bigint {
    this.state = (this.state * MULTIPLIER + this.increment) & MASK128;
    const value = ((this.state >> 64n) ^ this.state) & MASK64, rotation = this.state >> 122n;
    return ((value >> rotation) | (value << ((64n - rotation) & 63n))) & MASK64;
  }
  uint32(): number {
    if (this.cached32 !== undefined) { const value = this.cached32; this.cached32 = undefined; return value; }
    const value = this.uint64(); this.cached32 = Number(value >> 32n);
    return Number(value & 0xffffffffn);
  }
  random(): number { return Number(this.uint64() >> 11n) / 9007199254740992; }
  uniform(low: number, high: number): number { return low + (high - low) * this.random(); }
  choice<T>(values: readonly T[]): T {
    const bound = values.length;
    if (!bound || bound > 0xffffffff) throw new Error('Invalid choice size');
    const threshold = (4294967296 - bound) % bound;
    let product: bigint;
    do { product = BigInt(this.uint32()) * BigInt(bound); } while (Number(product & 0xffffffffn) < threshold);
    return values[Number(product >> 32n)];
  }
  normal(): number {
    for (;;) {
      const bits = this.uint64(), index = Number(bits & 255n), r = bits >> 8n;
      const magnitude = Number((r >> 1n) & 0xfffffffffffffn);
      let x = magnitude * WI[index];
      if (r & 1n) x = -x;
      if (magnitude < KI[index]) return x;
      if (index === 0) {
        for (;;) {
          const xx = -0.2736612373297583 * Math.log1p(-this.random());
          const yy = -Math.log1p(-this.random());
          if (yy + yy > xx * xx) return (BigInt(magnitude) >> 8n) & 1n ? -(3.654152885361009 + xx) : 3.654152885361009 + xx;
        }
      }
      if ((FI[index - 1] - FI[index]) * this.random() + FI[index] < Math.exp(-0.5 * x * x)) return x;
    }
  }
}
