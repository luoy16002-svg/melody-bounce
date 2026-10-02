import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Audio } from '@remotion/media';
import { CardCanvas } from './Card.js';
import type { VideoProps } from './CardVideo.js';

/** What the browser renderer records: it only mixes @remotion/media audio. */
export const ExportCard: React.FC<VideoProps> = ({audioSrc, ...card}) => (
  <AbsoluteFill>
    <CardCanvas {...card} />
    {audioSrc ? <Audio src={audioSrc} /> : null}
  </AbsoluteFill>
);
