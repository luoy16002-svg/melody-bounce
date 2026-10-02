import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from 'remotion';
import { buildTimeline, cleanName, OCCASIONS, type OccasionId, type Timeline } from './songs.js';
import { BURST_DELAY, FLOOR, H, W, pieces, place } from './finale.js';
import { FONT, FROM_Y, LYRICS_TOP, NAME_Y, TITLE_Y, layoutLyrics, type Placed } from './layout.js';

export type CardProps = {occasion: OccasionId; to: string; from?: string; message?: string; credit: boolean};

type Theme = {bg: string; glow: string; accent: string; name: [string, string]; ball: string; hues: number[]};
const THEMES: Record<OccasionId, Theme> = {
  birthday: {bg: '#2b0f44', glow: 'rgba(255,107,154,0.30)', accent: '#FFC857', name: ['#FF8FB8', '#FFD27A'], ball: '#FFE6A8', hues: [330, 45, 190, 275, 12]},
  congrats: {bg: '#0a3236', glow: 'rgba(91,231,196,0.26)', accent: '#5BE7C4', name: ['#6FF0CF', '#FFE29A'], ball: '#E9FFF8', hues: [165, 45, 200, 52, 300]},
  christmas: {bg: '#0d3322', glow: 'rgba(255,90,95,0.24)', accent: '#FF6B6B', name: ['#FF7A7A', '#FFD98E'], ball: '#FFFFFF', hues: [0, 130, 45, 355, 140]},
};

let fontReady: Promise<void> | undefined;
function useFont() {
  const [handle] = useState(() => delayRender('Loading Outfit'));
  useLayoutEffect(() => {
    fontReady ??= document.fonts.load(`900 100px Outfit`).then(() => document.fonts.load(`800 72px Outfit`)).then(() => undefined);
    fontReady.then(() => continueRender(handle), () => continueRender(handle));
  }, [handle]);
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOutBack = (p: number) => { const c = 1.9; return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2; };
const rnd = (n: number) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };

function ballAt(t: number, tl: Timeline, placed: Placed[]): {x: number; y: number; squash: number; visible: boolean} {
  const land = (i: number) => { const p = placed[tl.notes[i].syllable]; return {x: p.cx, y: p.y - p.size * 0.78 - 20}; };
  const first = tl.notes[0], last = tl.notes[tl.notes.length - 1];
  const squashAt = (since: number) => (since >= 0 && since < 0.14 ? 1 - 0.32 * Math.sin((since / 0.14) * Math.PI) : 1);
  if (t < first.t - 0.8) return {x: 0, y: 0, squash: 1, visible: false};
  if (t < first.t) {
    const p = land(0), k = t - (first.t - 0.8);
    return {x: p.x, y: p.y - 600 + 0.5 * 1875 * k * k, squash: 1, visible: true};
  }
  const burst = tl.songEnd + BURST_DELAY;
  if (t >= burst) return {x: 0, y: 0, squash: 1, visible: false};
  if (t >= tl.songEnd) {
    const a = land(tl.notes.length - 1), s = (t - tl.songEnd) / BURST_DELAY;
    return {x: a.x + (540 - a.x) * s, y: a.y + (NAME_Y - a.y) * s - 260 * 4 * s * (1 - s), squash: 1, visible: true};
  }
  let i = 0;
  while (i + 1 < tl.notes.length && tl.notes[i + 1].t <= t) i++;
  const a = land(i);
  if (i === tl.notes.length - 1) return {x: a.x, y: a.y, squash: squashAt(t - last.t), visible: true};
  const b = land(i + 1), n = tl.notes[i], d = tl.notes[i + 1].t - n.t, s = (t - n.t) / d;
  const lineChange = tl.syllables[tl.notes[i + 1].syllable].line !== tl.syllables[n.syllable].line;
  const h = tl.notes[i + 1].hop ? 34 : Math.min(240, 70 + 120 * d) + (lineChange ? 90 : 0);
  return {x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s - h * 4 * s * (1 - s), squash: squashAt(t - n.t), visible: true};
}

