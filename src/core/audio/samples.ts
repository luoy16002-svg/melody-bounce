import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { prepareInstrument as instrument, type Instrument, type SampleBank } from './sample-data.js';
export type { Instrument, SampleBank } from './sample-data.js';

type Entry = { file: string; rootMidi: number; url: string; sha256: string; bytes: number };
type Manifest = { samples: Entry[]; fallback: {file: string; rootMidi: number; sha256: string} };
const assetUrl = (file: string) => new URL('../../../assets/' + file, import.meta.url);
const digest = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex');

export async function loadSamples(options: {cacheDir?: string; offline?: boolean; fetcher?: typeof fetch} = {}): Promise<SampleBank> {
  const manifest = JSON.parse(await readFile(assetUrl('samples.json'), 'utf8')) as Manifest;
  const offline = options.offline ?? process.env.MELODY_BOUNCE_OFFLINE === '1';
  const cacheDir = resolve(options.cacheDir ?? process.env.MELODY_BOUNCE_CACHE ?? '.cache/melody-bounce/samples');
  const fallback = async (warning?: string): Promise<SampleBank> => {
    const file = manifest.fallback, buffer = await readFile(assetUrl(file.file));
    if (digest(buffer) !== file.sha256) throw new Error('Bundled fallback sample checksum mismatch');
    return { instruments: [instrument(buffer, file.rootMidi, file.file)], fallback: true, warning };
  };
  if (offline) return fallback();
  const instruments: Instrument[] = [];
  try {
    await mkdir(cacheDir, { recursive: true });
    for (const entry of manifest.samples) {
      const path = join(cacheDir, entry.file);
      let buffer: Buffer | undefined;
      try { buffer = await readFile(path); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      if (buffer && (buffer.length !== entry.bytes || digest(buffer) !== entry.sha256)) throw new Error(`Sample checksum mismatch: ${entry.file}`);
      if (!buffer) {
        const response = await (options.fetcher ?? fetch)(entry.url, { signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error(`Sample download failed: HTTP ${response.status} (${entry.file})`);
        buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length !== entry.bytes || digest(buffer) !== entry.sha256) throw new Error(`Sample checksum mismatch: ${entry.file}`);
        const partial = path + '.' + randomUUID() + '.tmp';
        try { await writeFile(partial, buffer, { flag: 'wx' }); await rename(partial, path); }
        finally { await rm(partial, { force: true }); }
      }
      instruments.push(instrument(buffer, entry.rootMidi, entry.file));
    }
  } catch (error) {
    // Integrity failures are never hidden behind the offline fallback.
    if ((error as Error).message.includes('checksum mismatch')) throw error;
    return fallback(`Using bundled CC0 sample: ${(error as Error).message}`);
  }
  return { instruments, fallback: false };
}
