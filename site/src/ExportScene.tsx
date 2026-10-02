import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill } from 'remotion';
import { Audio } from '@remotion/media';
import { Scene } from '../../src/render/compositions/index.js';
import type { SceneName } from '../../src/core/index.js';
import { Credit, type VideoProps } from './VideoScene.js';

// The scenes paint their backdrop with CSS radial gradients, which the browser renderer skips.
// For export, the same backdrop is drawn on a canvas underneath: [center y, inner colour, outer stop, dot alpha].
const BACKDROP: Record<SceneName, [number, string, number, number]> = {
  rings: [0.52, '#161a33', 0.62, 0.05], hexagon: [0.53, '#151a38', 0.64, 0.0405], galton: [0.53, '#151a38', 0.64, 0.0405],
  grow: [0.53, '#171a36', 0.64, 0.045], multiply: [0.5, '#1a1433', 0.64, 0.045], shrink: [0.53, '#151a38', 0.64, 0.0405],
  strings: [0.53, '#151a38', 0.64, 0.0405], colorwar: [0.53, '#151a38', 0.64, 0.0405], race: [0.53, '#171a36', 0.64, 0.0405],
};

const Backdrop: React.FC<{scene: SceneName}> = ({scene}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const [cyRatio, inner, stop, dots] = BACKDROP[scene];
    const w = 1080, h = 1920, cx = w / 2, cy = h * cyRatio;
    // CSS "ellipse farthest-corner": closest-side aspect ratio, scaled to pass through the farthest corner.
    const aspect = Math.min(cy, h - cy) / (w / 2);
    const rx = Math.sqrt((w / 2) ** 2 + (Math.max(cy, h - cy) / aspect) ** 2);
    ctx.fillStyle = '#07080f';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, aspect);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(stop, '#07080f');
    ctx.fillStyle = gradient;
    ctx.fillRect(-cx, -cy / aspect, w, h / aspect);
    ctx.restore();
    // A little noise keeps the dark gradient from banding once it is encoded.
    const image = ctx.getImageData(0, 0, w, h), px = image.data;
    let seed = 7;
    for (let i = 0; i < px.length; i += 4) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      const n = ((seed >>> 16) & 3) - 1.5;
      px[i] += n; px[i + 1] += n; px[i + 2] += n;
    }
    ctx.putImageData(image, 0, 0);
    ctx.fillStyle = `rgba(255,255,255,${dots})`;
    for (let y = 23; y < h; y += 46) for (let x = 23; x < w; x += 46) { ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.fill(); }
  }, [scene]);
  return <canvas ref={ref} width={1080} height={1920} style={{position: 'absolute', inset: 0}} />;
};

/** What the browser renderer records. It only mixes @remotion/media audio, so the soundtrack goes in here instead of the scene. */
export const ExportScene: React.FC<VideoProps> = ({simulation, audioSrc, musicTitle, credit}) => (
  <AbsoluteFill style={{background: '#07080f'}}>
    <Backdrop scene={simulation.scene} />
    <Scene simulation={simulation} musicTitle={musicTitle} />
    {audioSrc ? <Audio src={audioSrc} /> : null}
    {credit ? <Credit /> : null}
  </AbsoluteFill>
);
