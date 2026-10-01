/** Melody Bounce: the ring shrinks 1.5 % with every bounce until the ball no longer fits. */
import React from 'react';
import { interpolate } from 'remotion';
import sim from '../../public/shrink.json';
import { clamp, Hud, rnd, Shell } from './Shell';

type Bounce = { t: number; n: number; ax: number; ay: number; R: number };
const S = sim as unknown as { cx: number; cy: number; R0: number; ballR: number; t0: number; squeezed: number; frames: [number, number, number][]; bounces: Bounce[] };
export const SHRINK_CLIMAX = S.squeezed;
export const SHRINK_END = S.squeezed + 3.6;
const RMIN = S.ballR * 1.7;
const hueOfR = (r: number) => 190 * Math.max(0, Math.min(1, (r - RMIN) / (S.R0 - RMIN)));

function draw(ctx: CanvasRenderingContext2D, t: number, frame: number) {
  const loop = interpolate(t, [SHRINK_END - 0.45, SHRINK_END], [0, 1], clamp);
  const fi = Math.min(frame, S.frames.length - 1);
  const [bx, by, R] = loop > 0.5 ? S.frames[0] : S.frames[fi];
  const done = t >= S.squeezed && loop <= 0.5;
  const age = t - S.squeezed;
  const last = [...S.bounces].reverse().find((b) => b.t <= t);
  const kick = last && !done ? Math.max(0, 1 - (t - last.t) / 0.12) : 0;
  const strain = done ? 1 : interpolate(R, [RMIN, RMIN * 2.2], [1, 0], clamp);
  ctx.save();
  ctx.translate(S.cx, S.cy);
  // tree rings: where the ring was, every 10 bounces
  if (!done || age < 0.3) {
    for (const b of S.bounces) {
      if (b.n % 10 !== 0 || b.t > t || loop > 0.5) continue;
      ctx.strokeStyle = `hsla(${hueOfR(b.R)}, 100%, 62%, 0.16)`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, b.R + 9, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  if (!done) {
    const h = hueOfR(R);
    const shake = strain * 4 * Math.sin(frame * 1.9);
    ctx.lineWidth = 14 + 6 * kick;
    ctx.shadowBlur = 26 + 30 * strain + 20 * kick;
    ctx.shadowColor = `hsla(${h}, 100%, 60%, 0.95)`;
    ctx.strokeStyle = `hsl(${h}, 100%, ${62 + 14 * kick}%)`;
    ctx.beginPath();
    ctx.arc(shake, 0, R + 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  } else if (age < 1.4) {
    // the squeeze: the ring bursts into sparks
    for (let k = 0; k < 60; k++) {
      const a = (k / 60) * Math.PI * 2 + rnd(k) * 0.1;
      const r = R + age * (600 + rnd(k * 3.3) * 700);
      const life = Math.max(0, 1 - age / 1.3);
      ctx.fillStyle = `hsla(${rnd(k * 2.1) * 40}, 100%, 65%, ${life})`;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r + 400 * age * age, 7 * life + 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  // ball
  const h = hueOfR(R);
  if (!done || age < 0.12) {
    for (let k = 10; k >= 1; k--) {
      const p = S.frames[Math.max(0, fi - k)];
      ctx.fillStyle = `hsla(${h}, 100%, 75%, ${(1 - k / 11) * 0.28})`;
      ctx.beginPath();
      ctx.arc(p[0], p[1], S.ballR * (1 - k / 16), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowColor = `hsla(${h}, 100%, 70%, 1)`;
    ctx.shadowBlur = 34;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(bx, by, S.ballR, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

const hud = (t: number): Hud => {
  const n = S.bounces.filter((b) => b.t <= t).length;
  const last = [...S.bounces].reverse().find((b) => b.t <= t);
  const R = last ? last.R : S.R0;
  const pct = Math.round((R / S.R0) * 100);
  const kick = last && t - last.t < 0.1 ? 1 + 0.07 * (1 - (t - last.t) / 0.1) : 1;
  return { value: String(n), label: `BOUNCES · RING ${pct}%`, hot: pct < 20, kick };
};

export const Shrink: React.FC = () => (
  <Shell
    audio="shrink.wav"
    end={SHRINK_END}
    climax={SHRINK_CLIMAX}
    hook={['THE RING SHRINKS', 'EVERY BOUNCE']}
    ask="How many bounces can it take?"
    credit="♪ every bounce plays In the Hall of the Mountain King"
    hud={hud}
    endCard={{ title: 'SQUEEZED', sub: `after ${S.bounces.length} bounces`, ask: 'Did you guess the number?', top: 190, glow: 'rgba(255,110,90,0.9)' }}
    draw={draw}
    hotTint={(t) => (t < S.squeezed ? interpolate(S.squeezed - t, [0, 4], [0.7, 0], clamp) : 0)}
  />
);
