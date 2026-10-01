import type { SampleBank } from './sample-data.js';
import { reverb, synthesize } from './synth.js';
import { timedCues } from './score.js';
import { SAMPLE_RATE as SR, type Score, type Voice, type InstrumentName } from './voice.js';
import { encodeWav } from './wav.js';

type Signal = {left: Float64Array; right: Float64Array};
function sampledPiano(voice: Extract<Voice, {kind: 'piano'}>, bank: SampleBank): Signal {
  if (!bank.instruments.length) throw new Error('No instrument samples available');
  const sample = bank.instruments.reduce((a, b) => Math.abs(b.rootMidi - voice.note) < Math.abs(a.rootMidi - voice.note) ? b : a);
  const step = sample.rate / SR * 2 ** ((voice.note - sample.rootMidi) / 12);
  const length = Math.min(Math.floor((sample.channels[0].length - 1) / step), Math.floor(voice.duration * SR));
  const left = new Float64Array(length), right = new Float64Array(length);
  const l = sample.channels[0], r = sample.channels[1] ?? l;
  for (let i = 0; i < length; i++) {
    const position = i * step, a = Math.floor(position), f = position - a;
    const release = Math.min(1, (length - 1 - i) / (SR * 0.02));
    left[i] = (l[a] * (1 - f) + l[a + 1] * f) * release;
    right[i] = (r[a] * (1 - f) + r[a + 1] * f) * release;
  }
  return {left, right};
}

/** Shared by Node rendering and the browser Player's audio worker. */
export function renderSoundtrack(score: Score, options: {duration: number; fps: number; instrument?: InstrumentName; bank?: SampleBank}) {
  if (!Number.isFinite(options.duration) || options.duration <= 0 || !Number.isFinite(options.fps) || options.fps <= 0) throw new Error('Invalid audio timing');
  const instrument = options.instrument ?? 'piano';
  if (instrument === 'piano' && !options.bank) throw new Error('Sample piano requires an instrument bank');
  const cues = timedCues(score, options.duration, options.fps), length = Math.round(options.duration * SR);
  const mixLength = Math.min(length, Math.floor(score.audioDuration * SR));
  const left = new Float64Array(mixLength), right = new Float64Array(mixLength);
  // Repeated pitches share unit-gain signals. Limit the cache for full Galton/race scores.
  const cache = new Map<string, Signal>();
  let cacheBytes = 0;
  for (const cue of cues) {
    const unit = {...cue.voice, gain: 1} as Voice, key = JSON.stringify(unit);
    let signal = cache.get(key);
    if (!signal) {
      if (unit.kind === 'piano' && instrument === 'piano') signal = sampledPiano(unit, options.bank!);
      else { const mono = synthesize(unit); signal = {left: mono, right: mono}; }
      const bytes = signal.left.byteLength + (signal.right === signal.left ? 0 : signal.right.byteLength);
      while (cache.size && cacheBytes + bytes > 32 * 1024 * 1024) {
        const oldest = cache.keys().next().value!;
        const data = cache.get(oldest)!;
        cacheBytes -= data.left.byteLength + (data.left === data.right ? 0 : data.right.byteLength); cache.delete(oldest);
      }
      if (bytes <= 32 * 1024 * 1024) { cache.set(key, signal); cacheBytes += bytes; }
    }
    const count = Math.min(signal.left.length, mixLength - cue.startSample);
    const gainL = Math.sqrt(1 - cue.pan) * cue.voice.gain, gainR = Math.sqrt(1 + cue.pan) * cue.voice.gain;
    for (let i = 0; i < count; i++) { left[cue.startSample + i] += signal.left[i] * gainL; right[cue.startSample + i] += signal.right[i] * gainR; }
  }
  cache.clear();
  const l = reverb(left, score.reverb.seconds, score.reverb.wet, 7), r = reverb(right, score.reverb.seconds, score.reverb.wet, 8);
  const fadeLength = Math.floor(score.fade.seconds * SR), end = Math.floor(score.audioDuration * SR);
  let peak = 0;
  for (let i = 0; i < mixLength; i++) {
    if (i >= end - fadeLength) {
      const fade = Math.max(0, (end - 1 - i) / Math.max(1, fadeLength - 1)) ** score.fade.power;
      l[i] *= fade; r[i] *= fade;
    }
    peak = Math.max(peak, Math.abs(l[i]), Math.abs(r[i]));
  }
  const gain = peak ? score.peak / peak : 1;
  const outputL = new Float32Array(length), outputR = new Float32Array(length);
  for (let i = 0; i < mixLength; i++) { outputL[i] = l[i] * gain; outputR[i] = r[i] * gain; }
  return {wav: encodeWav([outputL, outputR], SR), cues, channels: [outputL, outputR] as const, sampleRate: SR};
}
