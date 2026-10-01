import { run as rings } from './scenes/escape.js';
import { run as hexagon } from './scenes/hexagon.js';
import { run as galton } from './scenes/galton.js';
import { run as grow } from './scenes/grow.js';
import { run as multiply } from './scenes/multiply.js';
import { run as shrink } from './scenes/shrink.js';
import { run as strings } from './scenes/strings.js';
import { run as colorwar } from './scenes/colorwar.js';
import { run as race } from './scenes/race.js';
export const scenes = { rings, hexagon, galton, grow, multiply, shrink, strings, colorwar, race };
export type SceneName = keyof typeof scenes;
export type SceneData<N extends SceneName> = ReturnType<(typeof scenes)[N]>;
export type Simulation = { [N in SceneName]: { scene: N; data: SceneData<N> } }[SceneName];
export function simulate<N extends SceneName>(scene: N, seed = 1): {scene: N; data: SceneData<N>} {
  return { scene, data: scenes[scene](seed) as SceneData<N> };
}
