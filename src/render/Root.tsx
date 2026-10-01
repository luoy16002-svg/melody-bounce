import React from 'react';
import { Composition, getInputProps } from 'remotion';
import { simulate } from '../core/index.js';
import { Scene } from './compositions/index.js';
import type { RenderInput } from './types.js';

export const Root: React.FC = () => {
  const input = getInputProps<RenderInput>();
  const simulation = input.simulation ?? simulate('rings', 1);
  return <Composition id="melody-bounce" component={Scene} width={1080} height={1920}
    fps={input.fps ?? 60} durationInFrames={input.durationInFrames ?? 60}
    defaultProps={{simulation, audioSrc: input.audioSrc, musicTitle: input.musicTitle}} />;
};
