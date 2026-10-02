// Dev-only: renders one frame of a card at full size so scripts can capture stills.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Thumbnail } from '@remotion/player';
import { CardVideo } from '../src/CardVideo.js';
import { cardSeconds } from '../src/Card.js';
import type { OccasionId } from '../src/songs.js';

const q = new URLSearchParams(location.search);
const occasion = (q.get('o') ?? 'birthday') as OccasionId;
const to = q.get('to') ?? 'Anna';
const t = Number(q.get('t') ?? 5);
const frames = Math.ceil(cardSeconds(occasion, to) * 30);
createRoot(document.getElementById('root')!).render(
  <Thumbnail component={CardVideo} inputProps={{occasion, to, from: q.get('from') ?? 'Kai', message: q.get('m') ?? 'Have the best day!', credit: true}}
    frameToDisplay={Math.min(frames - 1, Math.round(t * 30))} durationInFrames={frames} fps={30} compositionWidth={1080} compositionHeight={1920}
    style={{width: 1080, height: 1920}} />,
);
setTimeout(() => { document.body.dataset.ready = '1'; }, 1500);
