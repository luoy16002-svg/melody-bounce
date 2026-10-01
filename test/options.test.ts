import { describe, it, expect } from 'vitest';
import { parseCommand } from '../src/options.js';
import { createJob } from '../src/core/job.js';

describe('CLI validation and job planning', () => {
  it('accepts the requested CLI example with a short output duration', async () => {
    const command = parseCommand(['render', '--scene', 'rings', '--song', 'fur-elise', '--duration', '5', '--fps', '30', '--out', 'fur-elise.mp4']);
    expect(command.command).toBe('render');
    if (command.command !== 'render') throw new Error('Unexpected command');
    expect(command.options.instrument).toBe('piano');
    const job = await createJob(command.options);
    expect(job.durationInFrames).toBe(150); expect(job.duration).toBe(5);
    expect(job.simulation.scene).toBe('rings'); expect(job.cues.length).toBeGreaterThan(0);
    expect(job.simulation.data).toHaveProperty('fps', 60);
  });
  it.each([
    [['render'], 'scene'],
    [['render', '--scene', 'invalid'], 'scene'],
    [['render', '--scene', '__proto__'], 'scene'],
    [['render', '--scene', 'rings', '--song', 'invalid'], 'song'],
    [['render', '--scene', 'rings', '--instrument', 'invalid'], 'instrument'],
    [['render', '--scene', 'rings', '--song', 'fur-elise', '--midi', 'song.mid'], 'either'],
    [['render', '--scene', 'rings', '--track', '0'], 'requires --midi'],
    [['render', '--scene', 'rings', '--seed', '1.2'], 'safe integer'],
    [['render', '--scene', 'rings', '--seed', 'NaN'], 'finite'],
    [['render', '--scene', 'rings', '--fps', '0'], 'fps'],
    [['render', '--scene', 'rings', '--duration', '-1'], 'argument'],
    [['render', '--scene', 'rings', '--duration=-1'], 'positive'],
    [['render', '--scene', 'rings', '--out', 'video.webm'], '.mp4'],
    [['render', '--scene', 'rings', '--format', '16:9'], '9:16'],
    [['list-scenes', '--seed', '1'], 'no options'],
    [['bad-command'], 'Unknown command'],
    [['render', '--scene', 'rings', '--bad'], 'Unknown option'],
  ])('rejects %j', (args, message) => {
    expect(() => parseCommand(args)).toThrow(new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  });
  it('accepts the additive synth instrument', () => {
    const command = parseCommand(['render', '--scene', 'hexagon', '--instrument', 'synth']);
    expect(command.command).toBe('render');
    if (command.command !== 'render') throw new Error('Unexpected command');
    expect(command.options.instrument).toBe('synth');
  });
  it('reports inaccessible MIDI files and output durations longer than a simulation', async () => {
    const command = parseCommand(['render', '--scene', 'hexagon', '--midi', 'test/no-such-song.mid', '--seed', '7', '--out', 'my-song.mp4']);
    if (command.command !== 'render') throw new Error('Unexpected command');
    await expect(createJob(command.options)).rejects.toThrow('Cannot read MIDI file');
    await expect(createJob({...command.options, midi: undefined, duration: 999})).rejects.toThrow('at most');
  });
});
