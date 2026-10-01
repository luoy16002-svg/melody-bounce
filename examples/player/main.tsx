import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Player, type PlayerRef } from '@remotion/player';
import { Scene } from '../../src/render/compositions/index.js';
import { scenes, type SceneName, type Simulation } from '../../src/core/index.js';
import { naturalDuration } from '../../src/core/timing.js';
import { songs, defaultSongs, type SongName } from '../../src/core/songs/index.js';
import type { InstrumentName } from '../../src/core/audio/voice.js';
import type { AudioRequest, AudioResponse } from './audio-worker.js';

const query = new URLSearchParams(location.search);
const initialScene = Object.hasOwn(scenes, query.get('scene') ?? '') ? query.get('scene') as SceneName : 'hexagon';
const initialSeed = Number(query.get('seed') ?? 14);
const initialInstrument: InstrumentName = query.get('instrument') === 'synth' ? 'synth' : 'piano';
const autoPlay = query.get('autoplay') === '1';
const fps = 60;
type Ready = {simulation: Simulation; audioSrc: string; durationInFrames: number; musicTitle?: string; cueCount: number};

function App() {
  const [scene, setScene] = useState<SceneName>(initialScene), [seed, setSeed] = useState(initialSeed);
  const [song, setSong] = useState<SongName>(defaultSongs[initialScene]), [instrument, setInstrument] = useState<InstrumentName>(initialInstrument);
  const [duration, setDuration] = useState(query.get('duration') ?? '');
  const [revision, setRevision] = useState(0), [ready, setReady] = useState<Ready>();
  const [error, setError] = useState('');
  const player = useRef<PlayerRef>(null), container = useRef<HTMLDivElement>(null);
  const request = useRef(0);
  const configuration = useRef({scene, seed, song, instrument, duration});
  configuration.current = {scene, seed, song, instrument, duration};

  useEffect(() => {
    const worker = new Worker(new URL('./audio-worker.ts', import.meta.url), {type: 'module'});
    let objectUrl: string | undefined;
    const id = ++request.current;
    const config = configuration.current;
    setReady(undefined); setError('');
    try {
      if (!Number.isSafeInteger(config.seed)) throw new Error('Seed must be an integer');
      const simulation = {scene: config.scene, data: scenes[config.scene](config.seed)} as Simulation;
      const end = naturalDuration(simulation), seconds = config.duration ? Number(config.duration) : end;
      if (!Number.isFinite(seconds) || seconds <= 0 || seconds > end) throw new Error(`Duration must be between 0 and ${end.toFixed(3)}`);
      const durationInFrames = Math.max(1, Math.round(seconds * fps));
      worker.onmessage = (event: MessageEvent<AudioResponse>) => {
        if (event.data.id !== request.current) return;
        if (event.data.error) { setError(event.data.error); return; }
        if (!event.data.wav) { setError('Audio worker returned no WAV'); return; }
        objectUrl = URL.createObjectURL(new Blob([event.data.wav.buffer as ArrayBuffer], {type: 'audio/wav'}));
        setReady({simulation, audioSrc: objectUrl, durationInFrames, cueCount: event.data.cueCount ?? 0,
          musicTitle: config.song === defaultSongs[config.scene] ? undefined : songs[config.song].title});
      };
      worker.onerror = event => setError(event.message);
      // This one simulation object drives both the visuals and the audio worker.
      worker.postMessage({id, simulation, notes: songs[config.song].notes, instrument: config.instrument, duration: durationInFrames / fps, fps} satisfies AudioRequest);
    } catch (failure) { setError((failure as Error).message); }
    return () => { request.current++; worker.terminate(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [revision]);

  useEffect(() => {
    const current = player.current;
    if (!current || !ready) return;
    const update = (event: {detail: {frame: number}}) => { if (container.current) container.current.dataset.frame = String(event.detail.frame); };
    current.addEventListener('frameupdate', update);
    return () => current.removeEventListener('frameupdate', update);
  }, [ready]);

  return <>
    <form onSubmit={event => { event.preventDefault(); setRevision(value => value + 1); }}>
      <label>Scene <select value={scene} onChange={event => { const name = event.target.value as SceneName; setScene(name); setSong(defaultSongs[name]); }}>
        {Object.keys(scenes).map(name => <option key={name}>{name}</option>)}
      </select></label>{' '}
      <label>Seed <input type="number" step="1" value={seed} onChange={event => setSeed(Number(event.target.value))} /></label>{' '}
      <label>Song <select value={song} onChange={event => setSong(event.target.value as SongName)}>
        {Object.entries(songs).map(([id, entry]) => <option key={id} value={id}>{entry.title}</option>)}
      </select></label>{' '}
      <label>Instrument <select value={instrument} onChange={event => setInstrument(event.target.value as InstrumentName)}><option value="piano">piano</option><option value="synth">synth</option></select></label>{' '}
      <label>Duration <input type="number" step="any" min="0" value={duration} onChange={event => setDuration(event.target.value)} /></label>{' '}
      <button type="submit">Load scene</button>
    </form>
    {error ? <p role="alert">{error}</p> : !ready ? <p role="status">Loading…</p> : <div ref={container} data-ready="true" data-scene={ready.simulation.scene} data-cues={ready.cueCount} data-frame="0">
      <Player ref={player} component={Scene} inputProps={{simulation: ready.simulation, audioSrc: ready.audioSrc, musicTitle: ready.musicTitle}}
        durationInFrames={ready.durationInFrames} fps={fps} compositionWidth={1080} compositionHeight={1920}
        controls loop autoPlay={autoPlay} initiallyMuted={autoPlay} style={{width: 270, height: 480}} />
    </div>}
  </>;
}
createRoot(document.getElementById('root')!).render(<App />);
