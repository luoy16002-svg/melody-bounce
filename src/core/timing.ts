import type { Simulation } from './index.js';
/** Original composition ending/loop times; browser-safe. */
export function naturalDuration(simulation: Simulation): number {
  switch (simulation.scene) {
    case 'rings': return simulation.data.duration;
    case 'hexagon': return simulation.data.escaped === null ? simulation.data.frames.length / 60 : simulation.data.escaped + 4;
    case 'galton': return simulation.data.done + 4.2;
    case 'grow': return simulation.data.fillAt === null ? simulation.data.duration : simulation.data.fillAt + 4;
    case 'multiply': return simulation.data.escapes.length === simulation.data.spawned ? (simulation.data.escapes.at(-1)?.t ?? simulation.data.duration) + 3 : simulation.data.duration;
    case 'shrink': return simulation.data.squeezed === null ? simulation.data.frames.length / 60 : simulation.data.squeezed + 3.6;
    case 'strings': return simulation.data.breakAt === null ? simulation.data.duration : simulation.data.breakAt + 3.6;
    case 'colorwar': return simulation.data.end + 3.6;
    case 'race': return simulation.data.winAt === null ? simulation.data.duration : simulation.data.winAt + 3.4;
  }
}
