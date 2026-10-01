import type { Simulation } from '../index.js';
export type Collision = { t: number; kind: 'wall' | 'break' | 'clash' | 'peg' | 'bin'; pan: number; velocity: number; bin?: number };
const pan = (x: number) => Math.max(-0.7, Math.min(0.7, x));

/** Stable chronological event ordering; every physical contact keeps its timestamp. */
export function collisions(simulation: Simulation): Collision[] {
  const output: Collision[] = [];
  const add = (t: number, kind: Collision['kind'], x = 0, velocity = 0.8, bin?: number) => output.push({ t, kind, pan: pan(x), velocity, ...(bin === undefined ? {} : { bin }) });
  switch (simulation.scene) {
    case 'rings':
      simulation.data.bounces.forEach((b, i) => add(b.t, 'wall', Math.sin((i + 1) * 0.7) * 0.25, 0.75 + 0.25 * Math.min(1, b.speed / 1600)));
      simulation.data.breaks.forEach(b => add(b.t, 'break'));
      break;
    case 'hexagon': simulation.data.bounces.forEach(b => add(b.t, 'wall', b.x / 450, 0.6 + 0.25 * Math.min(1, b.v / 2200))); break;
    case 'galton':
      simulation.data.balls.forEach(b => {
        b.hits.forEach(t => add(t, 'peg', (b.bin - simulation.data.rows / 2) / 8, 0.09, b.bin));
        add(b.land, 'bin', (b.bin - simulation.data.rows / 2) / 8, 0.8, b.bin);
      });
      break;
    case 'grow': simulation.data.bounces.forEach(b => add(b.t, 'wall', b.x / 600, 0.72 + 0.28 * Math.min(1, (b.r / simulation.data.R) ** 2))); break;
    case 'multiply': simulation.data.hits.forEach(b => add(b.t, 'wall', b.x / 600)); break;
    case 'shrink': simulation.data.bounces.forEach(b => add(b.t, 'wall', b.ax / 500)); break;
    case 'strings': simulation.data.bounces.forEach(b => add(b.t, 'wall', b.ax / 600)); break;
    case 'colorwar':
      simulation.data.bounces.forEach(b => add(b.t, 'wall', b.who === 0 ? -0.4 : 0.4));
      simulation.data.clashes.forEach(b => add(b.t, 'clash', b.x / 600, 0.35));
      break;
    case 'race':
      simulation.data.hits.forEach(b => add(b.t, 'wall', b.x / 600));
      simulation.data.clacks.forEach(b => add(b.t, 'clash', b.x / 600, 0.35));
      break;
  }
  return output.sort((a, b) => a.t - b.t);
}

export type Cue = Collision & {index: number; note: number; startSample: number; frame: number};
export function schedule(events: readonly Collision[], notes: readonly number[], duration: number, fps: number, rate = 48000, bins = false): Cue[] {
  if (!notes.length || notes.some(n => !Number.isInteger(n) || n < 0 || n > 127)) throw new Error('Melody must contain MIDI pitches between 0 and 127');
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(fps) || fps <= 0 || !Number.isSafeInteger(rate) || rate <= 0) throw new Error('Invalid audio timing');
  return events.filter(e => e.t >= 0 && e.t < duration).map((e, index) => ({
    ...e, index, note: notes[(bins && e.bin !== undefined ? e.bin : index) % notes.length],
    startSample: Math.floor(e.t * rate), frame: Math.floor(e.t * fps),
  }));
}
