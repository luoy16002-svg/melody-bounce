import { prepareInstrument, type SampleBank } from './sample-data.js';
export { createScore, timedCues } from './score.js';
export { renderSoundtrack } from './mix.js';
export { decodeWav, encodeWav } from './wav.js';
export type { InstrumentName, Score, ScoreCue } from './voice.js';

/** Fetch the same verified, tiny CC0 bank used in offline Node tests. No Node imports. */
export async function loadFallback(): Promise<SampleBank> {
  const response = await fetch(new URL('../../../assets/samples.json', import.meta.url));
  if (!response.ok) throw new Error(`Sample manifest: HTTP ${response.status}`);
  const manifest = await response.json() as {fallback: {sha256: string; rootMidi: number; file: string}};
  const audio = await fetch(new URL('../../../assets/fallback.wav', import.meta.url));
  if (!audio.ok) throw new Error(`Fallback sample: HTTP ${audio.status}`);
  const buffer = await audio.arrayBuffer();
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)), v => v.toString(16).padStart(2, '0')).join('');
  if (digest !== manifest.fallback.sha256) throw new Error('Bundled fallback sample checksum mismatch');
  return {instruments: [prepareInstrument(new Uint8Array(buffer), manifest.fallback.rootMidi, manifest.fallback.file)], fallback: true};
}
