import {availableParallelism} from 'node:os';
import { constants } from 'node:fs';
import { access, copyFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderMedia, selectComposition, type HeadlessBrowser } from '@remotion/renderer';
import type { RenderJob } from '../core/job.js';
import { loadSamples } from '../core/audio/samples.js';
import { renderSoundtrack } from '../core/audio/mix.js';
import { defaultSongs, songs } from '../core/songs/index.js';
import type { RenderInput } from './types.js';
import { mediaTool } from './media-tools.js';
import { removeWorkDirectory } from './workspace.js';

export type RenderSession = {serveUrl: string; browser: HeadlessBrowser; workDir: string; close: () => Promise<void>};
export type RenderSettings = {
  scale?: number;
  concurrency?: number;
  workDir?: string;
  browserExecutable?: string;
  offline?: boolean;
  keepArtifacts?: boolean;
  onProgress?: (progress: number) => void;
};

type GlBackend = 'angle' | 'swangle' | 'egl' | 'swiftshader' | 'vulkan' | 'angle-egl';
const glBackends: readonly GlBackend[] = ['angle', 'swangle', 'egl', 'swiftshader', 'vulkan', 'angle-egl'];

/** GPU-backed ANGLE on desktops; software ANGLE on Linux, where CI machines usually have no GPU. */
function renderGl(): GlBackend {
  const requested = process.env.MELODY_BOUNCE_GL as GlBackend | undefined;
  if (requested && glBackends.includes(requested)) return requested;
  return process.platform === 'linux' ? 'swangle' : 'angle';
}

/** Half the logical cores, between 1 and 8; MELODY_BOUNCE_CONCURRENCY overrides it. */
function defaultConcurrency(): number {
  const requested = Number(process.env.MELODY_BOUNCE_CONCURRENCY);
  if (Number.isInteger(requested) && requested > 0) return requested;
  return Math.max(1, Math.min(8, Math.floor(availableParallelism() / 2)));
}

/** Share one bundle/browser when rendering several clips; callers must close the session. */
export async function createRenderSession(settings: RenderSettings = {}): Promise<RenderSession> {
  const workDir = resolve(settings.workDir ?? '.cache/melody-bounce/render');
  await mkdir(workDir, {recursive: true});
  const bundleDir = await mkdtemp(join(workDir, 'bundle-'));
  let browser: HeadlessBrowser | undefined;
  try {
    let entryPoint = fileURLToPath(new URL('./entry.js', import.meta.url));
    try { await access(entryPoint); } catch { entryPoint = fileURLToPath(new URL('./entry.ts', import.meta.url)); }
    const serveUrl = await bundle({entryPoint, outDir: bundleDir, rootDir: fileURLToPath(new URL('../../', import.meta.url)), publicDir: null, enableCaching: false,
      webpackOverride: config => ({...config, resolve: {...config.resolve, extensionAlias: {'.js': ['.js', '.ts', '.tsx']}}}),
    });
    browser = await openBrowser('chrome', {
      browserExecutable: settings.browserExecutable ?? process.env.MELODY_BOUNCE_BROWSER_EXECUTABLE,
      chromiumOptions: {gl: renderGl()}, logLevel: 'warn',
    });
    const ownedBrowser = browser;
    let closed = false;
    return {serveUrl, browser, workDir, close: async () => {
      if (closed) return;
      closed = true;
      try { await ownedBrowser.close({silent: true}); }
      finally { await removeWorkDirectory(bundleDir, workDir); }
    }};
  } catch (error) {
    if (browser) await browser.close({silent: true});
    await removeWorkDirectory(bundleDir, workDir);
    throw error;
  }
}

/** Render silent pictures first, then mux the collision-aligned WAV with Remotion's bundled FFmpeg. */
export async function renderVideo(job: RenderJob, settings: RenderSettings = {}, sharedSession?: RenderSession) {
  const scale = settings.scale ?? 1, concurrency = settings.concurrency ?? defaultConcurrency();
  if (!Number.isFinite(scale) || scale <= 0 || scale > 1 || (1080 * scale) % 2 || (1920 * scale) % 2) throw new Error('Render scale must produce even video dimensions and be between 0 and 1');
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error('Render concurrency must be a positive integer');
  const output = resolve(job.options.out);
  try { await access(output); throw new Error(`Output already exists: ${output}`); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  await mkdir(dirname(output), {recursive: true});
  const session = sharedSession ?? await createRenderSession(settings);
  let work: string | undefined;
  try {
    work = await mkdtemp(join(session.workDir, 'job-'));
    const bank = job.options.instrument === 'synth' ? undefined : await loadSamples({offline: settings.offline});
    const audio = renderSoundtrack(job.score, {duration: job.duration, fps: job.options.fps, instrument: job.options.instrument, bank});
    const wavPath = join(work, 'audio.wav'), videoPath = join(work, 'silent.mp4'), muxed = join(work, 'finished.mp4');
    await writeFile(wavPath, audio.wav);
    const inputProps: RenderInput = {simulation: job.simulation, fps: job.options.fps, durationInFrames: job.durationInFrames,
      musicTitle: job.options.midi ? basename(job.options.midi) : job.song && job.song !== defaultSongs[job.simulation.scene] ? songs[job.song].title : undefined,
    };
    const composition = await selectComposition({serveUrl: session.serveUrl, id: 'melody-bounce', inputProps, puppeteerInstance: session.browser, logLevel: 'warn'});
    await renderMedia({composition, serveUrl: session.serveUrl, inputProps, outputLocation: videoPath, codec: 'h264',
      muted: true, scale, concurrency, crf: 20, puppeteerInstance: session.browser, logLevel: 'warn',
      onProgress: progress => settings.onProgress?.(progress.progress),
    });
    await mediaTool('ffmpeg', ['-nostdin', '-v', 'error', '-i', videoPath, '-i', wavPath,
      '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
      '-t', String(job.duration), '-movflags', '+faststart', muxed]);
    // Copy exclusively: never replace a pre-existing video, including a concurrent writer.
    await copyFile(muxed, output, constants.COPYFILE_EXCL);
    if (settings.keepArtifacts) await writeFile(join(work, 'cues.json'), JSON.stringify(audio.cues, null, 2) + '\n');
    return {output, duration: job.duration, fps: job.options.fps, frames: job.durationInFrames,
      width: Math.round(1080 * scale), height: Math.round(1920 * scale), cues: audio.cues,
      warning: bank?.warning, artifacts: settings.keepArtifacts ? work : undefined};
  } finally {
    try { if (work && !settings.keepArtifacts) await removeWorkDirectory(work, session.workDir); }
    finally { if (!sharedSession) await session.close(); }
  }
}
