export const TAU = Math.PI * 2;
export const mod = (x: number, y: number): number => { const r = x % y; return r < 0 ? r + y : r; };

// Compensated vector norm (Ogita/Rump/Oishi; same evaluation order as CPython 3.13).
// A plain Math.hypot loses low bits that change long, chaotic collision histories.
// CPython-derived evaluation order: PSF license, assets/licenses/CPython.txt.
function product(x: number, y: number): [number, number] {
  const tx = x * 134217729, hx = tx - (tx - x), lx = x - hx;
  const ty = y * 134217729, hy = ty - (ty - y), ly = y - hy;
  const hi = x * y;
  return [hi, ((hx * hy - hi) + hx * ly + lx * hy) + lx * ly];
}
export function hypot(a: number, b: number): number {
  const max = Math.max(Math.abs(a), Math.abs(b));
  if (!Number.isFinite(max) || max === 0) return max;
  if (max < 2 ** -1022) return 2 ** -1022 * hypot(a / 2 ** -1022, b / 2 ** -1022);
  const scale = 2 ** -(Math.floor(Math.log2(max)) + 1);
  let sum = 1, frac1 = 0, frac2 = 0;
  for (const x of [a * scale, b * scale]) {
    const [hi, lo] = product(x, x), next = sum + hi;
    frac1 += lo; frac2 += (sum - next) + hi; sum = next;
  }
  let h = Math.sqrt(sum - 1 + (frac1 + frac2));
  const [hi, lo] = product(-h, h), next = sum + hi;
  frac1 += lo; frac2 += (sum - next) + hi; sum = next;
  h += (sum - 1 + (frac1 + frac2)) / (2 * h);
  return h / scale;
}

/** Round the exact binary64 value to decimal, ties to even, as Python round does. */
export function round(value: number, digits = 0): number {
  if (!Number.isFinite(value) || value === 0) return value;
  const data = new DataView(new ArrayBuffer(8));
  data.setFloat64(0, Math.abs(value));
  const bits = data.getBigUint64(0);
  const exp = Number((bits >> 52n) & 0x7ffn);
  let numerator = (bits & ((1n << 52n) - 1n)) | (exp ? 1n << 52n : 0n);
  const power = (exp ? exp - 1023 : -1022) - 52;
  let denominator = 1n;
  if (power >= 0) numerator <<= BigInt(power); else denominator <<= BigInt(-power);
  if (digits >= 0) numerator *= 10n ** BigInt(digits); else denominator *= 10n ** BigInt(-digits);
  let q = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder * 2n > denominator || (remainder * 2n === denominator && (q & 1n))) q++;
  return Math.sign(value) * Number(q) / 10 ** digits;
}
