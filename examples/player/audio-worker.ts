import { createScore, loadFallback, renderSoundtrack } from '../../src/core/audio/browser.js';
import type { Simulation } from '../../src/core/index.js';
import type { InstrumentName } from '../../src/core/audio/voice.js';
export type AudioRequest = {id: number; simulation: Simulation; notes: number[]; instrument: InstrumentName; duration: number; fps: number};
export type AudioResponse = {id: number; wav?: Uint8Array; error?: string; cueCount?: number};

self.onmessage = async (event: MessageEvent<AudioRequest>) => {
  const request = event.data;
  try {
    const bank = request.instrument === 'piano' ? await loadFallback() : undefined;
    const score = createScore(request.simulation, request.notes);
    const {wav, cues} = renderSoundtrack(score, {...request, bank});
    self.postMessage({id: request.id, wav, cueCount: cues.filter(c => c.role === 'melody').length} satisfies AudioResponse, {transfer: [wav.buffer]});
  } catch (error) { self.postMessage({id: request.id, error: (error as Error).message} satisfies AudioResponse); }
};
