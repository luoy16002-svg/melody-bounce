import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, Audio, interpolate, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { loadFont } from '../font.js';

const { fontFamily } = loadFont('normal', { weights: ['400', '700', '900'], subsets: ['latin'] });

import type { CompositionProps } from '../types.js';

function createMultiply(sim: unknown, audioSrc?: string, musicTitle?: string) {
  type Ball = [number, number, number, number]; // id, x, y, escaped
  const S = sim as unknown as {
    cx: number; cy: number; R: number; ballR: number; gap: number; gapGrow: number; spin: number;
    frames: Ball[][]; hits: { t: number; id: number }[]; escapes: { t: number; id: number }[]; duration: number; spawned: number;
  };
  const END = S.escapes.length === S.spawned ? S.escapes[S.escapes.length - 1].t : S.duration + 3600;
  const hueOf = (id: number) => (id * 47) % 360;

  function draw(ctx: CanvasRenderingContext2D, t: number, frame: number) {
    ctx.clearRect(0, 0, 1080, 1920);
    const f = S.frames[Math.min(frame, S.frames.length - 1)] ?? [];
    const alive = f.filter((b) => !b[3]).length;
    ctx.save();
    ctx.translate(S.cx, S.cy);
    ctx.scale(1.12, 1.12);

    // arena ring with a glowing gap
    const rot = -Math.PI / 2 + S.spin * t;
    const gap = S.gap + S.gapGrow * Math.max(0, t - 8);
    const hue = (t * 40) % 360;
    if (t < END + 0.05) {
      ctx.lineCap = 'round';
      ctx.lineWidth = 14;
      ctx.shadowBlur = 34;
      ctx.shadowColor = `hsla(${hue}, 100%, 60%, 0.9)`;
      ctx.strokeStyle = `hsl(${hue}, 100%, 62%)`;
      ctx.beginPath();
      ctx.arc(0, 0, S.R + 10, rot + gap, rot - gap + Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // balls
    const allSpawned = S.escapes.filter((e) => e.t <= t).length >= S.spawned - 1;
    const last = alive === 1 && allSpawned ? f.find((b) => !b[3]) : undefined;
    for (const [id, x, y, out] of f) {
      const h = hueOf(id);
      ctx.shadowBlur = out ? 0 : 16;
      ctx.shadowColor = `hsla(${h}, 100%, 65%, 0.9)`;
      ctx.fillStyle = out ? `hsla(${h}, 90%, 65%, 0.35)` : `hsl(${h}, 100%, 66%)`;
      ctx.beginPath();
      ctx.arc(x, y, S.ballR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // "last one" marker
    if (last) {
      const [, x, y] = last;
      const pulse = 1 + 0.15 * Math.sin(t * 14);
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, S.ballR * 2.6 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // finale burst from the gap position
    if (t >= END) {
      const age = t - END;
      const ga = rot;
      const gx = S.cx + Math.cos(ga) * S.R * 1.12;
      const gy = S.cy + Math.sin(ga) * S.R * 1.12;
      for (let k = 0; k < 160; k++) {
        const a = (k / 160) * Math.PI * 2 + Math.sin(k * 7.1);
        const sp = 250 + ((k * 97) % 100) * 9;
        const px = gx + Math.cos(a) * sp * age;
        const py = gy + Math.sin(a) * sp * age + 700 * age * age;
        const life = Math.max(0, 1 - age / 1.1);
        ctx.fillStyle = `hsla(${hueOf(k)}, 100%, 65%, ${life})`;
        ctx.fillRect(px, py, 10, 16);
      }
    }
  }

  const Multiply: React.FC = () => {
    const outputFrame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const t = outputFrame / fps;
    const frame = Math.floor(t * 60 + 1e-8);
    const ref = useRef<HTMLCanvasElement>(null);
    useLayoutEffect(() => {
      const ctx = ref.current?.getContext('2d');
      if (ctx) draw(ctx, t, frame);
    }, [t, frame]);

    const f = S.frames[Math.min(frame, S.frames.length - 1)] ?? [];
    const alive = f.filter((b) => !b[3]).length;
    const escaped = S.escapes.filter((e) => e.t <= t).length;
    const hook = interpolate(t, [0, 0.15, 2.2, 2.6], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const lastHit = [...S.hits].reverse().find((h) => h.t <= t);
    const kick = lastHit && t - lastHit.t < 0.1 ? 1.06 : 1;
    const done = t >= END;
    const endIn = interpolate(t, [END + 0.1, END + 0.6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2)) });
    const isLast = alive === 1 && !done && escaped >= S.spawned - 1;

    return (
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 50%, #1a1433 0%, #07080f 64%)', fontFamily }}>
        <AbsoluteFill style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1.4px)', backgroundSize: '46px 46px', opacity: 0.5 }} />
        <canvas ref={ref} width={1080} height={1920} style={{ position: 'absolute', inset: 0 }} />

        {!done && (
          <div style={{ position: 'absolute', top: 170, width: '100%', textAlign: 'center', color: '#fff' }}>
            <div style={{ fontSize: 170, fontWeight: 900, lineHeight: 1, transform: `scale(${kick})`, textShadow: '0 0 40px rgba(255,255,255,0.25)', color: isLast ? '#FFC857' : '#fff' }}>
              {alive}
            </div>
            <div style={{ fontSize: 42, letterSpacing: 6, opacity: 0.75 }}>{isLast ? 'LAST ONE…' : alive === 1 ? 'BALL' : 'BALLS'}</div>
          </div>
        )}
        {!done && escaped > 0 && (
          <div style={{ position: 'absolute', bottom: 250, width: '100%', textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 40, letterSpacing: 3 }}>
            escaped: <b style={{ color: '#fff' }}>{escaped}</b>
          </div>
        )}

        <div style={{ position: 'absolute', top: 700, width: '100%', textAlign: 'center', opacity: hook, color: '#fff', fontWeight: 900, fontSize: 96, lineHeight: 1.02, textShadow: '0 8px 40px rgba(0,0,0,0.9)' }}>
          EVERY BOUNCE
          <br />
          <span style={{ color: '#FFC857' }}>= +1 BALL</span>
        </div>

        <div style={{ position: 'absolute', bottom: 150, width: '100%', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 32, letterSpacing: 2, opacity: done ? 0 : interpolate(t, [3, 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
          ♪ {musicTitle ?? "In the Hall of the Mountain King"}
        </div>

        {done && (
          <div style={{ position: 'absolute', top: 690, width: '100%', textAlign: 'center', color: '#fff', opacity: endIn, transform: `scale(${0.6 + 0.4 * endIn})` }}>
            <div style={{ fontSize: 200, fontWeight: 900, lineHeight: 1, textShadow: '0 0 70px rgba(255,200,87,0.8)' }}>{S.spawned}</div>
            <div style={{ fontSize: 56, fontWeight: 700, marginTop: 10, textShadow: '0 4px 24px rgba(0,0,0,0.95)' }}>balls escaped</div>
            <div style={{ fontSize: 44, opacity: 0.8, marginTop: 60, textShadow: '0 4px 24px rgba(0,0,0,0.95)' }}>from just 1 ball in {END.toFixed(1)} s</div>
          </div>
        )}
        {audioSrc && <Audio src={audioSrc} />}
      </AbsoluteFill>
    );
  };

  return Multiply;
}

export const Multiply: React.FC<CompositionProps<'multiply'>> = ({ data, audioSrc, musicTitle }) => {
  const View = React.useMemo(() => createMultiply(data, audioSrc, musicTitle), [data, audioSrc, musicTitle]);
  return <View />;
};
