import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Player, type PlayerRef } from '@remotion/player';
import { CardVideo, type VideoProps } from './CardVideo.js';
import { cardSeconds } from './Card.js';
import { OCCASIONS, OCCASION_IDS, cleanName, cleanText, type OccasionId } from './songs.js';
import type { AudioRequest, AudioResponse } from './audio-worker.js';

const FPS = 30;
const SITE = 'https://card.melodybounce.com';
const PATHS: Record<string, OccasionId> = {'/birthday/': 'birthday', '/congratulations/': 'congrats', '/halloween/': 'halloween', '/christmas/': 'christmas'};

type Card = {occasion: OccasionId; to: string; from: string; message: string};

function readHash(): Card | undefined {
  const params = new URLSearchParams(location.hash.slice(1));
  const occasion = params.get('o') as OccasionId;
  const to = cleanName(params.get('to') ?? '');
  if (!OCCASION_IDS.includes(occasion) || !to) return undefined;
  return {occasion, to, from: cleanName(params.get('from') ?? ''), message: cleanText(params.get('m') ?? '', 80)};
}

function cardUrl(card: Card): string {
  const params = new URLSearchParams({o: card.occasion, to: card.to});
  if (card.from) params.set('from', card.from);
  if (card.message) params.set('m', card.message);
  return `${SITE}/c/#${params}`;
}

/** Soundtracks do not depend on the name, so each occasion is rendered once. */
function useSoundtrack(occasion: OccasionId): string | undefined {
  const [urls, setUrls] = useState<Partial<Record<OccasionId, string>>>({});
  const worker = useRef<Worker>(undefined);
  const asked = useRef(new Set<OccasionId>());
  useEffect(() => {
    worker.current = new Worker(new URL('./audio-worker.ts', import.meta.url), {type: 'module'});
    worker.current.onmessage = (event: MessageEvent<AudioResponse>) => {
      const {occasion: done, wav} = event.data;
      if (wav) setUrls(current => ({...current, [done]: URL.createObjectURL(new Blob([wav.buffer as ArrayBuffer], {type: 'audio/wav'}))}));
    };
    return () => worker.current?.terminate();
  }, []);
  useEffect(() => {
    if (!worker.current || asked.current.has(occasion)) return;
    asked.current.add(occasion);
    worker.current.postMessage({id: Date.now(), occasion} satisfies AudioRequest);
  }, [occasion, urls]);
  return urls[occasion];
}

function slug(text: string) { return text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'card'; }

function useExport() {
  const [state, setState] = useState<{phase: 'idle' | 'running' | 'done' | 'error'; progress: number; message?: string}>({phase: 'idle', progress: 0});
  const abort = useRef<AbortController>(undefined);
  const run = async (props: VideoProps, seconds: number, fileName: string) => {
    const controller = new AbortController();
    abort.current = controller;
    setState({phase: 'running', progress: 0});
    try {
      const {canExport, exportCard} = await import('./export.js');
      if (!(await canExport())) throw new Error('This browser cannot make video files. Try a recent Chrome or Edge.');
      const blob = await exportCard(props, seconds, progress => setState(s => (s.phase === 'running' ? {...s, progress} : s)), controller.signal);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob); link.download = fileName; link.click();
      setState({phase: 'done', progress: 1});
    } catch (error) {
      setState(controller.signal.aborted ? {phase: 'idle', progress: 0} : {phase: 'error', progress: 0, message: (error as Error).message});
    }
  };
  return {state, run, cancel: () => abort.current?.abort()};
}

