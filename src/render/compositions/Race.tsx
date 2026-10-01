import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, Audio, interpolate, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { loadFont } from '../font.js';

const { fontFamily } = loadFont('normal', { weights: ['400', '700', '900'], subsets: ['latin'] });

import type { CompositionProps } from '../types.js';

function createRace(sim: unknown, audioSrc?: string, musicTitle?: string) {
  type Ev = { t: number; ball: number; x: number; y: number };
  const S = sim as unknown as {
    cx: number; cy: number; R: number; ballR: number; gap: number; spin: number; colors: string[];
    frames: [number, number][][]; hits: Ev[]; near: Ev[]; clacks: { t: number; x: number; y: number }[]; winner: number; winAt: number;
  };
  const TW = S.winAt ?? S.frames.length / 60 + 3600;
  const RACE_END = TW + 3.4;
  const LOOP = RACE_END - 0.45;
  const COL = ['#FF4D5E', '#3D8BFF', '#2FD67B', '#FFD23F'];
  const NAME = ['RED', 'BLUE', 'GREEN', 'YELLOW'];
  const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
  const NEAR = S.near.filter((n) => n.t < TW && n.t > 2.6);

  const rnd = (n: number) => {
    const x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };

  function draw(ctx: CanvasRenderingContext2D, t: number, frame: number) {
    ctx.clearRect(0, 0, 1080, 1920);
    const fi = Math.min(frame, S.frames.length - 1);
    const won = t >= TW;
    const loopIn = interpolate(t, [LOOP, RACE_END], [0, 1], clamp);
    const lastNear = [...NEAR].reverse().find((n) => n.t <= t);
    const nearAge = lastNear ? t - lastNear.t : 9;
    let shake = nearAge < 0.2 ? 5 * (1 - nearAge / 0.2) : 0;
    if (won && t - TW < 0.35) shake = 12 * (1 - (t - TW) / 0.35);
    ctx.save();
    ctx.translate(S.cx + Math.sin(frame * 2.3) * shake, S.cy + Math.cos(frame * 1.7) * shake);

    // ring with the exit gap
    const rot = (won ? TW : t) * S.spin;
    const ringAlpha = won ? interpolate(t, [TW, TW + 0.6], [1, 0.3], clamp) : 1;
    ctx.globalAlpha = ringAlpha * (1 - loopIn) + loopIn;
    ctx.lineCap = 'round';
    ctx.lineWidth = 14;
    ctx.shadowBlur = 26;
    ctx.shadowColor = 'rgba(190,210,255,0.9)';
    ctx.strokeStyle = '#E8EEFF';
    const r0 = loopIn > 0 ? 0 : rot;
    ctx.beginPath();
    ctx.arc(0, 0, S.R + 7, r0 + S.gap, r0 - S.gap + Math.PI * 2);
    ctx.stroke();
    // glowing gate posts
    const pulse = nearAge < 0.4 ? 1 - nearAge / 0.4 : 0;
    for (const side of [-1, 1]) {
      const a = r0 + side * S.gap;
      ctx.fillStyle = `rgba(255,200,87,${0.9})`;
      ctx.shadowColor = 'rgba(255,200,87,1)';
      ctx.shadowBlur = 24 + 30 * pulse;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * (S.R + 7), Math.sin(a) * (S.R + 7), 12 + 6 * pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    // EXIT label riding outside the gap
    if (!won && loopIn === 0) {
      ctx.save();
      ctx.rotate(rot);
      ctx.translate(S.R + 64, 0);
      ctx.rotate(Math.PI / 2);
      ctx.font = `900 34px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,200,87,0.95)';
      ctx.fillText('EXIT', 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // wall-hit flashes in the ball's colour
    if (!won) {
      for (let k = S.hits.length - 1; k >= 0; k--) {
        const h = S.hits[k];
        if (h.t > t) continue;
        const age = t - h.t;
        if (age > 0.3) break;
        const a = Math.atan2(h.y, h.x);
        const life = 1 - age / 0.3;
        ctx.strokeStyle = COL[h.ball];
        ctx.globalAlpha = life;
        ctx.lineWidth = 16;
        ctx.shadowColor = COL[h.ball];
        ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.arc(0, 0, S.R + 7, a - 0.1 - 0.2 * (1 - life), a + 0.1 + 0.2 * (1 - life));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
    // clack sparks
    for (const c of S.clacks) {
      const age = t - c.t;
      if (age < 0 || age > 0.25 || c.t > TW) continue;
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - age / 0.25)})`;
      ctx.lineWidth = 3;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + rnd(c.t) * 2;
        ctx.beginPath();
        ctx.moveTo(c.x + Math.cos(a) * (10 + age * 120), c.y + Math.sin(a) * (10 + age * 120));
        ctx.lineTo(c.x + Math.cos(a) * (22 + age * 160), c.y + Math.sin(a) * (22 + age * 160));
        ctx.stroke();
      }
    }

    // balls with trails
    const f = S.frames[fi];
    f.forEach(([x, y], i) => {
      const loser = won && i !== S.winner;
      const alpha = (loser ? interpolate(t, [TW, TW + 0.5], [1, 0.25], clamp) : 1) * (1 - loopIn);
      for (let k = 8; k >= 1; k--) {
        const p = S.frames[Math.max(0, fi - k * 2)][i];
        ctx.fillStyle = COL[i];
        ctx.globalAlpha = alpha * (1 - k / 9) * 0.25;
        ctx.beginPath();
        ctx.arc(p[0], p[1], S.ballR * (1 - k / 14), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = alpha;
      const g = ctx.createRadialGradient(x - S.ballR * 0.35, y - S.ballR * 0.4, 2, x, y, S.ballR * 1.05);
      g.addColorStop(0, '#FFFFFF');
      g.addColorStop(0.35, COL[i]);
      g.addColorStop(1, COL[i]);
      ctx.shadowColor = COL[i];
      ctx.shadowBlur = 26;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, S.ballR, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1;

    // winner confetti from the exit
    if (won) {
      const age = t - TW;
      const [wx, wy] = S.frames[Math.min(S.frames.length - 1, Math.round(TW * 60))][S.winner];
      for (let k = 0; k < 180; k++) {
        const a = rnd(k * 3.1) * Math.PI * 2;
        const sp = 250 + rnd(k * 5.7) * 1100;
        const px = wx + Math.cos(a) * sp * age;
        const py = wy + Math.sin(a) * sp * age + 900 * age * age;
        const life = Math.max(0, 1 - age / (1.4 + rnd(k) * 0.8)) * (1 - loopIn);
        if (life <= 0) continue;
        ctx.fillStyle = k % 4 === 0 ? '#FFFFFF' : COL[S.winner];
        ctx.globalAlpha = life;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(age * (5 + rnd(k) * 8));
        ctx.fillRect(-7, -4, 14, 8 + rnd(k * 2) * 10);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    // loop: the four balls reappear at their start positions
    if (loopIn > 0) {
      S.frames[0].forEach(([x, y], i) => {
        ctx.globalAlpha = loopIn;
        ctx.fillStyle = COL[i];
        ctx.shadowColor = COL[i];
        ctx.shadowBlur = 26;
        ctx.beginPath();
        ctx.arc(x, y, S.ballR, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  const Race: React.FC = () => {
    const outputFrame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const t = outputFrame / fps;
    const frame = Math.floor(t * 60 + 1e-8);
    const ref = useRef<HTMLCanvasElement>(null);
    useLayoutEffect(() => {
      const ctx = ref.current?.getContext('2d');
      if (ctx) draw(ctx, t, frame);
    }, [t, frame]);

    const won = t >= TW;
    const loopIn = interpolate(t, [LOOP, RACE_END], [0, 1], clamp);
    const hook = t < 2.4 ? interpolate(t, [1.95, 2.25], [1, 0], clamp) : loopIn;
    const bar = interpolate(t, [2.25, 2.55], [0, 1], clamp) * interpolate(t, [TW, TW + 0.3], [1, 0], clamp);
    const pick = interpolate(t, [0.3, 0.6, 5.2, 5.6], [0, 1, 1, 0], clamp);
    const credit = won ? 0 : interpolate(t, [5.8, 6.4], [0, 1], clamp);
    const lastNear = [...NEAR].reverse().find((n) => n.t <= t);
    const nearAge = lastNear ? t - lastNear.t : 9;
    const close = nearAge < 0.8 ? interpolate(nearAge, [0, 0.12, 0.6, 0.8], [0, 1, 1, 0], clamp) : 0;
    const winIn = interpolate(t, [TW + 0.15, TW + 0.55], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) }) * (1 - loopIn);
    const ask = interpolate(t, [TW + 1.1, TW + 1.5], [0, 1], clamp);
    const shadow = '0 6px 34px rgba(0,0,0,0.9)';

    return (
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 53%, #171a36 0%, #07080f 64%)', fontFamily }}>
        <AbsoluteFill style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1.4px)', backgroundSize: '46px 46px', opacity: 0.45 }} />
        <canvas ref={ref} width={1080} height={1920} style={{ position: 'absolute', inset: 0 }} />

        <div style={{ position: 'absolute', top: 170, width: '100%', textAlign: 'center', color: '#fff', fontWeight: 900, fontSize: 118, lineHeight: 0.98, opacity: hook, textShadow: shadow }}>
          4 BALLS
          <br />
          <span style={{ color: '#FFC857' }}>1 EXIT</span>
        </div>

        {/* colour roster */}
        <div style={{ position: 'absolute', top: 200, width: '100%', display: 'flex', justifyContent: 'center', gap: 22, opacity: bar }}>
          {NAME.map((n, i) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderRadius: 999, background: 'rgba(255,255,255,0.07)', border: `3px solid ${COL[i]}` }}>
              <span style={{ width: 26, height: 26, borderRadius: '50%', background: COL[i], boxShadow: `0 0 18px ${COL[i]}` }} />
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 30, letterSpacing: 1 }}>{n}</span>
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', top: 310, width: '100%', textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 38, letterSpacing: 5, opacity: bar }}>FIRST ONE OUT WINS</div>

        <div style={{ position: 'absolute', top: 1580, width: '100%', textAlign: 'center', color: '#fff', opacity: pick, textShadow: shadow }}>
          <div style={{ fontSize: 64, fontWeight: 900 }}>Pick your color now</div>
          <div style={{ fontSize: 44, fontWeight: 700, color: '#FFC857', marginTop: 8 }}>comment it before it ends ↓</div>
        </div>
        <div style={{ position: 'absolute', top: 1610, width: '100%', textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 34, letterSpacing: 2, opacity: credit }}>
          ♪ every bounce plays {musicTitle ?? "Mozart’s Symphony No. 40"}
        </div>

        {lastNear && !won && (
          <div style={{ position: 'absolute', top: 470, width: '100%', textAlign: 'center', opacity: close, transform: `scale(${0.7 + 0.3 * close})` }}>
            <span style={{ fontSize: 76, fontWeight: 900, color: COL[lastNear.ball], textShadow: `0 0 30px ${COL[lastNear.ball]}, ${shadow}` }}>SO CLOSE!</span>
          </div>
        )}

        {won && (
          <div style={{ position: 'absolute', top: 760, width: '100%', textAlign: 'center', opacity: winIn, transform: `scale(${0.6 + 0.4 * winIn})` }}>
            <div style={{ fontSize: 170, fontWeight: 900, lineHeight: 1, color: COL[S.winner], textShadow: `0 0 60px ${COL[S.winner]}, ${shadow}` }}>{NAME[S.winner]}</div>
            <div style={{ fontSize: 110, fontWeight: 900, color: '#fff', lineHeight: 1, marginTop: 8, textShadow: shadow }}>WINS!</div>
            <div style={{ fontSize: 50, fontWeight: 700, color: '#FFC857', marginTop: 70, opacity: ask, textShadow: shadow }}>Did you pick {NAME[S.winner].toLowerCase()}?</div>
          </div>
        )}
        {audioSrc && <Audio src={audioSrc} />}
      </AbsoluteFill>
    );
  };

  return Race;
}

export const Race: React.FC<CompositionProps<'race'>> = ({ data, audioSrc, musicTitle }) => {
  const View = React.useMemo(() => createRace(data, audioSrc, musicTitle), [data, audioSrc, musicTitle]);
  return <View />;
};
