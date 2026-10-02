import React from 'react';
import { AbsoluteFill, Audio } from 'remotion';
import { CardCanvas, type CardProps } from './Card.js';

export type VideoProps = CardProps & {audioSrc?: string};

/** What the Player shows. */
export const CardVideo: React.FC<VideoProps> = ({audioSrc, ...card}) => (
  <AbsoluteFill>
    <CardCanvas {...card} />
    {audioSrc ? <Audio src={audioSrc} /> : null}
  </AbsoluteFill>
);
