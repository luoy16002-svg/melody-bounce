import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, Audio, interpolate, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { loadFont } from '../font.js';

const { fontFamily } = loadFont('normal', { weights: ['400', '700', '900'], subsets: ['latin'] });

import type { CompositionProps } from '../types.js';

function createGrow(sim: unknown, audioSrc?: string, musicTitle?: string) {
  type Bounce = { t: number; x: number; y: number; nx: number; ny: number; n: number; r: number };
  const S = sim as unknown as {
    cx: number; cy: number; R: number; r0: number; frames: [number, number, number, number][];
    bounces: Bounce[]; fillAt: number; count: number;
  };
  const TF = S.fillAt ?? S.frames.length / 60 + 3600;
  const POP = TF + 0.9;
  const GROW_END = TF + 4.0;
  const LOOP = GROW_END - 0.45; // cross-fade back into the opening frame

  // Ball hue per bounce count: big hue steps early, gentle drift once bounces get rapid.
  const HUE: number[] = [186];
  S.bounces.forEach((b) => {
    const f = (b.r / S.R) ** 2;
    HUE.push((HUE[HUE.length - 1] + 26 * (1 - f) + 3) % 360);
  });
  const fillOf = (r: number) => Math.min(1, (r / S.R) ** 2);
  const ringHue = (f: number) => (190 + 170 * f) % 360;

  const rnd = (n: number) => {
    const x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };

  function lastBounceAt(t: number) {
    let lo = 0, hi = S.bounces.length - 1, k = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (S.bounces[m].t <= t) { k = m; lo = m + 1; } else hi = m - 1;
    }
    return k;
  }

  function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, hue: number, n: number | null, sq: number, nx: number, ny: number, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    // squash along the contact normal
    const ang = Math.atan2(ny, nx);
    ctx.rotate(ang);
    ctx.scale(1 - sq, 1 + sq * 0.6);
    ctx.rotate(-ang);
    const g = ctx.createRadialGradient(-0.38 * r, -0.42 * r, r * 0.05, 0, 0, r * 1.05);
    g.addColorStop(0, `hsl(${hue}, 100%, 90%)`);
    g.addColorStop(0.42, `hsl(${hue}, 97%, 66%)`);
    g.addColorStop(1, `hsl(${hue}, 90%, 44%)`);
    ctx.shadowColor = `hsla(${hue}, 100%, 60%, 0.85)`;
    ctx.shadowBlur = 26 + r * 0.12;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // rim light
    ctx.strokeStyle = `hsla(${hue}, 100%, 88%, 0.55)`;
    ctx.lineWidth = Math.max(2, r * 0.03);
    ctx.beginPath();
    ctx.arc(0, 0, r - ctx.lineWidth / 2, Math.PI * 0.95, Math.PI * 1.55);
    ctx.stroke();
    if (n !== null) {
      const size = Math.max(24, r * 0.92);
      ctx.font = `900 ${size}px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.96)';
      ctx.shadowColor = `hsla(${hue}, 90%, 20%, 0.55)`;
      ctx.shadowBlur = size * 0.12;
      ctx.fillText(String(n), 0, size * 0.04);
    }
    ctx.restore();
  }

  function draw(ctx: CanvasRenderingContext2D, t: number, frame: number) {
    ctx.clearRect(0, 0, 1080, 1920);
    const loopIn = interpolate(t, [LOOP, GROW_END], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const fi = Math.min(frame, S.frames.length - 1);
    const [bx, by, br, bn] = S.frames[fi];
    const bi = lastBounceAt(t);
    const lb = bi >= 0 ? S.bounces[bi] : null;
    const since = lb ? t - lb.t : 9;
    const f = t >= TF ? 1 : fillOf(br);
    const hot = t < TF ? interpolate(f, [0.8, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1;

    // screen shake: small on late bounces, big on the pop
    let shake = 0;
    if (t < TF && since < 0.12) shake = hot * 5 * (1 - since / 0.12);
    if (t >= TF && t < TF + 0.25) shake = 9 * (1 - (t - TF) / 0.25);
    if (t >= POP && t < POP + 0.35) shake = 16 * (1 - (t - POP) / 0.35);
    const sx = Math.sin(frame * 2.3) * shake;
    const sy = Math.cos(frame * 1.7) * shake;

    ctx.save();
    ctx.translate(S.cx + sx, S.cy + sy);

    // ring
    const rh = t >= LOOP ? ringHue(0) : ringHue(f);
    const pulse = hot > 0 && t < POP ? 0.5 + 0.5 * Math.sin(t * 18) : 0;
    const ringAlpha = t >= POP ? interpolate(t, [POP, POP + 0.15], [1, 0.25], { extrapolateRight: 'clamp' }) * (1 - loopIn) + loopIn : 1;
    ctx.globalAlpha = ringAlpha;
    ctx.lineWidth = 16;
    ctx.shadowBlur = 30 + 30 * hot * pulse;
    ctx.shadowColor = `hsla(${rh}, 100%, 60%, 0.95)`;
    ctx.strokeStyle = `hsl(${rh}, 100%, ${62 + 10 * hot * pulse}%)`;
    ctx.beginPath();
    ctx.arc(0, 0, S.R + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // impact flashes on the ring + ripples, for recent bounces
    if (t < TF) {
      for (let k = bi; k >= 0 && k > bi - 10; k--) {
        const b = S.bounces[k];
        const age = t - b.t;
        if (age > 0.32) break;
        const a = Math.atan2(b.ny, b.nx);
        const life = 1 - age / 0.32;
        ctx.strokeStyle = `rgba(255,255,255,${0.9 * life})`;
        ctx.shadowColor = `hsla(${HUE[b.n]}, 100%, 70%, ${life})`;
        ctx.shadowBlur = 24;
        ctx.lineWidth = 16 + 6 * life;
        ctx.beginPath();
        ctx.arc(0, 0, S.R + 8, a - 0.08 - 0.3 * (1 - life), a + 0.08 + 0.3 * (1 - life));
        ctx.stroke();
        ctx.shadowBlur = 0;
        // outward ripple beyond the ring
        ctx.strokeStyle = `hsla(${HUE[b.n]}, 100%, 70%, ${0.5 * life})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, S.R + 20 + age * 180, a - 0.35, a + 0.35);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    if (t < TF) {
      // motion ghosts while the ball is still small
      const ghost = interpolate(f, [0, 0.35], [0.4, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      if (ghost > 0) {
        for (let k = 8; k >= 1; k--) {
          const p = S.frames[Math.max(0, fi - k * 2)];
          ctx.fillStyle = `hsla(${HUE[p[3]]}, 100%, 70%, ${ghost * (1 - k / 9) * 0.5})`;
          ctx.beginPath();
          ctx.arc(p[0], p[1], p[2] * (1 - k / 14), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      const sqAmp = 0.05 + 0.12 * (1 - f);
      const sq = lb && since < 0.11 ? sqAmp * (1 - since / 0.11) : 0;
      drawBall(ctx, bx, by, br, HUE[bn], bn, sq, lb?.nx ?? 0, lb?.ny ?? 1);
    } else if (t < POP) {
      // FULL: the ball swells to the ring and throbs
      const g = interpolate(t, [TF, TF + 0.16], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.back(3)) });
      const r = br + (S.R + 2 - br) * g;
      const x = bx * (1 - g), y = by * (1 - g);
      const throb = 1 + 0.018 * Math.sin((t - TF) * 30) * Math.min(1, (t - TF) / 0.2);
      drawBall(ctx, x, y, r * throb, HUE[S.count], S.count, 0, 0, 1);
    } else {
      // POP: shards fly out in every colour the ball has been
      const age = t - POP;
      ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, 0.8 - age * 1.6)})`;
      ctx.lineWidth = 10 * Math.max(0, 1 - age);
      ctx.beginPath();
      ctx.arc(0, 0, S.R + age * 1500, 0, Math.PI * 2);
      ctx.stroke();
      for (let k = 0; k < 320; k++) {
        const a = rnd(k * 3.1) * Math.PI * 2;
        const d0 = Math.sqrt(rnd(k * 1.7)) * S.R;
        const sp = 500 + rnd(k * 5.3) * 1400;
        const px = Math.cos(a) * (d0 + sp * age);
        const py = Math.sin(a) * (d0 + sp * age) + 1100 * age * age;
        const life = Math.max(0, 1 - age / (1.2 + rnd(k) * 0.9));
        if (life <= 0) continue;
        const hue = HUE[Math.floor(rnd(k * 9.1) * S.count)];
        ctx.fillStyle = `hsla(${hue}, 100%, 66%, ${life})`;
        const s = 6 + rnd(k * 2.2) * 16;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(age * (4 + rnd(k) * 8));
        if (k % 3 === 0) {
          ctx.beginPath();
          ctx.arc(0, 0, s * 0.55, 0, Math.PI * 2);
          ctx.fill();
        } else ctx.fillRect(-s / 2, -s * 0.3, s, s * 0.6);
        ctx.restore();
      }
      // the next tiny ball appears for the loop
      if (loopIn > 0) {
        const [x0, y0, r0] = S.frames[0];
        drawBall(ctx, x0, y0, r0, HUE[0], 0, 0, 0, 1, loopIn);
      }
    }
    ctx.restore();
  }

  const Grow: React.FC = () => {
    const outputFrame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const t = outputFrame / fps;
    const frame = Math.floor(t * 60 + 1e-8);
    const ref = useRef<HTMLCanvasElement>(null);
    useLayoutEffect(() => {
      const ctx = ref.current?.getContext('2d');
      if (ctx) draw(ctx, t, frame);
    }, [t, frame]);

    const fi = Math.min(frame, S.frames.length - 1);
    const br = S.frames[fi][2];
    const f = t >= TF ? 1 : fillOf(br);
    const pct = Math.floor(f * 100 + 1e-6);
    const hot = t < TF && f >= 0.8;
    const bi = lastBounceAt(t);
    const since = bi >= 0 ? t - S.bounces[bi].t : 9;
    const kick = t < TF && since < 0.1 ? 1 + 0.07 * (1 - since / 0.1) : 1;
    const loopIn = interpolate(t, [LOOP, GROW_END], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

    // opening hook is fully visible on frame 0 so the loop point is seamless
    const hook = t < 2.4 ? interpolate(t, [1.95, 2.25], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : loopIn;
    const hud = t < TF + 1.2 ? interpolate(t, [2.25, 2.55], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) * interpolate(t, [TF + 0.9, TF + 1.2], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0;
    const guess = interpolate(t, [0.5, 0.8, 5.2, 5.6], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const credit = t < TF ? interpolate(t, [5.8, 6.4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0;
    const almost = hot ? 0.75 + 0.25 * Math.sin(t * 18) : 0;
    const fullIn = interpolate(t, [TF, TF + 0.25], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2.5)) });
    const endIn = interpolate(t, [POP + 0.35, POP + 0.8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.8)) }) * (1 - loopIn);
    const askIn = interpolate(t, [POP + 1.1, POP + 1.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const flash = interpolate(t, [TF, TF + 0.05, TF + 0.4], [0, 0.75, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) + interpolate(t, [POP, POP + 0.04, POP + 0.3], [0, 0.55, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const shadow = '0 6px 34px rgba(0,0,0,0.9)';

    return (
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 53%, #171a36 0%, #07080f 64%)', fontFamily }}>
        <AbsoluteFill style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1.4px)', backgroundSize: '46px 46px', opacity: 0.5 }} />
        <AbsoluteFill style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 53%, transparent 55%, rgba(255,60,90,0.22) 100%)', opacity: hot ? almost : 0 }} />
        <canvas ref={ref} width={1080} height={1920} style={{ position: 'absolute', inset: 0 }} />

        {/* hook */}
        <div style={{ position: 'absolute', top: 170, width: '100%', textAlign: 'center', color: '#fff', fontWeight: 900, fontSize: 118, lineHeight: 0.98, letterSpacing: 1, opacity: hook, textShadow: shadow }}>
          EVERY BOUNCE
          <br />
          <span style={{ color: '#FFC857' }}>IT GROWS</span>
        </div>

        {/* fill meter */}
        <div style={{ position: 'absolute', top: 150, width: '100%', textAlign: 'center', color: '#fff', opacity: hud }}>
          <div style={{ fontSize: 168, fontWeight: 900, lineHeight: 1, transform: `scale(${t >= TF ? 1 + 0.25 * fullIn * (1 - fullIn) * 4 : kick})`, color: t >= TF ? '#FFC857' : hot ? '#FF6B7A' : '#fff', textShadow: t >= TF ? '0 0 60px rgba(255,200,87,0.9)' : '0 0 40px rgba(255,255,255,0.22)' }}>
            {pct}%
          </div>
          <div style={{ fontSize: 44, letterSpacing: 8, opacity: 0.85, marginTop: 4, fontWeight: t >= TF ? 900 : 400, color: t >= TF ? '#FFC857' : hot ? '#FF8A95' : '#fff' }}>
            {t >= TF ? 'FULL!' : hot ? 'ALMOST…' : 'FULL'}
          </div>
        </div>

        {/* guess prompt (drives comments) */}
        <div style={{ position: 'absolute', top: 1560, width: '100%', textAlign: 'center', color: '#fff', opacity: guess, textShadow: shadow }}>
          <div style={{ fontSize: 60, fontWeight: 700 }}>How many bounces to fill it?</div>
          <div style={{ fontSize: 46, marginTop: 12, color: '#FFC857', fontWeight: 700 }}>Guess before it ends ↓</div>
        </div>

        <div style={{ position: 'absolute', top: 1600, width: '100%', textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 34, letterSpacing: 2, opacity: credit }}>
          ♪ every bounce plays {musicTitle ?? "Canon in D"}
        </div>

        {/* result */}
        {t >= POP && (
          <div style={{ position: 'absolute', top: 700, width: '100%', textAlign: 'center', color: '#fff', opacity: endIn, transform: `scale(${0.6 + 0.4 * endIn})` }}>
            <div style={{ fontSize: 250, fontWeight: 900, lineHeight: 1, textShadow: '0 0 70px rgba(255,200,87,0.85)' }}>{S.count}</div>
            <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: 10, marginTop: 6, textShadow: shadow }}>BOUNCES</div>
            <div style={{ fontSize: 50, fontWeight: 700, marginTop: 80, color: '#FFC857', opacity: askIn, textShadow: shadow }}>Did you guess right?</div>
          </div>
        )}
        <AbsoluteFill style={{ background: '#fff', opacity: flash, pointerEvents: 'none' }} />
        {audioSrc && <Audio src={audioSrc} />}
      </AbsoluteFill>
    );
  };

  return Grow;
}

export const Grow: React.FC<CompositionProps<'grow'>> = ({ data, audioSrc, musicTitle }) => {
  const View = React.useMemo(() => createGrow(data, audioSrc, musicTitle), [data, audioSrc, musicTitle]);
  return <View />;
};
