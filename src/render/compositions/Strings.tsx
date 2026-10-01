import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, Audio, interpolate, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { loadFont } from '../font.js';

const { fontFamily } = loadFont('normal', { weights: ['400', '700', '900'], subsets: ['latin'] });

import type { CompositionProps } from '../types.js';

function createStrings(sim: unknown, audioSrc?: string, musicTitle?: string) {
  type Bounce = { t: number; ax: number; ay: number; n: number };
  const S = sim as unknown as { cx: number; cy: number; R: number; ballR: number; nBreak: number; frames: [number, number, number][]; bounces: Bounce[]; breakAt: number };
  const TB = S.breakAt ?? S.frames.length / 60 + 3600;
  const STRINGS_END = TB + 3.6;
  const LOOP = STRINGS_END - 0.45;
  const N = S.nBreak;
  const hueOf = (n: number) => (190 + n * 13.7) % 360;
  const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

  const rnd = (n: number) => {
    const x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };

  // Ring shards after the break: 40 arcs, each flying outward and spinning.
  const SHARDS = 40;
  const shardOf = (angle: number) => Math.floor((((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / ((Math.PI * 2) / SHARDS));
  const shardMotion = (k: number, age: number) => {
    const a0 = ((k + 0.5) / SHARDS) * Math.PI * 2;
    const sp = 380 + rnd(k * 3.3) * 700;
    const dx = Math.cos(a0) * sp * age;
    const dy = Math.sin(a0) * sp * age + 900 * age * age;
    const spin = (rnd(k * 7.7) - 0.5) * 6 * age;
    return { dx, dy, spin, a0 };
  };

  function draw(ctx: CanvasRenderingContext2D, t: number, frame: number) {
    ctx.clearRect(0, 0, 1080, 1920);
    const fi = Math.min(frame, S.frames.length - 1);
    const [bx, by] = S.frames[fi];
    const count = S.bounces.filter((b) => b.t <= t && b.n <= N).length;
    const broken = t >= TB;
    const age = t - TB;
    const strain = broken ? 1 : interpolate(count, [80, N - 1], [0, 1], clamp);
    const loopIn = interpolate(t, [LOOP, STRINGS_END], [0, 1], clamp);

    let shake = strain * 3.5 * (0.5 + 0.5 * Math.sin(frame * 1.9));
    if (broken && age < 0.4) shake = 18 * (1 - age / 0.4);
    const sx = Math.sin(frame * 2.3) * shake;
    const sy = Math.cos(frame * 1.7) * shake;
    ctx.save();
    ctx.translate(S.cx + sx, S.cy + sy);

    const ringHue = broken ? 20 : interpolate(count, [0, N], [190, 355]);
    if (!broken) {
      // the ring, trembling as it strains
      ctx.lineWidth = 14;
      ctx.shadowBlur = 26 + 30 * strain;
      ctx.shadowColor = `hsla(${ringHue}, 100%, 60%, 0.95)`;
      ctx.strokeStyle = `hsl(${ringHue}, 100%, ${62 + 8 * strain}%)`;
      ctx.beginPath();
      for (let k = 0; k <= 180; k++) {
        const a = (k / 180) * Math.PI * 2;
        const wob = strain * 3 * Math.sin(a * 9 + t * 40);
        const r = S.R + 7 + wob;
        if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      // cracks flicker when it's close
      if (strain > 0.3) {
        ctx.strokeStyle = `rgba(255,255,255,${0.5 * strain})`;
        ctx.lineWidth = 3;
        for (let k = 0; k < 7; k++) {
          if (rnd(k + Math.floor(t * 12)) > strain) continue;
          const a = rnd(k * 5.1) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * (S.R - 4), Math.sin(a) * (S.R - 4));
          ctx.lineTo(Math.cos(a + 0.03) * (S.R + 22), Math.sin(a + 0.03) * (S.R + 22));
          ctx.stroke();
        }
      }
    } else if (age < 1.6) {
      // shards
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      for (let k = 0; k < SHARDS; k++) {
        const { dx, dy, spin, a0 } = shardMotion(k, age);
        const half = Math.PI / SHARDS - 0.02;
        const life = Math.max(0, 1 - age / 1.5);
        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(spin);
        ctx.strokeStyle = `hsla(${ringHue + rnd(k) * 40}, 100%, 65%, ${life})`;
        ctx.beginPath();
        ctx.arc(0, 0, S.R + 7, a0 - half, a0 + half);
        ctx.stroke();
        ctx.restore();
      }
    }

    // strings (additive, so dense areas glow)
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const tied = S.bounces.filter((b) => b.t <= t && b.n <= N);
    for (const b of tied) {
      const hue = hueOf(b.n);
      let ax = b.ax, ay = b.ay;
      let ex = bx, ey = by;
      let alpha = 0.55;
      if (broken) {
        // the anchor rides its shard; the loose end whips back to it
        const k = shardOf(Math.atan2(b.ay, b.ax));
        const m = shardMotion(k, age);
        ax = b.ax + m.dx; ay = b.ay + m.dy;
        const [fx, fy] = S.frames[Math.min(S.frames.length - 1, Math.round(TB * 60))];
        const delay = rnd(b.n * 1.3) * 0.12;
        const p = interpolate(age, [delay, delay + 0.45], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
        ex = fx + (ax - fx) * p; ey = fy + (ay - fy) * p;
        alpha = 0.7 * Math.max(0, 1 - age / 1.3);
      }
      const fresh = !broken && t - b.t < 0.25 ? 1 - (t - b.t) / 0.25 : 0;
      ctx.strokeStyle = `hsla(${hue}, 100%, ${62 + 20 * fresh}%, ${alpha + 0.4 * fresh})`;
      ctx.lineWidth = 2.4 + 2 * fresh;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      // anchor knot
      ctx.fillStyle = `hsla(${hue}, 100%, 70%, ${broken ? alpha : 0.9})`;
      ctx.beginPath();
      ctx.arc(ax, ay, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // ball: trail + glowing core, tinted by the newest string
    const lastN = tied.length ? tied[tied.length - 1].n : 0;
    const bh = hueOf(lastN);
    for (let k = 10; k >= 1; k--) {
      const p = S.frames[Math.max(0, fi - k)];
      ctx.fillStyle = `hsla(${bh}, 100%, 75%, ${(1 - k / 11) * 0.28})`;
      ctx.beginPath();
      ctx.arc(p[0], p[1], S.ballR * (1 - k / 16), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowColor = `hsla(${bh}, 100%, 70%, 1)`;
    ctx.shadowBlur = 34;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(bx, by, S.ballR, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `hsl(${bh}, 100%, 62%)`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(bx, by, S.ballR - 2, 0, Math.PI * 2);
    ctx.stroke();

    // loop: the fresh ring and ball fade back in
    if (loopIn > 0) {
      ctx.globalAlpha = loopIn;
      ctx.lineWidth = 14;
      ctx.shadowBlur = 26;
      ctx.shadowColor = 'hsla(190, 100%, 60%, 0.95)';
      ctx.strokeStyle = 'hsl(190, 100%, 62%)';
      ctx.beginPath();
      ctx.arc(0, 0, S.R + 7, 0, Math.PI * 2);
      ctx.stroke();
      const [x0, y0] = S.frames[0];
      ctx.shadowColor = 'hsla(190, 100%, 70%, 1)';
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x0, y0, S.ballR, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  const Strings: React.FC = () => {
    const outputFrame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const t = outputFrame / fps;
    const frame = Math.floor(t * 60 + 1e-8);
    const ref = useRef<HTMLCanvasElement>(null);
    useLayoutEffect(() => {
      const ctx = ref.current?.getContext('2d');
      if (ctx) draw(ctx, t, frame);
    }, [t, frame]);

    const count = S.bounces.filter((b) => b.t <= t && b.n <= N).length;
    const broken = t >= TB;
    const last = [...S.bounces].reverse().find((b) => b.t <= t);
    const kick = !broken && last && t - last.t < 0.1 ? 1 + 0.07 * (1 - (t - last.t) / 0.1) : 1;
    const hot = !broken && count >= 85;
    const loopIn = interpolate(t, [LOOP, STRINGS_END], [0, 1], clamp);
    const hook = t < 2.4 ? interpolate(t, [1.95, 2.25], [1, 0], clamp) : loopIn;
    const hud = interpolate(t, [2.25, 2.55], [0, 1], clamp) * interpolate(t, [TB, TB + 0.2], [1, 0], clamp);
    const ask = interpolate(t, [0.4, 0.7, 5.2, 5.6], [0, 1, 1, 0], clamp);
    const credit = broken ? 0 : interpolate(t, [5.8, 6.4], [0, 1], clamp);
    const flash = interpolate(t, [TB, TB + 0.04, TB + 0.35], [0, 0.8, 0], clamp);
    const endIn = interpolate(t, [TB + 0.7, TB + 1.1], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.8)) }) * (1 - loopIn);
    const askEnd = interpolate(t, [TB + 1.5, TB + 1.9], [0, 1], clamp);
    const shadow = '0 6px 34px rgba(0,0,0,0.9)';

    return (
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 53%, #151a38 0%, #07080f 64%)', fontFamily }}>
        <AbsoluteFill style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1.4px)', backgroundSize: '46px 46px', opacity: 0.45 }} />
        <AbsoluteFill style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 53%, transparent 55%, rgba(255,60,90,0.24) 100%)', opacity: hot ? 0.7 + 0.3 * Math.sin(t * 20) : 0 }} />
        <canvas ref={ref} width={1080} height={1920} style={{ position: 'absolute', inset: 0 }} />

        <div style={{ position: 'absolute', top: 170, width: '100%', textAlign: 'center', color: '#fff', fontWeight: 900, fontSize: 112, lineHeight: 0.98, opacity: hook, textShadow: shadow }}>
          EVERY BOUNCE
          <br />
          <span style={{ color: '#FFC857' }}>TIES A STRING</span>
        </div>

        <div style={{ position: 'absolute', top: 150, width: '100%', textAlign: 'center', color: '#fff', opacity: hud }}>
          <div style={{ fontSize: 168, fontWeight: 900, lineHeight: 1, transform: `scale(${kick})`, color: hot ? '#FF6B7A' : '#fff', textShadow: '0 0 40px rgba(255,255,255,0.22)' }}>{count}</div>
          <div style={{ fontSize: 42, letterSpacing: 7, opacity: 0.85, marginTop: 4, color: hot ? '#FF8A95' : '#fff' }}>{hot ? 'IT’S CRACKING…' : `/ ${N} STRINGS`}</div>
        </div>

        <div style={{ position: 'absolute', top: 1580, width: '100%', textAlign: 'center', color: '#fff', opacity: ask, textShadow: shadow }}>
          <div style={{ fontSize: 60, fontWeight: 700 }}>Can the ring hold {N}?</div>
        </div>
        <div style={{ position: 'absolute', top: 1610, width: '100%', textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 34, letterSpacing: 2, opacity: credit }}>
          ♪ every bounce plays {musicTitle ?? "Ode to Joy"}
        </div>

        {broken && (
          <div style={{ position: 'absolute', top: 720, width: '100%', textAlign: 'center', color: '#fff', opacity: endIn, transform: `scale(${0.6 + 0.4 * endIn})` }}>
            <div style={{ fontSize: 150, fontWeight: 900, lineHeight: 1, letterSpacing: 2, textShadow: '0 0 70px rgba(255,120,120,0.85)' }}>SNAPPED</div>
            <div style={{ fontSize: 54, fontWeight: 700, marginTop: 18, textShadow: shadow }}>at {N} strings</div>
            <div style={{ fontSize: 50, fontWeight: 700, marginTop: 80, color: '#FFC857', opacity: askEnd, textShadow: shadow }}>Which song should break it next?</div>
          </div>
        )}
        <AbsoluteFill style={{ background: '#fff', opacity: flash }} />
        {audioSrc && <Audio src={audioSrc} />}
      </AbsoluteFill>
    );
  };

  return Strings;
}

export const Strings: React.FC<CompositionProps<'strings'>> = ({ data, audioSrc, musicTitle }) => {
  const View = React.useMemo(() => createStrings(data, audioSrc, musicTitle), [data, audioSrc, musicTitle]);
  return <View />;
};
