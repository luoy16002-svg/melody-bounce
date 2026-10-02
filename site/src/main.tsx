import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Player, type PlayerRef } from '@remotion/player';
import { scenes, type SceneName, type Simulation } from '../../src/core/index.js';
import { naturalDuration } from '../../src/core/timing.js';
import { songs, defaultSongs, type SongName } from '../../src/core/songs/index.js';
import type { InstrumentName } from '../../src/core/audio/voice.js';
import catalog from '../content/catalog.json';
import { VideoScene, type VideoProps } from './VideoScene.js';
import { readMidi, type MidiSong } from './midi.js';
import type { AudioRequest, AudioResponse } from './audio-worker.js';
import type { ExportSupport } from './export.js';
import { defaultSeeds, shuffleSeed } from './seeds.js';

const FPS = 60;
const sceneNames = Object.keys(scenes) as SceneName[];
const songNames = Object.keys(songs) as SongName[];
type SongChoice = SongName | 'midi';
type Midi = MidiSong & {bytes: Uint8Array; fileName: string};
type Ready = {simulation: Simulation; audioSrc: string; wav: Blob; seconds: number; musicTitle?: string; fallbackPiano: boolean};
type ExportState =
  | {phase: 'idle'}
  | {phase: 'running'; progress: number; started: number}
  | {phase: 'done'; url: string; fileName: string; size: number}
  | {phase: 'error'; message: string};

const query = new URLSearchParams(location.search);
const pick = <T extends string>(value: string | null, options: readonly T[], fallback: T): T => options.includes(value as T) ? value as T : fallback;
const initialScene = pick(query.get('scene'), sceneNames, 'hexagon');
const initialSong: SongChoice = pick(query.get('song'), songNames, defaultSongs[initialScene]);
const initialSeed = Number.isSafeInteger(Number(query.get('seed'))) && query.get('seed') ? Number(query.get('seed')) : defaultSeeds[initialScene];
const initialSound = pick<InstrumentName>(query.get('sound'), ['piano', 'synth'], 'piano');

const slug = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'song';
const mb = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;

