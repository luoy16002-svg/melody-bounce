import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Scene } from '../../src/render/compositions/index.js';
import { fontFamily } from '../../src/render/font.js';
import type { Simulation } from '../../src/core/index.js';

export type VideoProps = {
  simulation: Simulation;
  audioSrc?: string;
  musicTitle?: string;
  credit: boolean;
};

export const Credit: React.FC = () => (
  <div style={{position: 'absolute', bottom: 64, width: '100%', textAlign: 'center', fontFamily, fontWeight: 700, fontSize: 34,
    letterSpacing: 3, color: 'rgba(255,255,255,0.42)'}}>melodybounce.com</div>
);

/** What the Player shows. The soundtrack plays through the scene's own <Audio>. */
export const VideoScene: React.FC<VideoProps> = ({simulation, audioSrc, musicTitle, credit}) => (
  <AbsoluteFill style={{background: '#07080f'}}>
    <Scene simulation={simulation} musicTitle={musicTitle} audioSrc={audioSrc} />
    {credit ? <Credit /> : null}
  </AbsoluteFill>
);
