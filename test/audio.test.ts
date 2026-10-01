import { afterEach, describe, it, expect } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { decodeWav, encodeWav } from '../src/core/audio/wav.js';
import { loadSamples, renderAudio, collisions, schedule, SAMPLE_RATE } from '../src/core/audio/index.js';
import { scenes, type SceneName, type Simulation } from '../src/core/index.js';
import { songs, defaultSongs } from '../src/core/songs/index.js';

const temporary: string[] = [];
async function temp() { const root = resolve('.tmp/audio-test'); await mkdir(root, {recursive: true}); const path = await mkdtemp(join(root, 'case-')); temporary.push(path); return path; }
afterEach(async () => { for (const path of temporary.splice(0)) await rm(path, {recursive: true, force: true}); });

describe('sample acquisition', () => {
  it('loads the checksum-verified CC0 fallback without network access', async () => {
    const bank = await loadSamples({offline: true, fetcher: async () => { throw new Error('network must not run'); }});
    expect(bank.fallback).toBe(true); expect(bank.instruments[0].rootMidi).toBe(69);
    expect(bank.instruments[0].channels[0].some(x => x !== 0)).toBe(true);
  });
  it('reports a network failure and returns the fallback', async () => {
    const bank = await loadSamples({cacheDir: await temp(), fetcher: async () => { throw new Error('test network unavailable'); }});
    expect(bank.fallback).toBe(true); expect(bank.warning).toContain('test network unavailable');
  });
  it('rejects corrupt cached samples and downloaded bytes', async () => {
    const cacheDir = await temp(); await writeFile(join(cacheDir, 'Player_dyn2_rr1_012.wav'), 'corrupt');
    await expect(loadSamples({cacheDir})).rejects.toThrow('checksum mismatch');
    await expect(loadSamples({cacheDir: await temp(), fetcher: async () => new Response('corrupt')})).rejects.toThrow('checksum mismatch');
  });
});

describe('collision audio', () => {
  for (const scene of Object.keys(scenes) as SceneName[]) it(`${scene}: five seconds of WAV, every event on its collision frame`, async () => {
    const simulation = { scene, data: scenes[scene](1) } as Simulation;
    const events = collisions(simulation), melody = songs[defaultSongs[scene]].notes;
    const bank = await loadSamples({offline: true});
    const { wav, cues } = renderAudio(events, melody, bank, {duration: 5, fps: 30, bins: scene === 'galton'});
    const audio = decodeWav(wav);
    expect(audio.rate).toBe(48000); expect(audio.channels).toHaveLength(2); expect(audio.channels[0]).toHaveLength(240000);
    const inRange = events.filter(e => e.t >= 0 && e.t < 5);
    expect(cues.length).toBe(inRange.length); expect(cues.length).toBeGreaterThan(0);
    for (const [i, cue] of cues.entries()) {
      expect(cue.t).toBe(inRange[i].t);
      expect(Math.abs(cue.startSample / SAMPLE_RATE - inRange[i].t)).toBeLessThan(1 / SAMPLE_RATE + 1e-12);
      expect(cue.frame).toBe(Math.floor(inRange[i].t * 30));
    }
    const first = cues[0].startSample;
    expect(audio.channels[0].subarray(0, first).every(v => v === 0)).toBe(true);
    expect(audio.channels[0].subarray(first, first + 480).some(v => v !== 0)).toBe(true);
    let peak = 0; for (const channel of audio.channels) for (const value of channel) peak = Math.max(peak, Math.abs(value));
    expect(peak).toBeGreaterThan(0.88); expect(peak).toBeLessThanOrEqual(0.9);
  });
  it('plays an isolated impulse at the exact output sample and handles silence', () => {
    const bank = {fallback: false, instruments: [{rate: 48000, rootMidi: 69, source: 'test', channels: [new Float32Array([1, 0, 0])]}]};
    const event = {t: 0.25001, kind: 'wall' as const, pan: 0, velocity: 1};
    const rendered = renderAudio([event], [69], bank, {duration: 1, fps: 60});
    const wave = decodeWav(rendered.wav);
    expect(wave.channels[0].findIndex(v => v !== 0)).toBe(Math.floor(event.t * 48000));
    const silent = renderAudio([], [69], bank, {duration: 1, fps: 60});
    expect(decodeWav(silent.wav).channels[0].every(v => v === 0)).toBe(true);
  });
  it('maps Galton bins to fixed pitches, rejects empty melodies, and rejects malformed WAV', () => {
    const events = [{t: 0.1, kind: 'bin' as const, pan: 0, velocity: 1, bin: 6}, {t: 0.2, kind: 'bin' as const, pan: 0, velocity: 1, bin: 6}];
    expect(schedule(events, songs['d-pentatonic'].notes, 1, 60, 48000, true).map(c => c.note)).toEqual([62, 62]);
    expect(() => schedule(events, [], 1, 60)).toThrow('Melody');
    expect(() => decodeWav(Buffer.from('broken'))).toThrow('WAV');
    expect(() => encodeWav([new Float32Array([NaN])], 48000)).toThrow('Nonfinite');
  });
});
