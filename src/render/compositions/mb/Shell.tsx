/**
 * Melody Bounce shell: the channel's look around a canvas simulation. Dark navy stage with a dot grid,
 * a two-line hook, a big counter, a question and a song credit, a white flash on the climax, an end
 * card, and a fade back to the first frame so the Short loops cleanly.
 */
import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, Audio, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont } from '../../font.js';

const { fontFamily } = loadFont('normal', { weights: ['400', '700', '900'], subsets: ['latin'] });
export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
export const rnd = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

export type Hud = { value: string; label: string; hot?: boolean; kick?: number };
export type ShellProps = {
  audio?: string;
  end: number; // total length in seconds
  climax: number; // time of the flash and the end card
  hook: [string, string]; // two lines: white, then amber
  ask: string;
  credit: string;
  hud: (t: number) => Hud;
  endCard: { title: string; sub: string; ask: string; glow: string; top?: number };
  draw: (ctx: CanvasRenderingContext2D, t: number, frame: number) => void;
  hotTint?: (t: number) => number; // 0..1 red edge glow
};

export const Shell: React.FC<ShellProps> = ({ audio, end, climax, hook, ask, credit, hud, endCard, draw, hotTint }) => {
  const outputFrame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = outputFrame / fps;
  const frame = Math.floor(t * 60 + 1e-8);
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 1080, 1920);
      draw(ctx, t, frame);
    }
  }, [t, frame, draw]);

  const loopIn = interpolate(t, [end - 0.45, end], [0, 1], clamp);
  const hookO = t < 2.4 ? interpolate(t, [1.95, 2.25], [1, 0], clamp) : loopIn;
  const h = hud(t);
  const hudO = interpolate(t, [2.25, 2.55], [0, 1], clamp) * interpolate(t, [climax, climax + 0.2], [1, 0], clamp);
  const askO = interpolate(t, [0.4, 0.7, 5.2, 5.6], [0, 1, 1, 0], clamp);
  const creditO = t >= climax ? 0 : interpolate(t, [5.8, 6.4], [0, 1], clamp);
  const flash = interpolate(t, [climax, climax + 0.04, climax + 0.35], [0, 0.75, 0], clamp);
  const endIn = interpolate(t, [climax + 0.6, climax + 1.0], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.8)) }) * (1 - loopIn);
  const askEnd = interpolate(t, [climax + 1.4, climax + 1.8], [0, 1], clamp);
  const hot = hotTint ? hotTint(t) : 0;
  const shadow = '0 6px 34px rgba(0,0,0,0.9)';

  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 53%, #151a38 0%, #07080f 64%)', fontFamily }}>
      <AbsoluteFill style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1.4px)', backgroundSize: '46px 46px', opacity: 0.45 }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 53%, transparent 55%, rgba(255,60,90,0.24) 100%)', opacity: hot }} />
      <canvas ref={ref} width={1080} height={1920} style={{ position: 'absolute', inset: 0 }} />

      <div style={{ position: 'absolute', top: 170, width: '100%', textAlign: 'center', color: '#fff', fontWeight: 900, fontSize: 104, lineHeight: 0.98, opacity: hookO, textShadow: shadow }}>
        {hook[0]}
        <br />
        <span style={{ color: '#FFC857' }}>{hook[1]}</span>
      </div>

      <div style={{ position: 'absolute', top: 150, width: '100%', textAlign: 'center', color: '#fff', opacity: hudO }}>
        <div style={{ fontSize: 168, fontWeight: 900, lineHeight: 1, transform: `scale(${h.kick ?? 1})`, color: h.hot ? '#FF6B7A' : '#fff', textShadow: '0 0 40px rgba(255,255,255,0.22)', fontVariantNumeric: 'tabular-nums' }}>{h.value}</div>
        <div style={{ fontSize: 42, letterSpacing: 7, opacity: 0.85, marginTop: 4, color: h.hot ? '#FF8A95' : '#fff' }}>{h.label}</div>
      </div>

      <div style={{ position: 'absolute', top: 1580, width: '100%', textAlign: 'center', color: '#fff', opacity: askO, textShadow: shadow }}>
        <div style={{ fontSize: 60, fontWeight: 700 }}>{ask}</div>
      </div>
      <div style={{ position: 'absolute', top: 1610, width: '100%', textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 34, letterSpacing: 2, opacity: creditO }}>{credit}</div>

      {t >= climax && (
        <div style={{ position: 'absolute', top: endCard.top ?? 700, width: '100%', textAlign: 'center', color: '#fff', opacity: endIn, transform: `scale(${0.6 + 0.4 * endIn})` }}>
          <div style={{ fontSize: 140, fontWeight: 900, lineHeight: 1, letterSpacing: 2, textShadow: `0 0 70px ${endCard.glow}` }}>{endCard.title}</div>
          <div style={{ fontSize: 54, fontWeight: 700, marginTop: 18, textShadow: shadow }}>{endCard.sub}</div>
          <div style={{ fontSize: 50, fontWeight: 700, marginTop: 80, color: '#FFC857', opacity: askEnd, textShadow: shadow }}>{endCard.ask}</div>
        </div>
      )}
      <AbsoluteFill style={{ background: '#fff', opacity: flash }} />
      {audio && <Audio src={audio} />}
    </AbsoluteFill>
  );
};
