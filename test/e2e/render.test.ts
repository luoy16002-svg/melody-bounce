import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { createJob } from '../../src/core/job.js';
import { scenes } from '../../src/core/index.js';
import { naturalDuration } from '../../src/core/timing.js';
import { createRenderSession, renderVideo, type RenderSession } from '../../src/render/index.js';
import { mediaTool } from '../../src/render/media-tools.js';
import { removeWorkDirectory } from '../../src/render/workspace.js';
import { decodeWav, encodeWav } from '../../src/core/audio/wav.js';
import type { RenderInput } from '../../src/render/types.js';

const cases = [
  ['rings', 10, 'Escape.tsx', 'Escape'], ['hexagon', 14, 'mb/Hexagon.tsx', 'Hexagon'],
  ['galton', 281, 'mb/Galton.tsx', 'Galton'], ['grow', 115, 'Grow.tsx', 'Grow'],
  ['multiply', 4, 'Multiply.tsx', 'Multiply'], ['shrink', 7, 'mb/Shrink.tsx', 'Shrink'],
  ['strings', 4, 'Strings.tsx', 'Strings'], ['colorwar', 166, 'mb/ColorWar.tsx', 'ColorWar'],
  ['race', 116, 'Race.tsx', 'Race'],
] as const;
let session: RenderSession, output: string, reference: string, referenceBundle: string;

type Probe = {format: {duration: string}; streams: {codec_type: string; codec_name: string; width?: number; height?: number; nb_frames?: string; start_time?: string; sample_rate?: string; channels?: number}[]};

// Compare decoded AAC with its source WAV using a 2 ms RMS envelope. This catches
// mux/encoder offsets independently of the scheduled-cue metadata.
function audioLag(a: Float32Array, b: Float32Array) {
  const step = 96, count = Math.floor(Math.min(a.length, b.length) / step);
  const envelope = (signal: Float32Array) => Array.from({length: count}, (_, i) => {
    let power = 0; for (let j = 0; j < step; j++) power += signal[i * step + j] ** 2;
    return Math.sqrt(power / step);
  });
  const x = envelope(a), y = envelope(b);
  let best = -Infinity, lag = 0;
  for (let delta = -20; delta <= 20; delta++) {
    let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, n = 0;
    for (let i = Math.max(0, -delta); i < Math.min(count, count - delta); i++) {
      const left = x[i], right = y[i + delta]; sx += left; sy += right; sxx += left * left; syy += right * right; sxy += left * right; n++;
    }
    const correlation = (sxy - sx * sy / n) / Math.sqrt((sxx - sx * sx / n) * (syy - sy * sy / n));
    if (correlation > best) { best = correlation; lag = delta * 2; }
  }
  return {milliseconds: lag, correlation: best};
}

beforeAll(async () => {
  await mkdir(resolve('test/output/e2e'), {recursive: true});
  output = await mkdtemp(resolve('test/output/e2e/run-'));
  session = await createRenderSession();
  reference = await mkdtemp(resolve('.tmp/e2e/reference-'));
  const publicDir = join(reference, 'public'); await mkdir(publicDir);
  const blank = encodeWav([new Float32Array(5 * 48000)], 48000);
  const declarations: string[] = ["import React from 'react';", "import {Composition, registerRoot} from 'remotion';"];
  const compositions: string[] = [];
  for (const [scene, seed, file, component] of cases) {
    const target = join(reference, 'src', file); await mkdir(dirname(target), {recursive: true});
    await copyFile(resolve('test/reference/compositions', file), target);
    const data = scenes[scene](seed), name = scene === 'rings' ? 'escape' : scene;
    await writeFile(join(publicDir, name + '.json'), JSON.stringify(data));
    await writeFile(join(publicDir, name + '.wav'), blank);
    declarations.push(`import {${component}} from './${file.replace(/\.tsx$/, '')}';`);
    const duration = naturalDuration({scene, data} as Parameters<typeof naturalDuration>[0]);
    compositions.push(`<Composition id="${scene}" component={${component}} fps={60} width={1080} height={1920} durationInFrames={${Math.round(duration * 60)}} />`);
  }
  await copyFile(resolve('test/reference/compositions/mb/Shell.tsx'), join(reference, 'src/mb/Shell.tsx'));
  const entryPoint = join(reference, 'src/entry.tsx');
  await writeFile(entryPoint, declarations.join('\n') + '\nconst Root = () => <>' + compositions.join('') + '</>;\nregisterRoot(Root);\n');
  referenceBundle = await bundle({entryPoint, rootDir: resolve('.'), publicDir, outDir: join(reference, 'bundle'), enableCaching: false,
    webpackOverride: config => ({...config, resolve: {...config.resolve, alias: {...config.resolve?.alias, '@remotion/google-fonts/Outfit': resolve('dist/render/font.js')}}}),
  });
});
afterAll(async () => {
  try { if (session) await session.close(); }
  finally { if (reference) await removeWorkDirectory(reference, resolve('.tmp/e2e')); }
});