function draw(ctx: CanvasRenderingContext2D, t: number, props: CardProps, tl: Timeline) {
  const theme = THEMES[props.occasion];
  const {placed} = layoutLyrics(ctx, tl);
  const burst = tl.songEnd + BURST_DELAY;

  // Backdrop
  ctx.fillStyle = '#07080f';
  ctx.fillRect(0, 0, W, H);
  let g = ctx.createRadialGradient(540, 820, 0, 540, 820, 1250);
  g.addColorStop(0, theme.bg); g.addColorStop(1, '#07080f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(540, 380, 0, 540, 380, 560);
  g.addColorStop(0, theme.glow); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 28; i++) {
    const x = rnd(i) * W + Math.sin(t * 0.3 + i) * 30, y = (rnd(i + 99) * H - t * (12 + rnd(i + 7) * 22)) % H;
    const r = 18 + rnd(i + 3) * 60;
    const b = ctx.createRadialGradient(x, (y + H) % H, 0, x, (y + H) % H, r);
    b.addColorStop(0, `hsla(${theme.hues[i % theme.hues.length]}, 90%, 70%, ${0.05 + rnd(i + 5) * 0.07})`);
    b.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = b; ctx.beginPath(); ctx.arc(x, (y + H) % H, r, 0, Math.PI * 2); ctx.fill();
  }
  if (props.occasion === 'christmas') {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 90; i++) {
      const speed = 40 + rnd(i + 11) * 70, y = (rnd(i + 21) * H + t * speed) % H;
      const x = (rnd(i + 31) * W + Math.sin(t * 0.8 + i) * 24 + W) % W, r = 1.5 + rnd(i + 41) * 3;
      ctx.globalAlpha = 0.25 + rnd(i + 51) * 0.5;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Title
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const titleIn = clamp01((t - 0.15) / 0.6);
  ctx.globalAlpha = titleIn;
  ctx.font = `900 92px ${FONT}`;
  (ctx as CanvasRenderingContext2D & {letterSpacing: string}).letterSpacing = '3px';
  ctx.shadowColor = theme.glow; ctx.shadowBlur = 40;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(OCCASIONS[props.occasion].title.toUpperCase(), 540, TITLE_Y + (1 - titleIn) * 30);
  (ctx as CanvasRenderingContext2D & {letterSpacing: string}).letterSpacing = '0px';
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;

  // Name: pops in when the ball first lands on it (or right away if the song never sings it).
  const name = cleanName(props.to) || 'you';
  const nameNote = tl.notes.find(n => tl.syllables[n.syllable].isName);
  const reveal = nameNote ? nameNote.t : tl.start - 0.35;
  if (t >= reveal) {
    const p = clamp01((t - reveal) / 0.5), scale = 0.55 + 0.45 * easeOutBack(p);
    let size = 158;
    ctx.font = `900 ${size}px ${FONT}`;
    while (ctx.measureText(name).width > 960 && size > 60) { size -= 4; ctx.font = `900 ${size}px ${FONT}`; }
    const pulse = t > burst ? 1 + 0.025 * Math.sin((t - burst) * 5) : 1;
    ctx.save();
    ctx.translate(540, NAME_Y); ctx.scale(scale * pulse, scale * pulse);
    const w = ctx.measureText(name).width;
    const ng = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    ng.addColorStop(0, theme.name[0]); ng.addColorStop(1, theme.name[1]);
    ctx.globalAlpha = clamp01(p * 2);
    ctx.shadowColor = theme.name[0]; ctx.shadowBlur = 50 + 40 * Math.max(0, 1 - (t - reveal) / 1.2);
    ctx.fillStyle = ng;
    ctx.fillText(name, 0, size * 0.33);
    ctx.restore();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    // A ring and a spray of sparks the moment the name lands.
    const age = t - reveal;
    if (age < 0.9) {
      ctx.strokeStyle = theme.name[1]; ctx.lineWidth = 6 * (1 - age / 0.9); ctx.globalAlpha = 1 - age / 0.9;
      ctx.beginPath(); ctx.ellipse(540, NAME_Y, 120 + 420 * age, 60 + 160 * age, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = theme.name[0];
      for (let j = 0; j < 18; j++) {
        const a = (j / 18) * Math.PI * 2 + rnd(j) * 0.3, r = 90 + 380 * age * (0.6 + rnd(j + 40) * 0.6);
        ctx.beginPath(); ctx.arc(540 + Math.cos(a) * r, NAME_Y + Math.sin(a) * r * 0.55, 5 * (1 - age / 0.9) + 1.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // Lyrics
  const current = tl.notes.findIndex(n => n.t > t);
  const currentLine = current < 0 ? -1 : tl.syllables[tl.notes[current].syllable].line;
  const ending = clamp01((t - burst) / 0.8);
  ctx.textAlign = 'left';
  tl.syllables.forEach((s, id) => {
    const p = placed[id];
    const sungAt = tl.notes.find(n => n.syllable === id)?.t ?? Infinity;
    const lit = t >= sungAt;
    const since = t - sungAt;
    ctx.font = `800 ${p.size}px ${FONT}`;
    let alpha = lit ? 1 : s.line === currentLine ? 0.5 : 0.26;
    alpha *= 1 - 0.55 * ending;
    const pop = lit && since < 0.25 ? 1 + 0.14 * (1 - since / 0.25) : 1;
    ctx.save();
    ctx.translate(p.cx, p.y); ctx.scale(pop, pop); ctx.translate(-p.cx, -p.y);
    ctx.globalAlpha = alpha;
    if (s.isName) {
      const ng = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
      ng.addColorStop(0, theme.name[0]); ng.addColorStop(1, theme.name[1]);
      ctx.fillStyle = ng;
    } else ctx.fillStyle = lit ? '#ffffff' : '#c9cde6';
    if (lit) { ctx.shadowColor = s.isName ? theme.name[0] : theme.accent; ctx.shadowBlur = since < 0.6 ? 30 * (1 - since / 0.6) + 8 : 8; }
    ctx.fillText(p.text, p.x, p.y);
    ctx.restore();
  });
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;

  // Sparks where the ball lands
  tl.notes.forEach((n, i) => {
    const age = t - n.t;
    if (age < 0 || age > 0.45 || n.hop) return;
    const p = placed[n.syllable], k = age / 0.45;
    ctx.fillStyle = theme.accent;
    for (let j = 0; j < 8; j++) {
      const a = -Math.PI * (0.1 + 0.8 * rnd(i * 13 + j)), r = 26 + 70 * k * (0.6 + rnd(i * 7 + j));
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.beginPath(); ctx.arc(p.cx + Math.cos(a) * r, p.y - p.size * 0.78 + Math.sin(a) * r, 4 * (1 - k) + 1, 0, Math.PI * 2); ctx.fill();
    }
  });
  ctx.globalAlpha = 1;

  // Ball with a short trail
  for (let k = 6; k >= 0; k--) {
    const b = ballAt(t - k * 0.018, tl, placed);
    if (!b.visible) continue;
    const r = 21;
    if (k > 0) {
      ctx.globalAlpha = 0.16 * (1 - k / 7);
      ctx.fillStyle = theme.ball;
      ctx.beginPath(); ctx.arc(b.x, b.y, r * (1 - k * 0.07), 0, Math.PI * 2); ctx.fill();
      continue;
    }
    ctx.globalAlpha = 1;
    const glow = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 3.2);
    glow.addColorStop(0, 'rgba(255,255,255,0.55)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(b.x, b.y, r * 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(b.x, b.y + r * (1 - b.squash)); ctx.scale(2 - b.squash, b.squash);
    const core = ctx.createRadialGradient(-6, -7, 2, 0, 0, r);
    core.addColorStop(0, '#ffffff'); core.addColorStop(1, theme.ball);
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // Finale: a ring of light and the confetti
  if (t >= burst) {
    const dt = t - burst;
    if (dt < 0.7) {
      ctx.strokeStyle = theme.accent; ctx.lineWidth = 10 * (1 - dt / 0.7); ctx.globalAlpha = 1 - dt / 0.7;
      ctx.beginPath(); ctx.arc(540, NAME_Y, 40 + 520 * dt, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const piece of pieces(540, NAME_Y, theme.hues)) {
      const pos = place(piece, dt);
      ctx.save();
      ctx.translate(pos.x, pos.y);
      if (piece.coin) {
        const flash = pos.landed.some(l => dt - l >= 0 && dt - l < 0.25) ? 1 : 0;
        ctx.shadowColor = `hsl(${piece.hue}, 95%, 70%)`; ctx.shadowBlur = 12 + 30 * flash;
        ctx.fillStyle = `hsl(${piece.hue}, 95%, ${62 + 20 * flash}%)`;
        ctx.beginPath(); ctx.arc(0, 0, piece.size, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.rotate(pos.angle);
        ctx.scale(1, Math.abs(Math.cos(pos.angle * 1.7)) * 0.8 + 0.2);
        ctx.fillStyle = `hsl(${piece.hue}, 90%, 64%)`;
        ctx.fillRect(-piece.size / 2, -piece.size / 3, piece.size, piece.size * 0.66);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 0.18; ctx.fillStyle = theme.accent; ctx.fillRect(160, FLOOR + 22, W - 320, 3); ctx.globalAlpha = 1;
  }

  // From and message
  const fromIn = clamp01((t - tl.songEnd - 1.0) / 0.6);
  ctx.textAlign = 'center';
  if (fromIn > 0 && (props.from || props.message)) {
    ctx.globalAlpha = fromIn;
    let y = FROM_Y;
    if (props.message) {
      ctx.font = `600 44px ${FONT}`; ctx.fillStyle = '#ffffff';
      for (const line of wrap(ctx, props.message, 900).slice(0, 2)) { ctx.fillText(line, 540, y); y += 58; }
      y += 12;
    }
    if (props.from) {
      ctx.font = `700 40px ${FONT}`; ctx.fillStyle = theme.accent;
      ctx.fillText(`from ${props.from}`, 540, y);
    }
    ctx.globalAlpha = 1;
  }
  if (props.credit) {
    ctx.font = `700 30px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.38)';
    (ctx as CanvasRenderingContext2D & {letterSpacing: string}).letterSpacing = '3px';
    ctx.fillText('melodybounce.com', 540, 1858);
    (ctx as CanvasRenderingContext2D & {letterSpacing: string}).letterSpacing = '0px';
  }
  void LYRICS_TOP;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const words = text.split(/\s+/), lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** The whole card on one canvas. Audio is added by the wrapper that uses it (Player or renderer). */
export const CardCanvas: React.FC<CardProps> = props => {
  useFont();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const timeline = useMemo(() => buildTimeline(props.occasion, props.to), [props.occasion, props.to]);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) draw(ctx, frame / fps, props, timeline);
  });
  return <AbsoluteFill style={{background: '#07080f'}}><canvas ref={ref} width={W} height={H} style={{width: '100%', height: '100%'}} /></AbsoluteFill>;
};

export function cardSeconds(occasion: OccasionId, to: string): number {
  return buildTimeline(occasion, to).end;
}