function App() {
  const [scene, setScene] = useState<SceneName>(initialScene);
  const [song, setSong] = useState<SongChoice>(initialSong);
  const [songTouched, setSongTouched] = useState(query.has('song'));
  const [midi, setMidi] = useState<Midi>();
  const [seed, setSeed] = useState(initialSeed);
  const [seedTouched, setSeedTouched] = useState(query.has('seed'));
  const [sound, setSound] = useState<InstrumentName>(initialSound);
  const [credit, setCredit] = useState(true);
  const [exportFps, setExportFps] = useState(30);
  const [ready, setReady] = useState<Ready>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [midiError, setMidiError] = useState('');
  const [support, setSupport] = useState<ExportSupport>();
  const [job, setJob] = useState<ExportState>({phase: 'idle'});
  const [copied, setCopied] = useState(false);
  const [playing, setPlaying] = useState(false);
  const player = useRef<PlayerRef>(null);
  const worker = useRef<Worker>(undefined);
  const request = useRef(0);
  const abort = useRef<AbortController>(undefined);

  const notes = song === 'midi' && midi ? midi.notes : songs[song === 'midi' ? defaultSongs[scene] : song].notes;
  const songTitle = song === 'midi' && midi ? midi.title : songs[song === 'midi' ? defaultSongs[scene] : song].title;
  const musicTitle = song === 'midi' && midi ? midi.title : song === defaultSongs[scene] ? undefined : songTitle;
  const notesKey = useMemo(() => notes.join(','), [notes]);

  useEffect(() => {
    worker.current = new Worker(new URL('./audio-worker.ts', import.meta.url), {type: 'module'});
    import('./export.js').then(m => m.exportSupport()).then(setSupport, () => setSupport({ok: false, reason: 'Video export could not start in this browser.'}));
    return () => worker.current?.terminate();
  }, []);

  // Rebuild the simulation and its soundtrack whenever the inputs change.
  useEffect(() => {
    const id = ++request.current;
    setBusy(true); setError('');
    const timer = setTimeout(() => {
      try {
        const simulation = {scene, data: scenes[scene](seed)} as Simulation;
        const seconds = naturalDuration(simulation);
        const target = worker.current!;
        target.onmessage = (event: MessageEvent<AudioResponse>) => {
          if (event.data.id !== request.current) return;
          setBusy(false);
          if (event.data.error || !event.data.wav) { setError(event.data.error ?? 'The soundtrack could not be built.'); return; }
          const wav = new Blob([event.data.wav.buffer as ArrayBuffer], {type: 'audio/wav'});
          setReady(previous => {
            if (previous) setTimeout(() => URL.revokeObjectURL(previous.audioSrc), 2000);
            return {simulation, seconds, wav, audioSrc: URL.createObjectURL(wav), musicTitle, fallbackPiano: event.data.piano === 'fallback'};
          });
        };
        target.postMessage({id, simulation, notes, instrument: sound, duration: Math.round(seconds * FPS) / FPS, fps: FPS} satisfies AudioRequest);
      } catch (failure) {
        setBusy(false); setError((failure as Error).message);
      }
    }, 20);
    return () => clearTimeout(timer);
  }, [scene, seed, notesKey, sound, musicTitle]);

  useEffect(() => {
    const current = player.current;
    if (!current || !ready) return;
    const on = () => setPlaying(true), off = () => setPlaying(false);
    current.addEventListener('play', on); current.addEventListener('pause', off); current.addEventListener('ended', off);
    return () => { current.removeEventListener('play', on); current.removeEventListener('pause', off); current.removeEventListener('ended', off); };
  }, [ready]);

  // Keep the address bar shareable.
  useEffect(() => {
    const params = new URLSearchParams({scene});
    if (seedTouched || seed !== defaultSeeds[scene]) params.set('seed', String(seed));
    if (song !== 'midi' && (songTouched || song !== defaultSongs[scene])) params.set('song', song);
    if (sound !== 'piano') params.set('sound', sound);
    history.replaceState(null, '', `${location.pathname}?${params}`);
  }, [scene, seed, song, sound, songTouched, seedTouched]);

  const chooseScene = (name: SceneName) => {
    setScene(name);
    if (!songTouched && song !== 'midi') setSong(defaultSongs[name]);
    if (!seedTouched) setSeed(defaultSeeds[name]);
    resetJob();
  };
  const chooseSong = (name: SongChoice) => { setSong(name); setSongTouched(true); resetJob(); };
  const resetJob = () => setJob(current => {
    if (current.phase === 'done') URL.revokeObjectURL(current.url);
    return current.phase === 'running' ? current : {phase: 'idle'};
  });

  const onMidi = async (file: File | undefined, track?: number) => {
    setMidiError('');
    if (!file && !midi) return;
    try {
      const bytes = file ? new Uint8Array(await file.arrayBuffer()) : midi!.bytes;
      const fileName = file?.name ?? midi!.fileName;
      if (bytes.length > 4 * 1024 * 1024) throw new Error('That file is over 4 MB. MIDI files are usually much smaller.');
      const parsed = readMidi(bytes, fileName, track);
      setMidi({...parsed, bytes, fileName});
      setSong('midi'); setSongTouched(true); resetJob();
    } catch (failure) { setMidiError((failure as Error).message); }
  };

  const startExport = async () => {
    if (!ready || job.phase === 'running') return;
    player.current?.pause();
    const controller = new AbortController();
    abort.current = controller;
    setJob({phase: 'running', progress: 0, started: Date.now()});
    try {
      const {exportVideo} = await import('./export.js');
      const props: VideoProps = {simulation: ready.simulation, audioSrc: ready.audioSrc, musicTitle: ready.musicTitle, credit};
      const blob = await exportVideo({props, fps: exportFps, durationInFrames: Math.max(1, Math.round(ready.seconds * exportFps)), signal: controller.signal,
        onProgress: progress => setJob(current => current.phase === 'running' ? {...current, progress} : current)});
      const fileName = `melody-bounce-${scene}-${slug(songTitle)}-${seed}.mp4`;
      const url = URL.createObjectURL(blob);
      setJob({phase: 'done', url, fileName, size: blob.size});
      const link = document.createElement('a');
      link.href = url; link.download = fileName; link.click();
    } catch (failure) {
      if (controller.signal.aborted) setJob({phase: 'idle'});
      else setJob({phase: 'error', message: (failure as Error).message || 'The export failed.'});
    }
  };

  const downloadWav = () => {
    if (!ready) return;
    const link = document.createElement('a');
    link.href = ready.audioSrc; link.download = `melody-bounce-${scene}-${slug(songTitle)}-${seed}.wav`; link.click();
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(location.href); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
  };

  const inputProps = useMemo<VideoProps | undefined>(() => ready && {simulation: ready.simulation, audioSrc: ready.audioSrc, musicTitle: ready.musicTitle, credit}, [ready, credit]);
  const running = job.phase === 'running';
  const eta = job.phase === 'running' && job.progress > 0.03 ? Math.max(1, Math.round((Date.now() - job.started) / job.progress * (1 - job.progress) / 1000)) : undefined;

  return (
    <div className="maker">
      <div className="stage">
        <div className="phone">
          {inputProps && ready ? (
            <Player ref={player} component={VideoScene} inputProps={inputProps} durationInFrames={Math.max(1, Math.round(ready.seconds * FPS))}
              fps={FPS} compositionWidth={1080} compositionHeight={1920} controls loop clickToPlay doubleClickToFullscreen
              style={{width: '100%', height: '100%'}} acknowledgeRemotionLicense />
          ) : null}
          {ready && !busy && !playing && !error ? (
            <button type="button" className="play-big" aria-label="Play with sound" onClick={() => player.current?.play()}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" fill="currentColor" /></svg>
            </button>
          ) : null}
          {busy || !ready ? <div className="phone-wait"><span className="spinner" aria-hidden="true" />{ready ? 'Updating…' : 'Building the scene…'}</div> : null}
          {error ? <div className="phone-wait phone-error" role="alert">{error}</div> : null}
        </div>
        <p className="stage-note">
          {ready ? <>{ready.seconds.toFixed(1)} s · 1080×1920 · press play for sound</> : <>&nbsp;</>}
        </p>
      </div>

      <div className="panel">
        <section className="step">
          <h2><span className="num">1</span> Scene</h2>
          <div className="scene-grid" role="radiogroup" aria-label="Scene">
            {sceneNames.map(name => (
              <button key={name} type="button" role="radio" aria-checked={scene === name} className={`scene-tile${scene === name ? ' on' : ''}`} onClick={() => chooseScene(name)}>
                <img src={`/thumbs/${name}.webp`} alt="" width="120" height="120" />
                <span className="scene-name">{catalog.scenes[name].name}</span>
              </button>
            ))}
          </div>
          <p className="hint">{catalog.scenes[scene].summary} <a href={`/scenes/${scene}/`}>More about this scene</a></p>
        </section>

        <section className="step">
          <h2><span className="num">2</span> Song</h2>
          <div className="song-grid" role="radiogroup" aria-label="Song">
            {songNames.map(name => (
              <button key={name} type="button" role="radio" aria-checked={song === name} className={`song-chip${song === name ? ' on' : ''}`} onClick={() => chooseSong(name)}>
                <span className="song-title">{songs[name].title}</span>
                <span className="song-by">{songs[name].composer}{name === defaultSongs[scene] ? ' · made for this scene' : ''}</span>
              </button>
            ))}
          </div>
          <label className={`midi-drop${song === 'midi' ? ' on' : ''}`}
            onDragOver={event => event.preventDefault()}
            onDrop={event => { event.preventDefault(); void onMidi(event.dataTransfer.files[0]); }}>
            <input type="file" accept=".mid,.midi,audio/midi,audio/x-midi" onChange={event => { void onMidi(event.target.files?.[0]); event.target.value = ''; }} />
            <span className="midi-icon" aria-hidden="true">♪</span>
            {midi ? <span><b>{midi.title}</b><br /><small>{midi.notes.length} melody notes · click to choose another file</small></span>
              : <span><b>Use your own MIDI file</b><br /><small>Drop a .mid file here or click to choose one. It stays on your computer.</small></span>}
          </label>
          {midi && song === 'midi' && midi.tracks.length > 1 ? (
            <label className="field">Melody track
              <select value={midi.track} onChange={event => void onMidi(undefined, Number(event.target.value))}>
                {midi.tracks.map(t => <option key={t.index} value={t.index}>{t.label} ({t.notes} notes)</option>)}
              </select>
            </label>
          ) : null}
          {midiError ? <p className="error" role="alert">{midiError}</p> : null}
        </section>

        <section className="step">
          <h2><span className="num">3</span> Fine-tune</h2>
          <div className="row">
            <div className="field">
              <span>Variation</span>
              <div className="seed">
                <input type="number" step="1" value={seed} aria-label="Variation number"
                  onChange={event => { const value = Number(event.target.value); if (Number.isSafeInteger(value)) { setSeed(value); setSeedTouched(true); resetJob(); } }} />
                <button type="button" className="ghost" onClick={() => { setSeed(shuffleSeed(scene, seed)); setSeedTouched(true); resetJob(); }}>Shuffle</button>
              </div>
            </div>
            <div className="field">
              <span>Sound</span>
              <div className="segmented" role="radiogroup" aria-label="Sound">
                {(['piano', 'synth'] as const).map(name => (
                  <button key={name} type="button" role="radio" aria-checked={sound === name} className={sound === name ? 'on' : ''} onClick={() => { setSound(name); resetJob(); }}>
                    {name === 'piano' ? 'Piano' : 'Synth'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label className="check">
            <input type="checkbox" checked={credit} onChange={event => { setCredit(event.target.checked); resetJob(); }} />
            <span>Add a small melodybounce.com credit at the bottom</span>
          </label>
        </section>

        <section className="step export">
          <h2><span className="num">4</span> Download</h2>
          {support && !support.ok ? (
            <div className="notice">
              <p>{support.reason}</p>
              <p>You can still save the soundtrack, or render the video on your computer with the <a href="https://github.com/luoy16002-svg/melody-bounce">command-line version</a>.</p>
              <button type="button" className="ghost" disabled={!ready} onClick={downloadWav}>Download the soundtrack (WAV)</button>
            </div>
          ) : (
            <>
              <div className="row">
                <div className="segmented" role="radiogroup" aria-label="Frame rate">
                  {[30, 60].map(rate => (
                    <button key={rate} type="button" role="radio" aria-checked={exportFps === rate} className={exportFps === rate ? 'on' : ''} disabled={running} onClick={() => setExportFps(rate)}>
                      {rate} fps
                    </button>
                  ))}
                </div>
                <span className="hint inline">{exportFps === 60 ? 'Smoother motion, takes about twice as long.' : 'Standard for TikTok, Shorts and Reels.'}</span>
              </div>
              {job.phase === 'running' ? (
                <div className="progress" role="status">
                  <div className="bar"><div style={{width: `${Math.round(job.progress * 100)}%`}} /></div>
                  <div className="progress-row">
                    <span>Rendering {Math.round(job.progress * 100)}%{eta ? ` · about ${eta} s left` : ''} · keep this tab open</span>
                    <button type="button" className="link" onClick={() => abort.current?.abort()}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="primary" disabled={!ready || busy || support === undefined} onClick={startExport}>
                  Download MP4{ready ? ` · ${ready.seconds.toFixed(0)} s` : ''}
                </button>
              )}
              {job.phase === 'done' ? (
                <p className="done">Saved <b>{job.fileName}</b> ({mb(job.size)}). <a href={job.url} download={job.fileName}>Download again</a></p>
              ) : null}
              {job.phase === 'error' ? <p className="error" role="alert">Export failed: {job.message}</p> : null}
              <p className="hint">The video is made right here in your browser. Nothing is uploaded.</p>
            </>
          )}
          <div className="share">
            <button type="button" className="link" onClick={copyLink}>{copied ? 'Link copied' : 'Copy a link to these settings'}</button>
            {ready ? <button type="button" className="link" onClick={downloadWav}>Soundtrack only (WAV)</button> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

createRoot(document.getElementById('app')!).render(<App />);
