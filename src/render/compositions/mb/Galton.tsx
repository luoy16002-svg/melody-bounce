/** Melody Bounce: a Galton board. 300 balls, 12 rows of pegs, 13 bins; each bin plays its own note. */
import React from 'react';
import { interpolate } from 'remotion';
import { clamp, Hud, Shell } from './Shell.js';

import type { CompositionProps } from '../../types.js';

function createGalton(sim: unknown, audioSrc?: string, _musicTitle?: string) {
  type Ball = { spawn: number; bits: string; bin: number; slot: number; hits: number[]; land: number };
  const S = sim as unknown as { rows: number; balls: Ball[]; counts: number[]; perRow: number; binBottom: number; ballD: number; drop: number; hop: number; t0: number; done: number };
  const GALTON_CLIMAX = S.done + 0.6;
  const GALTON_END = GALTON_CLIMAX + 3.6;
  const CX = 540;
  const TOP = 560;
  const DX = 62;
  const DY = 56;
  const MID = S.rows / 2;
  const BR = S.ballD / 2;
  const pegX = (r: number, i: number) => CX + (i - r / 2) * DX;
  const pegY = (r: number) => TOP + r * DY;
  const binX = (j: number) => CX + (j - MID) * DX;
  const hueOfBin = (j: number) => 220 - (1 - Math.abs(j - MID) / MID) * 190; // blue edges, warm middle

  const stackPos = (b: Ball) => {
    const col = b.slot % S.perRow;
    return [binX(b.bin) + (col - (S.perRow - 1) / 2) * S.ballD, S.binBottom - Math.floor(b.slot / S.perRow) * S.ballD - BR] as const;
  };

  /** Where a ball is at time t, or null before it spawns. */
  const pos = (b: Ball, t: number): readonly [number, number] | null => {
    if (t < b.spawn) return null;
    if (t >= b.land) return stackPos(b);
    if (t < b.hits[0]) {
      const u = (t - b.spawn) / S.drop;
      return [CX, 470 + (pegY(0) - 14 - 470) * u * u];
    }
    let i = 0;
    for (let r = 0; r < S.rows; r++) {
      const next = i + (b.bits[r] === '1' ? 1 : 0);
      const t1 = b.hits[r];
      if (t < t1 + S.hop) {
        const u = (t - t1) / S.hop;
        const x1 = pegX(r, i);
        const y1 = pegY(r) - 14;
        const last = r === S.rows - 1;
        const x2 = last ? stackPos(b)[0] : pegX(r + 1, next);
        const y2 = last ? pegY(r) + 30 : pegY(r + 1) - 14;
        return [x1 + (x2 - x1) * u, y1 + (y2 - y1) * u - 20 * Math.sin(Math.PI * u)];
      }
      i = next;
    }
    // free fall into the stack
    const t2 = b.hits[S.rows - 1] + S.hop;
    const [sx, sy] = stackPos(b);
    const u = Math.min(1, (t - t2) / Math.max(0.01, b.land - t2));
    const y0 = pegY(S.rows - 1) + 30;
    return [sx, y0 + (sy - y0) * u * u];
  };

  const binom = (n: number, k: number) => {
    let c = 1;
    for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
    return c;
  };

  function draw(ctx: CanvasRenderingContext2D, t: number) {
    const loop = interpolate(t, [GALTON_END - 0.45, GALTON_END], [0, 1], clamp);
    const tt = loop > 0.5 ? 0 : t;
    // bins
    ctx.strokeStyle = 'rgba(160,175,230,0.35)';
    ctx.lineWidth = 3;
    for (let j = 0; j <= S.rows + 1; j++) {
      const x = binX(j) - DX / 2;
      ctx.beginPath();
      ctx.moveTo(x, 1215);
      ctx.lineTo(x, S.binBottom + 4);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(binX(0) - DX / 2, S.binBottom + 4);
    ctx.lineTo(binX(S.rows) + DX / 2, S.binBottom + 4);
    ctx.stroke();
    // pegs, lit when a ball touches them
    const lit = new Map<string, number>();
    for (const b of S.balls) {
      if (b.spawn > tt || b.land < tt - 0.2) continue;
      let i = 0;
      for (let r = 0; r < S.rows; r++) {
        const d = tt - b.hits[r];
        if (d >= 0 && d < 0.12) lit.set(`${r}:${i}`, Math.max(lit.get(`${r}:${i}`) ?? 0, 1 - d / 0.12));
        i += b.bits[r] === '1' ? 1 : 0;
      }
    }
    for (let r = 0; r < S.rows; r++) {
      for (let i = 0; i <= r; i++) {
        const g = lit.get(`${r}:${i}`) ?? 0;
        ctx.shadowColor = 'rgba(255,220,140,0.9)';
        ctx.shadowBlur = 16 * g;
        ctx.fillStyle = g > 0 ? `rgba(255,${230 - 40 * g},${170 - 60 * g},${0.6 + 0.4 * g})` : 'rgba(200,210,255,0.55)';
        ctx.beginPath();
        ctx.arc(pegX(r, i), pegY(r), 7 + 3 * g, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.shadowBlur = 0;
    // balls
    for (const b of S.balls) {
      const p = pos(b, tt);
      if (!p) continue;
      const h = hueOfBin(b.bin);
      const falling = tt < b.land;
      const justLanded = !falling && tt - b.land < 0.15 ? 1 - (tt - b.land) / 0.15 : 0;
      ctx.fillStyle = falling ? '#ffffff' : `hsl(${h}, 95%, ${60 + 25 * justLanded}%)`;
      if (falling || justLanded > 0) {
        ctx.shadowColor = `hsla(${h}, 100%, 65%, 1)`;
        ctx.shadowBlur = 14;
      }
      ctx.beginPath();
      ctx.arc(p[0], p[1], BR, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    // the ideal curve, drawn once every ball has landed
    const reveal = interpolate(t, [GALTON_CLIMAX, GALTON_CLIMAX + 0.9], [0, 1], clamp) * (1 - loop);
    if (reveal > 0) {
      const pts = Array.from({ length: S.rows + 1 }, (_, j) => {
        const expected = (S.balls.length * binom(S.rows, j)) / 2 ** S.rows;
        return [binX(j), S.binBottom - (expected / S.perRow) * S.ballD - 6] as const;
      });
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, binX(0) - DX / 2 + (binX(S.rows) - binX(0) + DX) * reveal, 1920);
      ctx.clip();
      ctx.strokeStyle = '#FFC857';
      ctx.lineWidth = 7;
      ctx.shadowColor = 'rgba(255,200,87,0.9)';
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.moveTo(pts[0][0] - DX / 2, pts[0][1]);
      for (let j = 0; j < pts.length - 1; j++) {
        const mx = (pts[j][0] + pts[j + 1][0]) / 2;
        const my = (pts[j][1] + pts[j + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[j][0], pts[j][1], mx, my);
      }
      ctx.lineTo(pts[pts.length - 1][0] + DX / 2, pts[pts.length - 1][1]);
      ctx.stroke();
      ctx.restore();
    }
  }

  const hud = (t: number): Hud => {
    const landed = S.balls.filter((b) => b.land <= t).length;
    return { value: String(landed), label: `/ ${S.balls.length} BALLS`, hot: false };
  };

  const Galton: React.FC = () => (
    <Shell
      audio={audioSrc}
      end={GALTON_END}
      climax={GALTON_CLIMAX}
      hook={['300 BALLS', 'ONE BELL CURVE']}
      ask="Where do most of them land?"
      credit="♪ every bin plays its own note"
      hud={hud}
      endCard={{ title: 'BELL CURVE', sub: '300 random bounces · one shape', ask: 'Drop 3,000 next?', top: 190, glow: 'rgba(255,200,87,0.85)' }}
      draw={(ctx, t) => draw(ctx, t)}
    />
  );

  return Galton;
}

export const Galton: React.FC<CompositionProps<'galton'>> = ({ data, audioSrc, musicTitle }) => {
  const View = React.useMemo(() => createGalton(data, audioSrc, musicTitle), [data, audioSrc, musicTitle]);
  return <View />;
};
