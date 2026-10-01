import { encodeWav } from './wav.js';
import type { SampleBank } from './samples.js';
import { schedule, type Collision, type Cue } from './events.js';
export { collisions, schedule } from './events.js';
export { loadSamples } from './samples.js';
export { createScore, timedCues } from './score.js';
export { renderSoundtrack } from './mix.js';
export type { InstrumentName, Score, ScoreCue } from './voice.js';
export const SAMPLE_RATE = 48000;

/** Sample playback with the Python synth's equal-power pan, fade, and peak normalization. */
export function renderAudio(events: readonly Collision[], notes: readonly number[], bank: SampleBank, options: {duration: number; fps: number; bins?: boolean}): {wav: Uint8Array; cues: Cue[]} {
  const cues = schedule(events, notes, options.duration, options.fps, SAMPLE_RATE, options.bins);
  if (!bank.instruments.length) throw new Error('No instrument samples available');
  const count = Math.round(options.duration * SAMPLE_RATE);
  const left = new Float32Array(count), right = new Float32Array(count);
  for (const cue of cues) {
    const sample = bank.instruments.reduce((a, b) => Math.abs(b.rootMidi - cue.note) < Math.abs(a.rootMidi - cue.note) ? b : a);
    const step = sample.rate / SAMPLE_RATE * 2 ** ((cue.note - sample.rootMidi) / 12);
    const duration = cue.kind === 'peg' ? 0.025 : cue.kind === 'clash' ? 0.09 : 1.8;
    const length = Math.min(Math.floor((sample.channels[0].length - 1) / step), Math.floor(duration * SAMPLE_RATE), count - cue.startSample);
    const l = sample.channels[0], r = sample.channels[1] ?? l;
    const gainL = Math.sqrt(1 - cue.pan) * cue.velocity, gainR = Math.sqrt(1 + cue.pan) * cue.velocity;
    for (let i = 0; i < length; i++) {
      const p = i * step, a = Math.floor(p), fraction = p - a;
      const fade = Math.min(1, (length - 1 - i) / (SAMPLE_RATE * 0.02));
      const index = cue.startSample + i;
      left[index] += (l[a] * (1 - fraction) + l[a + 1] * fraction) * gainL * fade;
      right[index] += (r[a] * (1 - fraction) + r[a + 1] * fraction) * gainR * fade;
    }
  }
  let peak = 0;
  for (let i = 0; i < count; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  const gain = peak ? 0.89 / peak : 1;
  for (let i = 0; i < count; i++) { left[i] *= gain; right[i] *= gain; }
  return { wav: encodeWav([left, right], SAMPLE_RATE), cues };
}
