import { extname } from 'node:path';
import { parseArgs } from 'node:util';
import { scenes, type SceneName } from './core/index.js';
import { songs, type SongName } from './core/songs/index.js';
import type { RenderOptions } from './core/job.js';

export type Command = {command: 'help' | 'list-scenes' | 'list-songs'} | {command: 'render'; options: RenderOptions};
export function parseCommand(args: string[]): Command {
  const { values, positionals } = parseArgs({args, allowPositionals: true, strict: true, options: {
    scene: {type: 'string'}, song: {type: 'string'}, midi: {type: 'string'}, track: {type: 'string'},
    seed: {type: 'string'}, fps: {type: 'string'}, duration: {type: 'string'}, out: {type: 'string'}, format: {type: 'string'},
    instrument: {type: 'string'},
    help: {type: 'boolean', short: 'h'},
  }});
  if (values.help || !args.length) return {command: 'help'};
  if (positionals.length !== 1) throw new Error('Expected one command: render, list-scenes, or list-songs');
  const command = positionals[0];
  if (command === 'list-scenes' || command === 'list-songs') {
    if (Object.keys(values).length) throw new Error(`${command} takes no options`);
    return {command};
  }
  if (command !== 'render') throw new Error(`Unknown command: ${command}`);
  if (!values.scene || !Object.hasOwn(scenes, values.scene)) throw new Error(`Unknown scene: ${values.scene ?? '(missing --scene)'}. Choose ${Object.keys(scenes).join(', ')}`);
  if (values.song !== undefined && !Object.hasOwn(songs, values.song)) throw new Error(`Unknown song: ${values.song}`);
  if (values.song !== undefined && values.midi !== undefined) throw new Error('Use either --song or --midi');
  if (values.midi !== undefined && !values.midi.trim()) throw new Error('--midi requires a file path');
  if (values.track !== undefined && !values.midi) throw new Error('--track requires --midi');
  const number = (value: string | undefined, name: string, defaultValue?: number) => {
    if (value === undefined) return defaultValue;
    if (!value.trim() || !Number.isFinite(Number(value))) throw new Error(`--${name} must be a finite number`);
    return Number(value);
  };
  const seed = number(values.seed, 'seed', 1)!, fps = number(values.fps, 'fps', 60)!;
  const duration = number(values.duration, 'duration'), track = number(values.track, 'track');
  if (!Number.isSafeInteger(seed)) throw new Error('--seed must be a safe integer');
  if (!Number.isInteger(fps) || fps < 1 || fps > 120) throw new Error('--fps must be an integer between 1 and 120');
  if (duration !== undefined && duration <= 0) throw new Error('--duration must be positive');
  if (track !== undefined && (!Number.isSafeInteger(track) || track < 0)) throw new Error('--track must be a zero-based nonnegative integer');
  if (values.format !== undefined && values.format !== '9:16') throw new Error('The supplied scene compositions support only --format 9:16');
  const instrument = values.instrument ?? 'piano';
  if (instrument !== 'piano' && instrument !== 'synth') throw new Error('--instrument must be piano or synth');
  const out = values.out ?? `${values.scene}.mp4`;
  if (!out.trim() || extname(out).toLowerCase() !== '.mp4') throw new Error('--out must name an .mp4 file');
  return {command: 'render', options: {scene: values.scene as SceneName, song: values.song as SongName | undefined, midi: values.midi, track, seed, fps, duration, out, format: '9:16', instrument}};
}
