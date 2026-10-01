import { mkdir, writeFile } from 'node:fs/promises';
import { URL, fileURLToPath } from 'node:url';
import process from 'node:process';
import { scenes } from '../dist/core/index.js';
import { createJob } from '../dist/core/job.js';
import { loadSamples, renderSoundtrack } from '../dist/core/audio/index.js';
import { mediaTool } from '../dist/render/media-tools.js';

const folder = new URL('../test/output/audio/', import.meta.url);
await mkdir(folder, {recursive: true});
const bank = await loadSamples({offline: true});
for (const scene of Object.keys(scenes)) for (const instrument of ['piano', 'synth']) {
  const job = await createJob({scene, seed: 1, fps: 30, duration: 5, instrument, format: '9:16', out: `${scene}.mp4`});
  const {wav, cues} = renderSoundtrack(job.score, {duration: job.duration, fps: job.options.fps, instrument, bank});
  const file = new URL(`${scene}-${instrument}.wav`, folder);
  await writeFile(file, wav);
  await writeFile(new URL(`${scene}-${instrument}.json`, folder), JSON.stringify(cues, null, 2) + '\n');
  const path = fileURLToPath(file);
  const probe = JSON.parse((await mediaTool('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path])).stdout);
  if (Number(probe.format.duration) !== 5 || probe.streams[0].sample_rate !== '48000' || probe.streams[0].channels !== 2) throw new Error(`Unexpected WAV metadata: ${scene}`);
  await mediaTool('ffmpeg', ['-nostdin', '-v', 'error', '-xerror', '-i', path, '-c:a', 'pcm_s16le', '-f', 'null', '-']);
  process.stdout.write(`${scene}/${instrument}: 5.000s, stereo 48000 Hz, ${cues.filter(cue => cue.role === 'melody').length} melody cues, decoded successfully\n`);
}
