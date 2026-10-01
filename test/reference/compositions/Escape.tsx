import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Outfit';
import sim from '../public/escape.json';

const { fontFamily } = loadFont('normal', { weights: ['400', '700', '900'], subsets: ['latin'] });

type Ring = { R: number; gap: number; a0: number; w: number; hue: number; broken: number | null };
const S = sim as unknown as {
  fps: number; cx: number; cy: number; ballR: number; rings: Ring[]; frames: [number, number][];
  bounces: { t: number }[]; breaks: { t: number; ring: number }[]; escapedAt: number | null; duration: number;
};

const TOTAL = S.rings.length;
const ringColor = (i: number, a = 1) => `hsla(${(18 + i * 37) % 360}, 95%, 62%, ${a})`;

// Deterministic pseudo-random for particles.
const rnd = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

function draw(ctx: CanvasRenderingContext2D, t: number, frame: number) {
  const { cx, cy } = S;
  ctx.clearRect(0, 0, 1080, 1920);

  // Camera: gently zooms out as outer rings become the active boundary.
  const brokenCount = S.breaks.filter((b) => b.t <= t).length;
  const active = Math.min(brokenCount, TOTAL - 1);
  // Keep the active ring about 440 px in radius on screen, easing smoothly after each break.
  const zFor = (i: number) => Math.min(1.6, 440 / S.rings[Math.min(i, TOTAL - 1)].R);
  const prevBreak = [...S.breaks].reverse().find((b) => b.t <= t);
  const k = prevBreak ? Math.min(1, (t - prevBreak.t) / 0.9) : 1;
  const ease = 1 - Math.pow(1 - k, 3);
  const zoom = zFor(Math.max(0, brokenCount - 1)) + (zFor(brokenCount) - zFor(Math.max(0, brokenCount - 1))) * (brokenCount === 0 ? 1 : ease);
  // Screen shake right after a break.
  const lastBreak = [...S.breaks].reverse().find((b) => b.t <= t);
  const since = lastBreak ? t - lastBreak.t : 9;
  const shake = since < 0.25 ? (1 - since / 0.25) * 9 : 0;
  const sx = Math.sin(frame * 2.3) * shake;
  const sy = Math.cos(frame * 1.7) * shake;

  ctx.save();
  ctx.translate(cx + sx, cy + sy);
  ctx.scale(zoom, zoom);

  // Rings
  S.rings.forEach((r, i) => {
    if (r.broken !== null && r.broken <= t) return;
    const rot = r.a0 + r.w * t;
    const isActive = i === active;
    ctx.lineCap = 'round';
    ctx.lineWidth = isActive ? 11 : 8;
    ctx.strokeStyle = ringColor(i, isActive ? 1 : 0.55);
    ctx.shadowColor = ringColor(i, 0.9);
    ctx.shadowBlur = isActive ? 28 : 10;
    ctx.beginPath();
    ctx.arc(0, 0, r.R, rot + r.gap, rot - r.gap + Math.PI * 2);
    ctx.stroke();
  });
  ctx.shadowBlur = 0;

  // Shatter particles for each broken ring (1.3 s life).
  S.breaks.forEach((b, bi) => {
    const age = t - b.t;
    if (age < 0 || age > 1.3) return;
    const r = S.rings[b.ring];
    const rot = r.a0 + r.w * b.t;
    const N = 46;
    for (let k = 0; k < N; k++) {
      const a = rot + r.gap + (k / N) * (Math.PI * 2 - 2 * r.gap);
      const sp = 140 + rnd(bi * 100 + k) * 420;
      const dirA = a + (rnd(bi * 7 + k) - 0.5) * 0.9;
      const px = Math.cos(a) * r.R + Math.cos(dirA) * sp * age;
      const py = Math.sin(a) * r.R + Math.sin(dirA) * sp * age + 700 * age * age;
      const life = 1 - age / 1.3;
      ctx.fillStyle = ringColor(b.ring, life);
      ctx.beginPath();
      ctx.arc(px, py, 5 * life + 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // flash ring
    if (age < 0.35) {
      ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - age / 0.35)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r.R + age * 160, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  // Victory burst after the escape
  if (S.escapedAt !== null && t >= S.escapedAt) {
    const age = t - S.escapedAt;
    for (let k2 = 0; k2 < 140; k2++) {
      const a = rnd(k2 * 3.1) * Math.PI * 2;
      const sp = 300 + rnd(k2 * 5.7) * 900;
      const px = Math.cos(a) * sp * age;
      const py = Math.sin(a) * sp * age + 900 * age * age - 200;
      const life = Math.max(0, 1 - age / 1.6);
      ctx.fillStyle = ringColor(k2 % TOTAL, life);
      ctx.fillRect(px, py, (14 * life + 3) / zoom, (24 * life + 4) / zoom);
    }
  }

  // Ball trail + ball
  const fi = Math.min(frame, S.frames.length - 1);
  for (let k = 14; k >= 1; k--) {
    const p = S.frames[Math.max(0, fi - k * 2)];
    const a = (1 - k / 15) * 0.45;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath();
    ctx.arc(p[0], p[1], Math.max(S.ballR, 16 / zoom) * (1 - k / 22), 0, Math.PI * 2);
    ctx.fill();
  }
  const [bx, by] = S.frames[fi];
  // bounce pulse
  const lastBounce = [...S.bounces].reverse().find((b) => b.t <= t);
  const pulse = lastBounce && t - lastBounce.t < 0.12 ? 1 + (1 - (t - lastBounce.t) / 0.12) * 0.35 : 1;
  ctx.shadowColor = 'rgba(255,255,255,0.95)';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(bx, by, Math.max(S.ballR, 16 / zoom) * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export const Escape: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) draw(ctx, t, frame);
  }, [t, frame]);

  const left = TOTAL - S.breaks.filter((b) => b.t <= t).length;
  const escaped = S.escapedAt !== null && t >= S.escapedAt;
  const hook = interpolate(t, [0, 0.3, 2.6, 3.1], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const lastBreak = [...S.breaks].reverse().find((b) => b.t <= t);
  const pop = lastBreak ? interpolate(t - lastBreak.t, [0, 0.12, 0.3], [1.35, 0.95, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1;
  const endIn = S.escapedAt ? interpolate(t, [S.escapedAt, S.escapedAt + 0.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2)) }) : 0;
  const tension = left <= 3 && !escaped;

  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 52%, #161a33 0%, #07080f 62%)', fontFamily }}>
      <AbsoluteFill
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.4px)',
          backgroundSize: '46px 46px',
          opacity: 0.5,
        }}
      />
      <canvas ref={ref} width={1080} height={1920} style={{ position: 'absolute', inset: 0 }} />
      {/* tension vignette on the last rings */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse 75% 60% at 50% 52%, transparent 55%, rgba(255,70,70,0.15) 100%)',
          opacity: tension ? 0.4 + 0.6 * Math.max(0, 1 - (t - ([...S.bounces].reverse().find((b) => b.t <= t)?.t ?? 0)) / 0.3) : 0,
        }}
      />

      {/* rings-left counter */}
      <div style={{ position: 'absolute', top: 150, width: '100%', textAlign: 'center', color: '#fff', opacity: escaped ? 0 : 1 }}>
        <div style={{ fontSize: 150, fontWeight: 900, lineHeight: 1, transform: `scale(${pop})`, color: tension ? '#FF6B5B' : '#FFFFFF', textShadow: '0 0 40px rgba(255,255,255,0.25)' }}>
          {left}
        </div>
        <div style={{ fontSize: 40, fontWeight: 400, letterSpacing: 6, opacity: 0.75, marginTop: 6 }}>{left === 1 ? 'RING LEFT' : 'RINGS LEFT'}</div>
      </div>

      {/* hook */}
      <div style={{ position: 'absolute', bottom: 330, width: '100%', textAlign: 'center', opacity: hook, color: '#fff', fontWeight: 700, fontSize: 64, lineHeight: 1.15, padding: '0 90px', textShadow: '0 6px 30px rgba(0,0,0,0.9)' }}>
        Can it escape all {TOTAL} rings?
      </div>

      {/* music credit */}
      <div style={{ position: 'absolute', bottom: 150, width: '100%', textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 34, letterSpacing: 2, opacity: interpolate(t, [4, 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) * (escaped ? 0 : 1) }}>
        ♪ every bounce plays Für Elise
      </div>

      {/* end question for comments */}
      {escaped && (
        <div style={{ position: 'absolute', bottom: 260, width: '100%', textAlign: 'center', color: '#fff', fontSize: 52, fontWeight: 700, textShadow: '0 2px 18px rgba(0,0,0,0.9)', opacity: interpolate(t, [S.escapedAt! + 1.0, S.escapedAt! + 1.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
          Which song should it play next?
        </div>
      )}

      {/* escaped */}
      {escaped && (
        <div style={{ position: 'absolute', top: 760, width: '100%', textAlign: 'center', color: '#fff', transform: `scale(${0.6 + 0.4 * endIn})`, opacity: endIn }}>
          <div style={{ fontSize: 150, fontWeight: 900, letterSpacing: 2, textShadow: '0 0 60px rgba(255,190,90,0.8)' }}>ESCAPED</div>
          <div style={{ fontSize: 46, opacity: 0.85, marginTop: 10, textShadow: '0 2px 18px rgba(0,0,0,0.9)' }}>in {S.escapedAt!.toFixed(1)} seconds</div>
        </div>
      )}
      <Audio src={staticFile('escape.wav')} />
    </AbsoluteFill>
  );
};
