import type { Simulation } from '../index.js';
import { defaultSongs, songs } from '../songs/index.js';
import { NumpyRandom } from './numpy-random.js';
import { hz, SAMPLE_RATE as SR, type Score, type ScoreCue, type Voice } from './voice.js';

const clamp = (x: number, max = 0.7) => Math.max(-max, Math.min(max, x));
const canonChords = [...Array.from({length: 8}, (_, i) => i), ...Array.from({length: 8}, (_, i) => i), ...Array.from({length: 16}, (_, i) => Math.floor(i / 2))];
const canonBass = [50, 45, 47, 42, 43, 38, 43, 45];
const minuetBass: Record<number, number> = {0: 43, 5: 47, 8: 48, 13: 47, 16: 45, 21: 43, 26: 38, 29: 38};

/** Port of the nine synth*.py main() schedules, including accompaniment and finales. */
export function createScore(simulation: Simulation, melody = songs[defaultSongs[simulation.scene]].notes): Score {
  if (!melody.length || melody.some(m => !Number.isInteger(m) || m < 0 || m > 127)) throw new Error('Melody must contain MIDI pitches between 0 and 127');
  const cues: ScoreCue[] = [];
  const add = (voice: Voice, t: number, pan = 0, role: ScoreCue['role'] = 'effect', collisionTime?: number) => {
    if (t < 0 || voice.duration <= 0) return;
    cues.push({t, pan, voice, role, ...(collisionTime === undefined ? {} : {collisionTime})});
  };
  const p = (note: number, duration: number, gain: number, t: number, pan = 0, role: ScoreCue['role'] = 'accent', collisionTime?: number) => add({kind: 'piano', note, duration, gain}, t, pan, role, collisionTime);
  const bell = (note: number, duration: number, gain: number, t: number, pan = 0) => add({kind: 'bell', frequency: hz(note), duration, gain}, t, pan, 'accent');
  const pl = (note: number, duration: number, gain: number, t: number, pan = 0, bright = 0.6, seed = 0, role: ScoreCue['role'] = 'accent', collisionTime?: number) => add({kind: 'pluck', frequency: hz(note), duration, gain, bright, seed}, t, pan, role, collisionTime);
  const shimmer = (duration: number, gain: number, seed: number, t: number) => add({kind: 'shimmer', duration, gain, seed}, t);
  const boom = (duration: number, gain: number, startHz: number, fallHz: number, decay: number, t: number) => add({kind: 'boom', duration, gain, startHz, fallHz, decay}, t);
  const noise = (duration: number, gain: number, seed: number, decay: number, t: number) => add({kind: 'noise-decay', duration, gain, seed, decay}, t);
  const riser = (t: number, duration: number, notes: [number, number][], gain: number, tremStart: number, tremDelta: number, noiseGain: number, seed: number, power: number, envelope: 'time' | 'linspace') => {
    if (duration <= 0) return;
    const samples = Math.floor(SR * duration);
    add({kind: 'riser', duration, samples, notes, gain, tremStart, tremDelta, envelope}, t);
    if (noiseGain) add({kind: 'noise-rise', duration, samples, gain: noiseGain, seed, power, envelope}, t);
  };
  const next = (index: number) => melody[index % melody.length];
  let audioDuration = 0, reverbSeconds = 1.6, wet = 0.22, fadeSeconds = 0.45, fadePower = 2, peak = 0.89;

  switch (simulation.scene) {
    case 'rings': {
      const d = simulation.data;
      audioDuration = d.duration + 1; fadeSeconds = 0.8; fadePower = 1;
      const events = [...d.bounces.map(b => ({...b, kind: 'b'})), ...d.breaks.map(b => ({...b, speed: 1200, kind: 'x'}))].sort((a, b) => a.t - b.t);
      let index = 0, last = -1;
      for (const e of events) {
        if (e.t - last < 0.045) continue;
        last = e.t;
        const m = next(index++), velocity = 0.75 + 0.25 * Math.min(1, e.speed / 1600);
        p(m, 1.8, velocity, e.t, Math.sin(index * 0.7) * 0.25, 'melody', e.t);
        if (e.kind === 'x') { p(m - 24, 2.4, 0.55, e.t); bell(m + 12, 1, 0.05, e.t, 0.3); shimmer(0.45, 0.035, index, e.t); }
      }
      if (d.escapedAt !== null) {
        const t = d.escapedAt;
        [57, 64, 69, 72, 76, 81].forEach((m, i) => p(m, 3.5, 0.9, t + 0.06 * i, (i - 2.5) * 0.12));
        shimmer(1.4, 0.06, 99, t); bell(88, 2.5, 0.06, t + 0.35);
      }
      break;
    }
    case 'multiply': {
      const d = simulation.data;
      audioDuration = d.duration + 3.2; fadeSeconds = 0.9; fadePower = 1;
      const alive = d.frames.map(frame => frame.filter(b => !b[3]).length);
      let last = -1, index = 0;
      for (const hit of d.hits) {
        const t = hit.t;
        if (t - last < 0.075) continue;
        last = t;
        const m = next(index++), count = alive[Math.min(alive.length - 1, Math.floor(t * 60))], pan = clamp(hit.x / 500, 0.8);
        p(m, 0.9, 0.8, t, pan, 'melody', t);
        if (count > 60) p(m + 12, 0.7, 0.45, t, -pan);
        if (count > 100 && index % 2 === 0) p(m - 24, 1.2, 0.6, t);
      }
      const end = d.escapes.at(-1)?.t;
      if (end !== undefined && d.escapes.length === d.spawned) {
        [47, 54, 59, 62, 66, 71, 74].forEach((m, i) => p(m, 3.8, 0.95, end + 0.05 * i, (i - 3) * 0.1));
        shimmer(1.6, 0.07, 11, end); bell(83, 2.8, 0.06, end + 0.3);
      }
      break;
    }
    case 'grow': {
      const d = simulation.data, end = d.fillAt;
      audioDuration = end === null ? d.duration : end + 4;
      let last = -1, index = 0, chord: number | null = null, t70: number | null = null;
      for (const bounce of d.bounces) {
        const t = bounce.t, fill = Math.min(1, (bounce.r / d.R) ** 2);
        if (fill >= 0.7 && t70 === null) t70 = t;
        if (t - last < 0.065) continue;
        const gap = t - last; last = t;
        const m = next(index), c = canonChords[index % canonChords.length]; index++;
        const pan = clamp(bounce.x / 600);
        p(m, gap > 0.3 ? 1.8 : 1.1, 0.72 + 0.28 * fill, t, pan, 'melody', t);
        if (fill >= 0.2 && c !== chord) { p(canonBass[c], 2.4, 0.5 + 0.2 * fill, t, 0, 'bass'); p(canonBass[c] + 12, 1.6, 0.22, t, 0, 'bass'); }
        if (fill >= 0.45) bell(m + 12, 0.8, 0.028 + 0.02 * fill, t, -pan);
        chord = c;
      }
      if (end !== null) {
        if (t70 !== null) {
          const duration = end - t70 + 0.05, samples = Math.floor(SR * duration);
          add({kind: 'grow-pad', notes: [38, 45, 50, 57], duration, samples, detune: 0.0025, gain: 0.16}, t70);
          add({kind: 'noise-rise', duration, samples, gain: 0.035, seed: 3, power: 1.5, envelope: 'linspace'}, t70);
        }
        [38, 45, 50, 54, 57, 62, 66, 69, 74, 78, 81, 86].forEach((m, i) => p(m, 4.2, 0.95, end + 0.022 * i, (i - 5.5) * 0.08));
        bell(86, 2.6, 0.06, end + 0.1); shimmer(1.2, 0.05, 5, end);
        const pop = end + 0.9; boom(0.5, 0.55, 70, 30, 9, pop); noise(0.2, 0.18, 9, 30, pop);
        const rng = new NumpyRandom(12);
        for (let i = 0; i < 14; i++) { const m = rng.choice([86, 88, 90, 93, 95, 98]); bell(m, 0.9, 0.03, pop + 0.05 + i * 0.055 + rng.uniform(0, 0.03), rng.uniform(-0.7, 0.7)); }
      }
      break;
    }
    case 'strings': {
      const d = simulation.data, end = d.breakAt;
      audioDuration = end === null ? d.duration : end + 3.6;
      let last = -1, index = 0, root: number | null = null, t80: number | null = null;
      for (const bounce of d.bounces) {
        const t = bounce.t, n = bounce.n;
        if (n >= d.nBreak) break;
        if (n >= 80 && t80 === null) t80 = t;
        if (t - last < 0.07) continue;
        last = t;
        const m = next(index++), pan = clamp(bounce.ax / 520), f = n / d.nBreak;
        p(m, f < 0.6 ? 1.4 : 0.9, 0.72 + 0.28 * f, t, pan, 'melody', t);
        pl(m - 12, 1.2, 0.10, t, -pan, 0.5, n);
        const r = [2, 6, 9].includes(m % 12) ? 38 : [4, 7, 1].includes(m % 12) ? 45 : 43;
        if (n >= 25 && r !== root) { p(r, 2.2, 0.5 + 0.2 * f, t, 0, 'bass'); root = r; }
        if (n >= 50) bell(m + 12, 0.7, 0.03 + 0.02 * f, t, -pan);
      }
      if (end !== null) {
        if (t80 !== null) riser(t80, end - t80, [[86, 1], [81, 0.5]], 0.05, 6, 10, 0.03, 4, 1.6, 'linspace');
        boom(0.9, 0.7, 62, 22, 5, end); noise(1.2, 0.12, 8, 4.5, end);
        const rng = new NumpyRandom(21), penta = [62, 64, 66, 69, 71];
        for (let i = 0; i < 60; i++) pl(penta[i % 5] + 12 * (1 + Math.floor(i / 5) % 3), 1, 0.05, end + 0.02 + i * 0.013 + rng.uniform(0, 0.01), rng.uniform(-0.8, 0.8), 0.8, 100 + i);
        [38, 45, 50, 54, 57, 62, 66, 69, 74, 78, 81].forEach((m, i) => p(m, 4, 0.95, end + 0.08 + 0.02 * i, (i - 5) * 0.08));
        bell(86, 2.4, 0.06, end + 0.2); shimmer(1.4, 0.05, 6, end + 0.05);
      }
      break;
    }
    case 'hexagon': {
      const d = simulation.data, end = d.escaped;
      audioDuration = end === null ? d.frames.length / 60 : end + 3.6;
      reverbSeconds = 2; wet = 0.24; fadeSeconds = 0.08; fadePower = 1; peak = 0.85;
      shimmer(1.8, 0.03, 5, 0.5);
      d.bounces.forEach((b, k) => {
        const m = next(k), pan = clamp(b.x / 450), velocity = 0.6 + 0.25 * Math.min(1, b.v / 2200);
        p(m, 1.3, velocity, b.t, pan, 'melody', b.t);
        if (k % 32 in minuetBass) p(minuetBass[k % 32], 1.8, 0.4, b.t, -pan * 0.5, 'bass');
        if (k >= 32) bell(m + 12, 0.5, 0.015, b.t, -pan);
      });
      if (end !== null) {
        [67, 71, 74, 79, 83, 86].forEach((m, i) => p(m, 0.8, 0.55, end + i * 0.06, 0.3));
        boom(1, 0.5, 60, 20, 4.5, end + 0.4); shimmer(1.2, 0.06, 9, end + 0.4);
        [43, 55, 62, 67, 71, 74].forEach(m => p(m, 3, 0.45, end + 0.45));
        bell(91, 2, 0.04, end + 0.6);
      }
      break;
    }
    case 'shrink': {
      const d = simulation.data, end = d.squeezed;
      audioDuration = end === null ? d.frames.length / 60 : end + 3.6;
      reverbSeconds = 1.8; fadeSeconds = 0.08; fadePower = 1; peak = 0.85;
      shimmer(1.8, 0.03, 7, 0.5);
      let last = -1, index = 0;
      for (const b of d.bounces) {
        const t = b.t;
        if (t - last < 0.06) continue;
        last = t;
        const m = next(index++), f = b.n / d.bounces.length, pan = clamp(b.ax / 500);
        p(m, f < 0.6 ? 1 : 0.6, 0.62 + 0.3 * f, t, pan, 'melody', t);
        if (b.n >= 40) p(m - 12, 0.8, 0.35 + 0.2 * f, t, -pan, 'bass');
        if (b.n >= 90) bell(m + 12, 0.4, 0.02 + 0.02 * f, t, -pan);
      }
      if (end !== null) {
        riser(end - 4, 4, [[83, 1], [78, 0.5]], 0.05, 6, 12, 0.025, 4, 1.6, 'time');
        boom(1, 0.7, 62, 22, 5, end); noise(1.2, 0.12, 8, 4.5, end);
        [83, 81, 78, 76, 74, 71, 69, 66, 62, 59].forEach((m, i) => bell(m, 0.6, 0.03, end + 0.05 + i * 0.05, i % 2 - 0.5));
        [35, 47, 54, 59, 62, 66].forEach(m => p(m, 2.8, 0.5, end + 0.6));
      }
      break;
    }
    case 'galton': {
      const d = simulation.data, climax = d.done + 0.6;
      audioDuration = climax + 3.6; reverbSeconds = 2; wet = 0.24; fadeSeconds = 0.08; fadePower = 1; peak = 0.85;
      shimmer(1.8, 0.03, 4, 0.5);
      const rng = new NumpyRandom(11), hits = d.balls.flatMap(b => b.hits).sort((a, b) => a - b);
      let last = -1;
      for (const t of hits) {
        if (t - last < 0.006) continue;
        last = t;
        add({kind: 'click', frequency: 2600 + rng.uniform(-400, 400), duration: 0.02, gain: 0.02}, t, rng.uniform(-0.5, 0.5), 'peg', t);
      }
      d.balls.forEach((b, i) => {
        const m = next(b.bin), pan = (b.bin / d.rows - 0.5) * 1.3;
        pl(m, 1.1, 0.26, b.land, pan, 0.7, i, 'melody', b.land); bell(m + 12, 0.4, 0.008, b.land, -pan);
      });
      add({kind: 'pad', notes: [50, 57, 62, 66], duration: climax - 3, gain: 0.04}, 2.8);
      boom(1, 0.45, 58, 18, 4.5, climax); shimmer(1.4, 0.06, 6, climax);
      [38, 50, 57, 62, 66, 69, 74, 78].forEach((m, k) => p(m, 3, 0.45, climax + 0.03 * k));
      bell(86, 2.2, 0.05, climax + 0.3);
      break;
    }
    case 'colorwar': {
      const d = simulation.data, end = d.end;
      audioDuration = end + 3.6; reverbSeconds = 1.8; fadeSeconds = 0.08; fadePower = 1; peak = 0.85;
      shimmer(1.8, 0.03, 3, 0.5);
      let last = -1, index = 0;
      for (const b of d.bounces) {
        const t = b.t;
        if (t >= end) break;
        if (t - last < 0.06) continue;
        last = t;
        const m = next(index++), f = (t - d.t0) / (end - d.t0);
        if (b.who === 0) p(m, 1, 0.7 + 0.25 * f, t, -0.55, 'melody', t);
        else { pl(m, 1, 0.33 + 0.1 * f, t, 0.55, 0.75, index, 'melody', t); bell(m + 12, 0.35, 0.012, t, 0.55); }
        if (index % 5 === 0) p([9, 0, 4].includes(m % 12) ? 45 : 40, 1.4, 0.35, t, 0, 'bass');
      }
      d.clashes.forEach(c => { if (c.t < end) add({kind: 'woodblock', duration: 0.08, gain: 0.12}, c.t, 0, 'effect', c.t); });
      for (let i = 0; i < 20; i++) add({kind: 'woodblock', duration: 0.08, gain: 0.05 + 0.004 * i}, end - 5 + i * 0.25);
      riser(end - 5, 5, [[81, 1]], 0.04, 6, 8, 0, 0, 1, 'time');
      boom(1, 0.6, 60, 20, 4.5, end); shimmer(1.2, 0.08, 5, end);
      [57, 64, 69, 72, 76, 81].forEach((m, i) => {
        if (d.final[0] > d.final[1]) p(m, 2.8, 0.55, end + 0.05 + i * 0.07, -0.3);
        else pl(m, 2.4, 0.4, end + 0.05 + i * 0.07, 0.3, 0.8, 90 + i);
      });
      bell(93, 2, 0.05, end + 0.5);
      break;
    }
    case 'race': {
      const d = simulation.data, end = d.winAt, cutoff = end ?? Infinity;
      audioDuration = end === null ? d.duration : end + 3.4;
      let last = -1, index = 0, bass: number | null = null;
      for (const h of d.hits) {
        const t = h.t;
        if (t > cutoff || t - last < 0.07) continue;
        last = t;
        const m = next(index), root = [43, 48, 38, 43][Math.floor((index % 40) / 10)]; index++;
        const pan = clamp(h.x / 520), heat = Math.min(1, t / (end ?? d.duration));
        p(m, 1.1, 0.7 + 0.3 * heat, t, pan, 'melody', t);
        if (t > 5 && root !== bass) { p(root, 2.4, 0.55, t, 0, 'bass'); p(root + 12, 1.6, 0.25, t, 0, 'bass'); bass = root; }
        if (t > 12) bell(m + 12, 0.6, 0.025, t, -pan);
      }
      d.clacks.forEach(c => { if (c.t < cutoff) add({kind: 'clack', duration: 0.06, gain: 0.09, seed: Math.floor(c.t * 1000)}, c.t, clamp(c.x / 520), 'effect', c.t); });
      d.near.forEach(n => {
        if (n.t < cutoff) { add({kind: 'swoosh', duration: 0.45, gain: 0.05, seed: Math.floor(n.t * 100)}, n.t - 0.25); bell(91, 0.9, 0.05, n.t); }
      });
      if (end !== null) {
        riser(18, end - 18, [[55, 1], [62, 0.6], [67, 0.4]], 0.06, 5, 9, 0.025, 5, 1.5, 'linspace');
        [43, 50, 55, 59, 62, 67, 71, 74, 79, 83].forEach((m, i) => p(m, 3.8, 0.95, end + 0.03 * i, (i - 4.5) * 0.08));
        [79, 83, 86, 91].forEach((m, i) => bell(m, 1.4, 0.05, end + 0.35 + 0.09 * i, (i - 1.5) * 0.3));
        shimmer(1.4, 0.06, 9, end);
      }
      break;
    }
  }
  return {cues, audioDuration, reverb: {seconds: reverbSeconds, wet}, fade: {seconds: fadeSeconds, power: fadePower}, peak};
}

export function timedCues(score: Score, duration: number, fps: number) {
  return score.cues.filter(c => c.t >= 0 && c.t < duration && c.t < score.audioDuration).map((cue, index) => ({
    ...cue, index, startSample: Math.floor(cue.t * SR), frame: Math.floor(cue.t * fps),
    ...(cue.voice.kind === 'piano' ? {note: cue.voice.note} : cue.voice.kind === 'pluck' ? {note: Math.round(69 + 12 * Math.log2(cue.voice.frequency / 440))} : {}),
  }));
}
