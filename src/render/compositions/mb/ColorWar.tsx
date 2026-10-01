/** Melody Bounce: Red vs Blue. Two balls paint the ring segments they hit; after 30 s the ring is counted. */
import React from 'react';
import { interpolate } from 'remotion';
import { clamp, Hud, rnd, Shell } from './Shell.js';

import type { CompositionProps } from '../../types.js';

function createColorWar(sim: unknown, audioSrc?: string, musicTitle?: string) {
  type Bounce = { t: number; who: number; seg: number; ax: number; ay: number };
  type Clash = { t: number; x: number; y: number };
  const S = sim as unknown as { cx: number; cy: number; R: number; ballR: number; seg: number; paint: number; t0: number; end: number; frames: number[][]; bounces: Bounce[]; clashes: Clash[]; final: [number, number] };
  const CW_CLIMAX = S.end;
  const CW_END = S.end + 3.6;
  const COL = ['hsl(355, 95%, 60%)', 'hsl(210, 100%, 62%)'];
  const HUE = [355, 210];

  const ownersAt = (t: number) => {
    const own = new Array(S.seg).fill(-1) as number[];
    const when = new Array(S.seg).fill(-9) as number[];
    for (const b of S.bounces) {
      if (b.t > t) break;
      for (let j = -S.paint; j <= S.paint; j++) {
        const k = (((b.seg + j) % S.seg) + S.seg) % S.seg;
        own[k] = b.who;
        when[k] = b.t;
      }
    }
    return { own, when };
  };

  function draw(ctx: CanvasRenderingContext2D, t: number, frame: number) {
    const loop = interpolate(t, [CW_END - 0.45, CW_END], [0, 1], clamp);
    const { own, when } = ownersAt(Math.min(t, S.end));
    const fi = Math.min(frame, S.frames.length - 1);
    const [rx, ry, bx, by] = S.frames[fi];
    const won = S.final[0] > S.final[1] ? 0 : 1;
    const victory = interpolate(t, [S.end, S.end + 0.8], [0, 1], clamp) * (1 - loop);
    ctx.save();
    ctx.translate(S.cx, S.cy);
    // the ring: 72 segments
    const segA = (Math.PI * 2) / S.seg;
    ctx.lineCap = 'butt';
    for (let k = 0; k < S.seg; k++) {
      const o = loop > 0.5 ? -1 : own[k];
      const fresh = o >= 0 ? Math.max(0, 1 - (t - when[k]) / 0.3) : 0;
      const winGlow = o === won ? victory : 0;
      ctx.lineWidth = 18 + 8 * fresh + 6 * winGlow;
      ctx.shadowBlur = o >= 0 ? 18 + 26 * fresh + 30 * winGlow : 0;
      ctx.shadowColor = o >= 0 ? `hsla(${HUE[o]}, 100%, 60%, 0.95)` : 'transparent';
      ctx.strokeStyle = o >= 0 ? `hsl(${HUE[o]}, ${o === 0 ? 95 : 100}%, ${58 + 18 * fresh + 8 * winGlow}%)` : 'rgba(120,130,170,0.28)';
      ctx.beginPath();
      ctx.arc(0, 0, S.R + 9, k * segA + 0.006, (k + 1) * segA - 0.006);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // clash sparks
    for (const c of S.clashes) {
      const age = t - c.t;
      if (age < 0 || age > 0.35) continue;
      for (let i = 0; i < 14; i++) {
        const a = rnd(c.t * 100 + i) * Math.PI * 2;
        const r = 20 + age * (500 + rnd(i * 3.1) * 400);
        ctx.fillStyle = `rgba(255,255,255,${1 - age / 0.35})`;
        ctx.beginPath();
        ctx.arc(S.cx + c.x + Math.cos(a) * r, S.cy + c.y + Math.sin(a) * r, 4 * (1 - age / 0.35) + 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // balls with trails
    const balls: [number, number, number][] = [[rx, ry, 0], [bx, by, 1]];
    for (const [x, y, who] of balls) {
      const fade = who === won ? 1 : 1 - 0.6 * victory;
      for (let k = 10; k >= 1; k--) {
        const p = S.frames[Math.max(0, fi - k)];
        ctx.fillStyle = `hsla(${HUE[who]}, 100%, 65%, ${(1 - k / 11) * 0.3 * fade})`;
        ctx.beginPath();
        ctx.arc(p[who * 2], p[who * 2 + 1], S.ballR * (1 - k / 16), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = fade;
      ctx.shadowColor = COL[who];
      ctx.shadowBlur = 36;
      ctx.fillStyle = COL[who];
      ctx.beginPath();
      ctx.arc(x, y, S.ballR, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(x - 7, y - 8, S.ballR * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // tug bar under the counter
    const red = own.filter((o) => o === 0).length;
    const blue = own.filter((o) => o === 1).length;
    const hudO = interpolate(t, [2.25, 2.55], [0, 1], clamp) * interpolate(t, [S.end, S.end + 0.2], [1, 0], clamp);
    if (hudO > 0) {
      const W = 760;
      const x0 = 540 - W / 2;
      const y0 = 420;
      ctx.globalAlpha = hudO;
      ctx.fillStyle = 'rgba(120,130,170,0.25)';
      ctx.fillRect(x0, y0, W, 16);
      ctx.fillStyle = COL[0];
      ctx.fillRect(x0, y0, (W * red) / S.seg, 16);
      ctx.fillStyle = COL[1];
      ctx.fillRect(x0 + W - (W * blue) / S.seg, y0, (W * blue) / S.seg, 16);
      ctx.fillStyle = '#fff';
      ctx.fillRect(538, y0 - 8, 4, 32);
      ctx.globalAlpha = 1;
    }
  }

  const hud = (t: number): Hud => {
    const { own } = ownersAt(Math.min(t, S.end));
    const red = own.filter((o) => o === 0).length;
    const blue = own.filter((o) => o === 1).length;
    const left = Math.max(0, S.end - t);
    const pct = (n: number) => String(Math.round((n / S.seg) * 100)).padStart(2, '0');
    return { value: `${pct(red)} : ${pct(blue)}`, label: `RED · 0:${String(Math.ceil(left - 1e-6)).padStart(2, '0')} · BLUE`, hot: left < 5 };
  };

  const winner = S.final[0] > S.final[1] ? 'RED' : 'BLUE';
  const share = Math.round((Math.max(...S.final) / S.seg) * 100);

  const ColorWar: React.FC = () => (
    <Shell
      audio={audioSrc}
      end={CW_END}
      climax={CW_CLIMAX}
      hook={['RED vs BLUE', 'WHO TAKES THE RING?']}
      ask="Pick a side before it ends"
      credit={"♪ every bounce plays " + (musicTitle ?? "Rondo alla Turca")}
      hud={hud}
      endCard={{ title: `${winner} WINS`, sub: `${share}% of the ring · by ${Math.abs(S.final[0] - S.final[1])} segments`, ask: 'Rematch? Pick your color', top: 190, glow: winner === 'RED' ? 'rgba(255,90,100,0.9)' : 'rgba(90,150,255,0.9)' }}
      draw={draw}
      hotTint={(t) => (t < S.end ? interpolate(S.end - t, [0, 5], [0.7, 0], clamp) : 0)}
    />
  );

  return ColorWar;
}

export const ColorWar: React.FC<CompositionProps<'colorwar'>> = ({ data, audioSrc, musicTitle }) => {
  const View = React.useMemo(() => createColorWar(data, audioSrc, musicTitle), [data, audioSrc, musicTitle]);
  return <View />;
};
