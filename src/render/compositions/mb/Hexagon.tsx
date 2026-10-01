/** Melody Bounce: the ball-in-a-spinning-hexagon test, with gravity, friction and a gap in one side. */
import React from 'react';
import { interpolate } from 'remotion';
import { clamp, Hud, Shell } from './Shell.js';

import type { CompositionProps } from '../../types.js';

function createHexagon(sim: unknown, audioSrc?: string, musicTitle?: string) {
  type Bounce = { t: number; n: number; side: number; x: number; y: number; v: number };
  const S = sim as unknown as { cx: number; cy: number; rv: number; ballR: number; gapSide: number; gap: number; t0: number; escaped: number; frames: [number, number, number][]; bounces: Bounce[] };
  const HEX_CLIMAX = (S.escaped ?? S.frames.length / 60 + 3600) + 0.4;
  const HEX_END = HEX_CLIMAX + 3.6;
  const OMEGA0 = 1.3;

  function draw(ctx: CanvasRenderingContext2D, t: number, frame: number) {
    const loop = interpolate(t, [HEX_END - 0.45, HEX_END], [0, 1], clamp);
    const fi = loop > 0.5 ? 0 : Math.min(frame, S.frames.length - 1);
    const [bx, by, theta] = S.frames[fi];
    const escaped = t >= (S.escaped ?? S.frames.length / 60 + 3600) && loop <= 0.5;
    const nb = S.bounces.filter((b) => b.t <= t).length;
    const hue = 280 - Math.min(1, nb / 60) * 120;
    // hexagon
    const lit = new Array(6).fill(0) as number[];
    for (const b of S.bounces) {
      const d = t - b.t;
      if (d >= 0 && d < 0.2) lit[b.side] = Math.max(lit[b.side], 1 - d / 0.2);
    }
    const win = interpolate(t, [(S.escaped ?? S.frames.length / 60 + 3600), (S.escaped ?? S.frames.length / 60 + 3600) + 0.6], [0, 1], clamp) * (1 - loop);
    ctx.save();
    ctx.translate(S.cx, S.cy);
    ctx.lineCap = 'round';
    for (let k = 0; k < 6; k++) {
      const a1 = theta + (k * Math.PI) / 3;
      const a2 = theta + ((k + 1) * Math.PI) / 3;
      const x1 = S.rv * Math.cos(a1);
      const y1 = S.rv * Math.sin(a1);
      const x2 = S.rv * Math.cos(a2);
      const y2 = S.rv * Math.sin(a2);
      const g = lit[k];
      ctx.lineWidth = 14 + 8 * g;
      ctx.shadowBlur = 24 + 30 * g + 30 * win;
      ctx.shadowColor = `hsla(${hue}, 100%, 62%, 0.95)`;
      ctx.strokeStyle = `hsl(${hue}, 100%, ${62 + 20 * g}%)`;
      ctx.beginPath();
      if (k === S.gapSide) {
        const f1 = 0.5 - S.gap / 2;
        const f2 = 0.5 + S.gap / 2;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + (x2 - x1) * f1, y1 + (y2 - y1) * f1);
        ctx.moveTo(x1 + (x2 - x1) * f2, y1 + (y2 - y1) * f2);
        ctx.lineTo(x2, y2);
      } else {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
    // ball
    for (let k = 12; k >= 1; k--) {
      const p = S.frames[Math.max(0, fi - k)];
      ctx.fillStyle = `hsla(45, 100%, 70%, ${(1 - k / 13) * 0.3})`;
      ctx.beginPath();
      ctx.arc(p[0], p[1], S.ballR * (1 - k / 18), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowColor = escaped ? 'rgba(255,200,87,1)' : 'rgba(255,230,160,1)';
    ctx.shadowBlur = escaped ? 50 : 30;
    ctx.fillStyle = '#FFF4D6';
    ctx.beginPath();
    ctx.arc(bx, by, S.ballR, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  const hud = (t: number): Hud => {
    const n = S.bounces.filter((b) => b.t <= t).length;
    const f = Math.min(S.frames.length - 1, Math.max(1, Math.round(t * 60)));
    const spin = Math.abs(S.frames[f][2] - S.frames[f - 1][2]) * 60 / OMEGA0;
    const last = [...S.bounces].reverse().find((b) => b.t <= t);
    const kick = last && t - last.t < 0.1 ? 1 + 0.07 * (1 - (t - last.t) / 0.1) : 1;
    return { value: String(n), label: `BOUNCES · SPIN ×${Math.max(1, spin).toFixed(1)}`, kick };
  };

  const Hexagon: React.FC = () => (
    <Shell
      audio={audioSrc}
      end={HEX_END}
      climax={HEX_CLIMAX}
      hook={['SPINNING HEXAGON', 'CAN IT GET OUT?']}
      ask="The test every AI had to pass"
      credit={"♪ every bounce plays " + (musicTitle ?? "Minuet in G")}
      hud={hud}
      endCard={{ title: 'ESCAPED', sub: `after ${S.bounces.length} bounces`, ask: 'Smaller gap next time?', top: 190, glow: 'rgba(255,200,87,0.9)' }}
      draw={draw}
    />
  );

  return Hexagon;
}

export const Hexagon: React.FC<CompositionProps<'hexagon'>> = ({ data, audioSrc, musicTitle }) => {
  const View = React.useMemo(() => createHexagon(data, audioSrc, musicTitle), [data, audioSrc, musicTitle]);
  return <View />;
};
