import type { Score, ScoreCue, Voice } from '../../src/core/audio/voice.js';
import { hz } from '../../src/core/audio/voice.js';
import type { Timeline } from './songs.js';
import { BURST_DELAY, coinLandings, pieces } from './finale.js';
import { NAME_Y } from './layout.js';

/** Melody on piano, an oom-pah accompaniment, and a confetti finale where every coin landing is a note. */
export function cardScore(timeline: Timeline): Score {
  const cues: ScoreCue[] = [];
  const add = (voice: Voice, t: number, pan = 0, role: ScoreCue['role'] = 'accent') => cues.push({t, voice, pan, role});
  const piano = (note: number, duration: number, gain: number, t: number, pan = 0, role: ScoreCue['role'] = 'accent') =>
    add({kind: 'piano', note, duration, gain}, t, pan, role);

  add({kind: 'shimmer', duration: 1.2, gain: 0.03, seed: 3}, 0.2);
  add({kind: 'bell', frequency: hz(timeline.notes[0].midi + 24), duration: 1.4, gain: 0.03}, 0.35, 0.3);

  timeline.notes.forEach((note, i) => {
    const pan = Math.sin(i * 0.9) * 0.18;
    piano(note.midi, Math.max(0.9, note.dur * 1.8), note.hop ? 0.62 : 0.86, note.t, pan, 'melody');
    const syllable = timeline.syllables[note.syllable];
    if (syllable.isName && !note.hop) add({kind: 'bell', frequency: hz(note.midi + 12), duration: 1.2, gain: 0.04}, note.t, -pan);
  });

  // Bass on the chord change, soft chord stabs on the following pulses.
  for (const chord of timeline.chords) {
    const [bass, ...upper] = chord.tones;
    piano(bass, Math.min(2.2, chord.end - chord.t + 0.3), 0.5, chord.t, 0, 'bass');
    for (let t = chord.t + timeline.pulse; t < chord.end - 0.05; t += timeline.pulse) {
      upper.forEach((tone, k) => piano(tone, timeline.pulse * 0.9, 0.17, t + k * 0.006, (k - 1) * 0.25, 'bass'));
    }
  }

  // Finale: the ball reaches the name and bursts. Final chord, then a coin note for every landing.
  const burst = timeline.songEnd + BURST_DELAY;
  const tonic = timeline.chords[timeline.chords.length - 1].tones;
  const root = tonic[0] + 24;
  [root, root + 4, root + 7, root + 12].forEach((m, i) => piano(m, 2.6, 0.55, burst + i * 0.035, (i - 1.5) * 0.2));
  add({kind: 'shimmer', duration: 1.6, gain: 0.07, seed: 9}, burst);
  add({kind: 'boom', duration: 0.9, gain: 0.28, startHz: 70, fallHz: 30, decay: 5}, burst);
  const scale = [0, 4, 7, 12, 16, 19, 24];
  let last = -1;
  coinLandings(pieces(540, NAME_Y, [0])).forEach((dt, i) => {
    const t = burst + dt;
    if (t - last < 0.07 || t > timeline.end - 0.6) return;
    last = t;
    add({kind: 'bell', frequency: hz(root + scale[i % scale.length]), duration: 0.9, gain: 0.05}, t, ((i * 37) % 10) / 10 - 0.5);
  });

  return {cues, audioDuration: timeline.end, reverb: {seconds: 1.8, wet: 0.22}, fade: {seconds: 1.2, power: 1}, peak: 0.89};
}
