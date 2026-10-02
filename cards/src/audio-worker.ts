import { loadFallback, renderSoundtrack } from '../../src/core/audio/browser.js';
import { prepareInstrument, type SampleBank } from '../../src/core/audio/sample-data.js';
import { buildTimeline, type OccasionId } from './songs.js';
import { cardScore } from './score.js';

export type AudioRequest = {id: number; occasion: OccasionId};
export type AudioResponse = {id: number; occasion: OccasionId; wav?: Uint8Array; error?: string};

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
  const {id, occasion} = event.data;
  try {
    const timeline = buildTimeline(occasion, 'you');
    const {wav} = renderSoundtrack(cardScore(timeline), {duration: timeline.end, fps: 60, instrument: 'piano', bank: await loadPiano()});
    self.postMessage({id, occasion, wav} satisfies AudioResponse, {transfer: [wav.buffer]});
  } catch (error) {
    self.postMessage({id, occasion, error: (error as Error).message} satisfies AudioResponse);
  }
};
