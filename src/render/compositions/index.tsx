import React from 'react';
import type { SceneProps } from '../types.js';
import { Escape } from './Escape.js';
import { Multiply } from './Multiply.js';
import { Grow } from './Grow.js';
import { Strings } from './Strings.js';
import { Race } from './Race.js';
import { Hexagon } from './mb/Hexagon.js';
import { Galton } from './mb/Galton.js';
import { Shrink } from './mb/Shrink.js';
import { ColorWar } from './mb/ColorWar.js';

export { Escape, Escape as Rings, Multiply, Grow, Strings, Race, Hexagon, Galton, Shrink, ColorWar };
export type { CompositionProps, SceneProps } from '../types.js';
/** Same component tree for rendered video and @remotion/player. No module-global simulation state. */
export const Scene: React.FC<SceneProps> = ({simulation, audioSrc, musicTitle}) => {
  const audio = {audioSrc, musicTitle};
  switch (simulation.scene) {
    case 'rings': return <Escape data={simulation.data} {...audio} />;
    case 'multiply': return <Multiply data={simulation.data} {...audio} />;
    case 'grow': return <Grow data={simulation.data} {...audio} />;
    case 'strings': return <Strings data={simulation.data} {...audio} />;
    case 'race': return <Race data={simulation.data} {...audio} />;
    case 'hexagon': return <Hexagon data={simulation.data} {...audio} />;
    case 'galton': return <Galton data={simulation.data} {...audio} />;
    case 'shrink': return <Shrink data={simulation.data} {...audio} />;
    case 'colorwar': return <ColorWar data={simulation.data} {...audio} />;
  }
};
