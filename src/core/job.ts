import { scenes, type SceneName, type Simulation } from './index.js';
import { songs, defaultSongs, type SongName } from './songs/index.js';
import { readMidi } from './midi.js';
import { collisions } from './audio/events.js';
import { createScore, timedCues } from './audio/score.js';
import type { InstrumentName } from './audio/voice.js';
import { naturalDuration } from './timing.js';
export { naturalDuration } from './timing.js';

export type RenderOptions = {scene: SceneName; song?: SongName; midi?: string; track?: number; seed: number; fps: number; duration?: number; out: string; format: '9:16'; instrument?: InstrumentName};

export async function createJob(options: RenderOptions) {
  const instrument = options.instrument ?? 'piano';
  if (instrument !== 'piano' && instrument !== 'synth') throw new Error('instrument must be piano or synth');
  if (!Object.hasOwn(scenes, options.scene)) throw new Error(`Unknown scene: ${options.scene}`);
  if (!Number.isSafeInteger(options.seed)) throw new Error('seed must be a safe integer');
  if (!Number.isInteger(options.fps) || options.fps < 1 || options.fps > 120) throw new Error('fps must be an integer between 1 and 120');
  if (options.format !== '9:16') throw new Error('The supplied scene compositions support only 9:16');
  if (options.song && options.midi) throw new Error('Use either --song or --midi');
  if (options.track !== undefined && !options.midi) throw new Error('--track requires --midi');
  const song = options.song ?? defaultSongs[options.scene];
  if (!Object.hasOwn(songs, song)) throw new Error(`Unknown song: ${song}`);
  const notes = options.midi ? await readMidi(options.midi, options.track) : songs[song].notes;
  const simulation = {scene: options.scene, data: scenes[options.scene](options.seed)} as Simulation;
  const fullDuration = naturalDuration(simulation);
  const requested = options.duration ?? fullDuration;
  if (!Number.isFinite(requested) || requested <= 0 || requested > fullDuration + 1 / options.fps) throw new Error(`duration must be positive and at most ${fullDuration.toFixed(4)} seconds for this simulation`);
  const durationInFrames = Math.max(1, Math.round(requested * options.fps)), duration = durationInFrames / options.fps;
  const events = collisions(simulation), bins = options.scene === 'galton';
  const score = createScore(simulation, notes);
  return { options: {...options, instrument}, simulation, notes, song: options.midi ? undefined : song, durationInFrames, duration, events, bins, score, cues: timedCues(score, duration, options.fps) };
}
export type RenderJob = Awaited<ReturnType<typeof createJob>>;
