import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { scenes, type SceneName, type Simulation } from '../src/core/index.js';
import { createScore, timedCues } from '../src/core/audio/score.js';
import { NumpyRandom, seedSequence } from '../src/core/audio/numpy-random.js';
import { synthesize, reverb } from '../src/core/audio/synth.js';
import type { Voice } from '../src/core/audio/voice.js';

const load = (file: string) => JSON.parse(readFileSync(new URL('./golden/' + file, import.meta.url), 'utf8'));
function numericEqual(actual: unknown, expected: unknown, path = ''): void {
  if (typeof expected === 'number') {
    if (typeof actual !== 'number' || !Number.isFinite(actual) || Math.abs(actual - expected) > 1e-10) throw new Error(`${path}: ${String(actual)} != ${expected}`);
  } else if (Array.isArray(expected)) {
    expect(Array.isArray(actual), path).toBe(true); expect((actual as unknown[]).length, path).toBe(expected.length);
    expected.forEach((value, i) => numericEqual((actual as unknown[])[i], value, `${path}[${i}]`));
  } else if (expected && typeof expected === 'object') {
    for (const [key, value] of Object.entries(expected)) numericEqual((actual as Record<string, unknown>)[key], value, `${path}.${key}`);
  } else expect(actual, path).toEqual(expected);
}

describe('Python audio control-flow goldens', () => {
  const manifest = load('audio/manifest.json') as {fixtures: {scene: string; seed: number; file: string}[]};
  const tagged = new Set(['piano', 'bell', 'pluck', 'shimmer', 'clack', 'swoosh', 'woodblock', 'click']);
  for (const fixture of manifest.fixtures) it(`${fixture.scene} seed ${fixture.seed}: selected notes, times, layers, pans, and finales`, () => {
    const scene = (fixture.scene === 'escape' ? 'rings' : fixture.scene) as SceneName;
    const simulation = {scene, data: scenes[scene](fixture.seed)} as Simulation;
    const score = createScore(simulation), reference = load('audio/' + fixture.file);
    numericEqual(score.cues.filter(c => c.role === 'melody'), reference.melody, 'melody');
    numericEqual(score.cues.filter(c => tagged.has(c.voice.kind)), reference.voices, 'voices');
    const cues = timedCues(score, score.audioDuration, 60).filter(c => c.role === 'melody');
    expect(cues.map(c => c.t)).toEqual(reference.melody.map((c: {t: number}) => c.t));
    expect(cues.map(c => c.frame)).toEqual(reference.melody.map((c: {t: number}) => Math.floor(c.t * 60)));
    expect(cues.map(c => c.collisionTime)).toEqual(cues.map(c => c.t));
  });
  it('retains rate limits when replacing the melody, and omits the final strings bounce', () => {
    const simulation: Simulation = {scene: 'multiply', data: scenes.multiply(4)};
    const original = createScore(simulation).cues.filter(c => c.role === 'melody');
    const replaced = createScore(simulation, [60, 64, 67]).cues.filter(c => c.role === 'melody');
    expect(replaced.map(c => c.t)).toEqual(original.map(c => c.t));
    expect(replaced.map(c => c.voice.kind === 'piano' ? c.voice.note : 0)).toEqual(replaced.map((_, i) => [60, 64, 67][i % 3]));
    expect(original.length).toBeLessThan(simulation.data.hits.length / 4);
    const strings: Simulation = {scene: 'strings', data: scenes.strings(4)};
    expect(createScore(strings).cues.filter(c => c.role === 'melody').some(c => c.t === strings.data.breakAt)).toBe(false);
  });
});

describe('NumPy random streams and real Python DSP probes', () => {
  const vectors = load('numpy-random.json') as {seed: number; state: string[]; random: number[]; normal: number[]; choices: number[]}[];
  for (const ref of vectors) it(`NumPy PCG64, SeedSequence, normal and choice: seed ${ref.seed}`, () => {
    expect(seedSequence(ref.seed).map(String)).toEqual(ref.state);
    const rng = new NumpyRandom(ref.seed);
    expect(ref.random.map(() => rng.random())).toEqual(ref.random);
    numericEqual(ref.normal.map(() => rng.normal()), ref.normal, 'normal');
    expect(ref.choices.map(() => rng.choice([86, 88, 90, 93, 95, 98]))).toEqual(ref.choices);
  });
  const waveforms = load('audio/waveforms.json') as {probes: {voice: Voice; samples: number[]}[]; reverb: number[]};
  for (const [i, probe] of waveforms.probes.entries()) it(`Python waveform ${i}: ${probe.voice.kind}`, () => numericEqual([...synthesize(probe.voice)], probe.samples));
  it('matches the Python convolution reverb', () => numericEqual([...reverb(synthesize(waveforms.probes[0].voice), 0.03, 0.22, 7)], waveforms.reverb));
});
