// Dev-only: renders one frame of a scene at full size so scripts can capture thumbnails and posters.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Thumbnail } from '@remotion/player';
import { scenes, type SceneName, type Simulation } from '../../src/core/index.js';
import { naturalDuration } from '../../src/core/timing.js';
import { VideoScene } from '../src/VideoScene.js';
import { defaultSeeds } from '../src/seeds.js';

const q = new URLSearchParams(location.search);
const scene = (q.get('scene') ?? 'hexagon') as SceneName;
const seed = Number(q.get('seed') ?? defaultSeeds[scene]);
const t = Number(q.get('t') ?? 10);
const simulation = {scene, data: scenes[scene](seed)} as Simulation;
const frames = Math.round(naturalDuration(simulation) * 60);
createRoot(document.getElementById('root')!).render(
  <Thumbnail component={VideoScene} inputProps={{simulation, credit: false}} frameToDisplay={Math.min(frames - 1, Math.round(t * 60))}
    durationInFrames={frames} fps={60} compositionWidth={1080} compositionHeight={1920} style={{width: 1080, height: 1920}} />,
);
setTimeout(() => { document.body.dataset.ready = '1'; }, 1500);