describe('five-second scene renders and original-composition parity', () => {
  for (const [scene, seed] of cases) it(`${scene}: H.264/AAC, duration, collisions, decode, pixels`, async () => {
    const job = await createJob({scene, seed, fps: 6, duration: 5, format: '9:16', out: join(output, scene + '.mp4')});
    const result = await renderVideo(job, {scale: 0.25, concurrency: 2, offline: true, keepArtifacts: true}, session);
    const probe = JSON.parse((await mediaTool('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', result.output])).stdout) as Probe;
    const video = probe.streams.find(s => s.codec_type === 'video')!, audio = probe.streams.find(s => s.codec_type === 'audio')!;
    expect(Number(probe.format.duration)).toBeCloseTo(5, 3);
    expect(video.codec_name).toBe('h264'); expect(video.width).toBe(270); expect(video.height).toBe(480); expect(Number(video.nb_frames)).toBe(30);
    expect(audio.codec_name).toBe('aac'); expect(audio.sample_rate).toBe('48000'); expect(audio.channels).toBe(2);
    expect(Number(video.start_time ?? 0)).toBeCloseTo(0, 4); expect(Number(audio.start_time ?? 0)).toBeCloseTo(0, 4);
    const referenceName = scene === 'rings' ? 'escape' : scene;
    const oracle = JSON.parse(await readFile(resolve(`test/golden/audio/${referenceName}-${seed}.json`), 'utf8')) as {melody: {t: number}[]};
    const selected = oracle.melody.filter(c => c.t < 5);
    const melodic = result.cues.filter(c => c.role === 'melody');
    expect(melodic.map(c => c.t)).toEqual(selected.map(c => c.t));
    expect(melodic.map(c => c.frame)).toEqual(selected.map(c => Math.floor(c.t * job.options.fps)));
    for (const cue of result.cues.filter(c => c.collisionTime !== undefined)) {
      expect(cue.t).toBe(cue.collisionTime);
      expect(Math.abs(cue.startSample / 48000 - cue.t)).toBeLessThanOrEqual(1 / 48000 + 1e-12);
    }
    await mediaTool('ffmpeg', ['-nostdin', '-v', 'error', '-xerror', '-i', result.output, '-c:v', 'rawvideo', '-c:a', 'pcm_s16le', '-f', 'null', '-']);
    const decodedPath = join(output, scene + '-decoded.wav');
    await mediaTool('ffmpeg', ['-nostdin', '-v', 'error', '-i', result.output, '-map', '0:a:0', '-c:a', 'pcm_s16le', decodedPath]);
    const original = decodeWav(await readFile(join(result.artifacts!, 'audio.wav'))), decoded = decodeWav(await readFile(decodedPath));
    const lag = audioLag(original.channels[0], decoded.channels[0]);
    expect(lag.correlation).toBeGreaterThan(0.85); expect(Math.abs(lag.milliseconds)).toBeLessThanOrEqual(4);

    const inputProps: RenderInput = {simulation: job.simulation, fps: 6, durationInFrames: 30};
    const adaptedComposition = await selectComposition({serveUrl: session.serveUrl, id: 'melody-bounce', inputProps, puppeteerInstance: session.browser, logLevel: 'error'});
    const originalComposition = await selectComposition({serveUrl: referenceBundle, id: scene, puppeteerInstance: session.browser, logLevel: 'error'});
    const adaptedPng = join(output, scene + '-adapted.png'), originalPng = join(output, scene + '-original.png');
    await renderStill({serveUrl: session.serveUrl, composition: adaptedComposition, inputProps, frame: 24, scale: 0.25, imageFormat: 'png', output: adaptedPng, puppeteerInstance: session.browser, logLevel: 'error'});
    await renderStill({serveUrl: referenceBundle, composition: originalComposition, frame: 240, scale: 0.25, imageFormat: 'png', output: originalPng, puppeteerInstance: session.browser, logLevel: 'error'});
    expect((await readFile(adaptedPng)).equals(await readFile(originalPng)), 'adapted/source PNG at t=4 s, output FPS 6 vs 60').toBe(true);
    await writeFile(join(output, scene + '-report.json'), JSON.stringify({scene, seed, duration: result.duration, frames: result.frames, melodyCues: melodic.length, audioLag: lag, pixelsIdentical: true}, null, 2));
  });
});
