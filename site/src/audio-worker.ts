import { createScore, loadFallback, renderSoundtrack } from '../../src/core/audio/browser.js';
import { prepareInstrument, type SampleBank } from '../../src/core/audio/sample-data.js';
import type { Simulation } from '../../src/core/index.js';
import type { InstrumentName } from '../../src/core/audio/voice.js';

export type AudioRequest = {id: number; simulation: Simulation; notes: number[]; instrument: InstrumentName; duration: number; fps: number};
export type AudioResponse = {id: number; wav?: Uint8Array; error?: string; cueCount?: number; piano?: 'full' | 'fallback'};

// Five upright piano notes from VSCO-2 CE (CC0), trimmed to 4.5 s mono for the web.
const PIANO = [45, 57, 69, 81, 93];
let bank: Promise<SampleBank> | undefined;

function loadPiano(): Promise<SampleBank> {
  bank ??= Promise.all(PIANO.map(async root => {
    const response = await fetch(`/piano/upright-${root}.wav`);
    if (!response.ok) throw new Error(`Piano sample ${root}: HTTP ${response.status}`);
    return prepareInstrument(new Uint8Array(await response.arrayBuffer()), root, `upright-${root}.wav`);
  })).then(instruments => ({instruments, fallback: false}), () => loadFallback());
  return bank;
}

self.onmessage = async (event: MessageEvent<AudioRequest>) => {
  const request = event.data;
  try {
    const samples = request.instrument === 'piano' ? await loadPiano() : undefined;
    const score = createScore(request.simulation, request.notes);
    const {wav, cues} = renderSoundtrack(score, {...request, bank: samples});
    self.postMessage({id: request.id, wav, cueCount: cues.filter(c => c.role === 'melody').length, piano: samples?.fallback ? 'fallback' : 'full'} satisfies AudioResponse, {transfer: [wav.buffer]});
  } catch (error) {
    self.postMessage({id: request.id, error: (error as Error).message} satisfies AudioResponse);
  }
};
