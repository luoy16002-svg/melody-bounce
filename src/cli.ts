#!/usr/bin/env node
import { parseCommand } from './options.js';
import { scenes } from './core/index.js';
import { songs, defaultSongs } from './core/songs/index.js';
import { createJob } from './core/job.js';

async function main(): Promise<void> {
  const command = parseCommand(process.argv.slice(2));
  if (command.command === 'help') {
    process.stdout.write('melody-bounce list-scenes\nmelody-bounce list-songs\nmelody-bounce render --scene NAME [--song NAME | --midi FILE [--track INDEX]]\n  [--seed INTEGER] [--fps 1..120] [--duration SECONDS] [--format 9:16]\n  [--instrument piano|synth] [--out FILE.mp4]\n');
  } else if (command.command === 'list-scenes') {
    for (const scene of Object.keys(scenes) as (keyof typeof scenes)[]) process.stdout.write(`${scene}\t9:16\t${defaultSongs[scene]}\n`);
  } else if (command.command === 'list-songs') {
    for (const [id, song] of Object.entries(songs)) process.stdout.write(`${id}\t${song.title}\t${song.composer}\n`);
  } else if (command.command === 'render') {
    const job = await createJob(command.options);
    const { renderVideo } = await import('./render/index.js');
    const result = await renderVideo(job);
    if (result.warning) process.stderr.write(result.warning + '\n');
    process.stdout.write(`${result.output}\t${result.frames} frames\t${result.duration.toFixed(3)} seconds\n`);
  }
}
main().catch((error: unknown) => { process.stderr.write(`melody-bounce: ${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
