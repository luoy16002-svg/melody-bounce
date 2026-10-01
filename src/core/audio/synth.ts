import FFT from 'fft.js';
import { NumpyRandom } from './numpy-random.js';
import { SAMPLE_RATE as SR, hz, type Voice } from './voice.js';

/** Port of audio/synth.py's additive piano, including its seeded hammer noise. */
export function piano(note: number, duration = 1.6, velocity = 1): Float64Array {
  const n = Math.floor(SR * duration), out = new Float64Array(n), f0 = hz(note);
  for (let k = 1; k <= 8; k++) {
    const frequency = f0 * k * (1 + 0.0004 * k * k);
    if (frequency > SR / 2.2) break;
    const amp = 1 / k ** 1.25, decay = 2.2 + 1.1 * k + f0 / 900;
    for (let i = 0; i < n; i++) { const t = i / SR; out[i] += amp * Math.exp(-decay * t) * Math.sin(2 * Math.PI * frequency * t + k); }
  }
  // MIDI overrides can create accompaniment below MIDI 0; use the magnitude as
  // the hammer seed there. All original channel pitches keep their exact seed.
  const rng = new NumpyRandom(Math.abs(note));
  for (let i = 0; i < n; i++) {
    const t = i / SR, hammer = rng.normal() * Math.exp(-t * 120) * 0.04;
    out[i] = (out[i] + hammer) * Math.min(1, t / 0.004) * velocity * 0.32;
  }
  return out;
}

export function pluck(frequency: number, duration: number, gain: number, bright = 0.6, seed = 0): Float64Array {
  const n = Math.floor(SR * duration), period = Math.max(2, Math.floor(SR / frequency)), rng = new NumpyRandom(seed);
  let excitation = Float64Array.from({length: period}, () => rng.uniform(-1, 1));
  for (let j = 0; j < Math.trunc((1 - bright) * 4); j++) {
    const next = new Float64Array(period);
    for (let i = 0; i < period; i++) next[i] = 0.5 * (excitation[i] + excitation[(i + period - 1) % period]);
    excitation = next;
  }
  const out = new Float64Array(n);
  out.set(excitation.subarray(0, n));
  for (let i = period; i < n; i++) out[i] = 0.996 * 0.5 * (out[i - period] + (i - period - 1 >= 0 ? out[i - period - 1] : 0));
  for (let i = 0; i < n; i++) out[i] *= gain;
  return out;
}

