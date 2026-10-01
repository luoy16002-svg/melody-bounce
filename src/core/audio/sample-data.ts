import { decodeWav, type Sample } from './wav.js';
export type Instrument = Sample & {rootMidi: number; source: string};
export type SampleBank = {instruments: Instrument[]; fallback: boolean; warning?: string};

export function prepareInstrument(buffer: Uint8Array, rootMidi: number, source: string): Instrument {
  const sample = decodeWav(buffer);
  let onset = 0;
  while (onset < sample.channels[0].length && sample.channels.every(c => Math.abs(c[onset]) <= 1e-4)) onset++;
  if (onset === sample.channels[0].length) throw new Error(`Silent sample: ${source}`);
  return {...sample, channels: sample.channels.map(c => c.slice(onset)), rootMidi, source};
}