function Creator() {
  const initial = PATHS[location.pathname] ?? (OCCASION_IDS.includes(new URLSearchParams(location.search).get('o') as OccasionId) ? new URLSearchParams(location.search).get('o') as OccasionId : 'birthday');
  const [occasion, setOccasion] = useState<OccasionId>(initial);
  const [to, setTo] = useState('');
  const [from, setFrom] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [playing, setPlaying] = useState(false);
  const player = useRef<PlayerRef>(null);
  const audioSrc = useSoundtrack(occasion);
  const name = cleanName(to) || 'Your friend';
  const card: Card = {occasion, to: cleanName(to), from: cleanName(from), message: message.trim().slice(0, 80)};
  const seconds = useMemo(() => cardSeconds(occasion, name), [occasion, name]);
  const inputProps = useMemo<VideoProps>(() => ({occasion, to: name, from: card.from, message: card.message, credit: false, audioSrc}),
    [occasion, name, card.from, card.message, audioSrc]);
  const url = card.to ? cardUrl(card) : '';
  const shareText = `I made you a singing card: ${url}`;
  const exporter = useExport();

  useEffect(() => {
    const current = player.current;
    if (!current) return;
    const on = () => setPlaying(true), off = () => setPlaying(false);
    current.addEventListener('play', on); current.addEventListener('pause', off); current.addEventListener('ended', off);
    return () => { current.removeEventListener('play', on); current.removeEventListener('pause', off); current.removeEventListener('ended', off); };
  }, [audioSrc]);

  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* blocked */ } };
  const nativeShare = async () => { try { await navigator.share({title: 'A singing card', text: 'I made you a singing card', url}); } catch { /* cancelled */ } };

  return (
    <div className="maker">
      <div className="stage">
        <div className="phone">
          <Player ref={player} component={CardVideo} inputProps={inputProps} durationInFrames={Math.ceil(seconds * FPS)} fps={FPS}
            compositionWidth={1080} compositionHeight={1920} controls clickToPlay style={{width: '100%', height: '100%'}} acknowledgeRemotionLicense
            initialFrame={Math.min(Math.ceil(seconds * FPS) - 1, Math.round((seconds - 2.6) * FPS))} />
          {!playing ? (
            <button type="button" className="play-big" aria-label="Play the card with sound" disabled={!audioSrc} onClick={() => { player.current?.seekTo(0); player.current?.play(); }}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" fill="currentColor" /></svg>
            </button>
          ) : null}
        </div>
        <p className="stage-note">{audioSrc ? `${seconds.toFixed(0)} s · press play for sound` : 'Tuning the piano…'}</p>
      </div>

      <div className="panel">
        <section className="step">
          <h2><span className="num">1</span> Occasion</h2>
          <div className="occasions" role="radiogroup" aria-label="Occasion">
            {OCCASION_IDS.map(id => (
              <button key={id} type="button" role="radio" aria-checked={occasion === id} className={`occasion ${id}${occasion === id ? ' on' : ''}`} onClick={() => setOccasion(id)}>
                <b>{OCCASIONS[id].label}</b><span>{OCCASIONS[id].song}</span>
              </button>
            ))}
          </div>
          <p className="hint">{OCCASIONS[occasion].blurb}</p>
        </section>

        <section className="step">
          <h2><span className="num">2</span> Who is it for?</h2>
          <div className="fields">
            <label className="field">Their name<input value={to} maxLength={24} placeholder="Anna" onChange={e => setTo(e.target.value)} /></label>
            <label className="field">From (optional)<input value={from} maxLength={24} placeholder="Kai" onChange={e => setFrom(e.target.value)} /></label>
            <label className="field wide">A short message (optional)<input value={message} maxLength={80} placeholder="Have the best day!" onChange={e => setMessage(e.target.value)} /></label>
          </div>
        </section>

        <section className="step">
          <h2><span className="num">3</span> Send it</h2>
          {!card.to ? <p className="hint">Type their name to get a link.</p> : (
            <>
              <div className="link-row">
                <input readOnly value={url} aria-label="Card link" onFocus={e => e.target.select()} />
                <button type="button" className="primary small" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
              </div>
              <div className="share-row">
                <a className="chip" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener">WhatsApp</a>
                <a className="chip" href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent('I made you a singing card')}`} target="_blank" rel="noopener">Telegram</a>
                <a className="chip" href={`mailto:?subject=${encodeURIComponent('A singing card for you')}&body=${encodeURIComponent(shareText)}`}>Email</a>
                {'share' in navigator ? <button type="button" className="chip" onClick={nativeShare}>More…</button> : null}
              </div>
              <p className="hint">They open the link, tap once, and the ball sings to them. Nothing is stored on a server: the card lives in the link.</p>
            </>
          )}
          <div className="video-row">
            {exporter.state.phase === 'running' ? (
              <div className="progress"><div className="bar"><div style={{width: `${Math.round(exporter.state.progress * 100)}%`}} /></div>
                <div className="progress-row"><span>Making the video… {Math.round(exporter.state.progress * 100)}%</span><button type="button" className="link" onClick={exporter.cancel}>Cancel</button></div></div>
            ) : (
              <button type="button" className="ghost" disabled={!audioSrc || !card.to}
                onClick={() => exporter.run({...inputProps, to: card.to, credit: true}, seconds, `singing-card-${slug(card.to)}.mp4`)}>
                Download as a video (MP4)
              </button>
            )}
            {exporter.state.phase === 'error' ? <p className="error">{exporter.state.message}</p> : null}
            {exporter.state.phase === 'done' ? <p className="done">Saved. Send it in any chat or post it as a story.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function Recipient({card}: {card: Card}) {
  const [phase, setPhase] = useState<'closed' | 'playing' | 'ended'>('closed');
  const player = useRef<PlayerRef>(null);
  const audioSrc = useSoundtrack(card.occasion);
  const seconds = useMemo(() => cardSeconds(card.occasion, card.to), [card]);
  const inputProps = useMemo<VideoProps>(() => ({...card, credit: false, audioSrc}), [card, audioSrc]);
  const exporter = useExport();
  useEffect(() => {
    document.title = `A singing card for ${card.to}`;
    const current = player.current;
    if (!current) return;
    const ended = () => setPhase('ended');
    current.addEventListener('ended', ended);
    return () => current.removeEventListener('ended', ended);
  }, [card.to, audioSrc]);
  const open = () => { setPhase('playing'); player.current?.seekTo(0); player.current?.play(); };

  return (
    <div className="recipient">
      <div className="phone big">
        <Player ref={player} component={CardVideo} inputProps={inputProps} durationInFrames={Math.ceil(seconds * FPS)} fps={FPS}
          compositionWidth={1080} compositionHeight={1920} style={{width: '100%', height: '100%'}} acknowledgeRemotionLicense />
        {phase === 'closed' ? (
          <div className="envelope">
            <svg className="envelope-icon" viewBox="0 0 64 48" aria-hidden="true"><rect x="2" y="6" width="60" height="40" rx="6" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M4 10l28 20 28-20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" /><circle cx="50" cy="8" r="7" fill="#ffc857" /></svg>
            <p className="kicker">{OCCASIONS[card.occasion].label}</p>
            <h1>{card.to}, you have a singing card</h1>
            {card.from ? <p className="from">from {card.from}</p> : null}
            <button type="button" className="open" disabled={!audioSrc} onClick={open}>{audioSrc ? 'Tap to open' : 'Tuning the piano…'}</button>
            <p className="hint">Sound on</p>
          </div>
        ) : null}
        {phase === 'ended' ? (
          <div className="envelope after">
            <button type="button" className="open" onClick={open}>Play again</button>
            <a className="cta" href={`/?o=${card.occasion}`}>Make one for someone</a>
            <button type="button" className="link" onClick={() => exporter.run({...inputProps, credit: true}, seconds, `singing-card-${slug(card.to)}.mp4`)}>
              {exporter.state.phase === 'running' ? `Saving… ${Math.round(exporter.state.progress * 100)}%` : 'Save it as a video'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function App() {
  const [card, setCard] = useState(() => (location.pathname.startsWith('/c/') ? readHash() : undefined));
  useEffect(() => {
    const onHash = () => setCard(location.pathname.startsWith('/c/') ? readHash() : undefined);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  if (location.pathname.startsWith('/c/') && !card) return <div className="recipient"><p className="hint">This card link looks incomplete. <a href="/">Make a new card</a>.</p></div>;
  return card ? <Recipient card={card} /> : <Creator />;
}

createRoot(document.getElementById('app')!).render(<App />);