/** All channel voices and effects; no unseeded randomness. */
export function synthesize(voice: Voice): Float64Array {
  if (voice.kind === 'piano') return piano(voice.note, voice.duration, voice.gain);
  if (voice.kind === 'pluck') return pluck(voice.frequency, voice.duration, voice.gain, voice.bright, voice.seed);
  const n = 'samples' in voice ? voice.samples : Math.floor(SR * voice.duration), out = new Float64Array(n);
  const rng = 'seed' in voice ? new NumpyRandom(voice.seed) : undefined;
  let previous = ['swoosh', 'noise-rise', 'noise-decay'].includes(voice.kind) ? rng!.normal() : 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let value = 0;
    switch (voice.kind) {
      case 'bell':
        for (const [k, ratio] of [1, 2.76, 5.4, 8.93].entries()) value += Math.exp(-t * (3 + 2 * k)) * Math.sin(2 * Math.PI * voice.frequency * ratio * t) / (1 + k);
        value *= Math.min(1, t / 0.002); break;
      case 'shimmer': { const noise = rng!.normal(); value = (noise - previous) * Math.exp(-t * 9); previous = noise; break; }
      case 'swoosh': { const noise = rng!.normal(); value = (noise - previous) * Math.sin(Math.PI * t / voice.duration) ** 2 * (0.4 + 0.6 * t / voice.duration); previous = noise; break; }
      case 'clack': value = Math.sin(2 * Math.PI * 1850 * t) * Math.exp(-t * 90) + 0.6 * Math.sin(2 * Math.PI * 2900 * t) * Math.exp(-t * 120) + rng!.normal() * Math.exp(-t * 400) * 0.4; break;
      case 'woodblock': value = (Math.sin(2 * Math.PI * 1850 * t) + 0.5 * Math.sin(2 * Math.PI * 2750 * t)) * Math.exp(-t * 60); break;
      case 'click': value = Math.sin(2 * Math.PI * voice.frequency * t) * Math.exp(-t * 400); break;
      case 'boom': value = Math.sin(2 * Math.PI * (voice.startHz * t - voice.fallHz * t * t)) * Math.exp(-t * voice.decay); break;
      case 'pad':
        for (const note of voice.notes) value += Math.sin(2 * Math.PI * hz(note) * t);
        value *= Math.min(1, t / 2) * Math.min(1, (voice.duration - t) / 1.5) / voice.notes.length; break;
      case 'grow-pad':
        for (const note of voice.notes) for (const detune of [-voice.detune, 0, voice.detune]) {
          const f = hz(note) * (1 + detune);
          value += Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(4 * Math.PI * f * t) + 0.12 * Math.sin(6 * Math.PI * f * t);
        }
        value = value / (3 * voice.notes.length) * (n > 1 ? i / (n - 1) : 0) ** 2; break;
      case 'riser': {
        const env = (voice.envelope === 'linspace' ? (n > 1 ? i / (n - 1) : 0) : t / voice.duration) ** 2;
        for (const [note, gain] of voice.notes) value += gain * Math.sin(2 * Math.PI * hz(note) * t);
        value *= (0.5 + 0.5 * Math.sin(2 * Math.PI * (voice.tremStart + voice.tremDelta * env) * t)) * env; break;
      }
      case 'noise-rise': {
        const noise = rng!.normal(), env = (voice.envelope === 'linspace' ? (n > 1 ? i / (n - 1) : 0) : t / voice.duration) ** 2;
        value = (noise - previous) * env ** voice.power; previous = noise; break;
      }
      case 'noise-decay': { const noise = rng!.normal(); value = (noise - previous) * Math.exp(-t * voice.decay); previous = noise; break; }
    }
    out[i] = value * voice.gain;
  }
  return out;
}

/** Causal convolution with the NumPy synth's normalized, exponentially decaying noise IR. */
export function reverb(input: Float64Array, seconds = 1.6, wet = 0.22, seed = 7): Float64Array {
  if (!input.some(value => value !== 0)) return input;
  const n = Math.floor(SR * seconds), rng = new NumpyRandom(seed), impulse = new Float64Array(n);
  let energy = 0;
  for (let i = 0; i < n; i++) { impulse[i] = rng.normal() * Math.exp(-(i / SR) * 4.2); energy += impulse[i] ** 2; }
  const norm = Math.sqrt(energy);
  const size = 2 ** Math.ceil(Math.log2(input.length + n));
  const fft = new FFT(size), a = new Float64Array(2 * size), b = new Float64Array(2 * size), result = new Float64Array(2 * size), padded = new Float64Array(size);
  padded.set(input); fft.realTransform(a, padded); fft.completeSpectrum(a);
  padded.fill(0); for (let i = 0; i < n; i++) padded[i] = impulse[i] / norm;
  fft.realTransform(b, padded); fft.completeSpectrum(b);
  for (let i = 0; i < a.length; i += 2) {
    const real = a[i] * b[i] - a[i + 1] * b[i + 1], imaginary = a[i] * b[i + 1] + a[i + 1] * b[i];
    a[i] = real; a[i + 1] = imaginary;
  }
  fft.inverseTransform(result, a);
  const output = new Float64Array(input.length);
  for (let i = 0; i < input.length; i++) output[i] = input[i] * (1 - wet) + result[2 * i] * wet * 1.6;
  return output;
}
