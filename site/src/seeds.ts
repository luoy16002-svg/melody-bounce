import { scenes, type SceneName } from '../../src/core/index.js';
import catalog from '../content/catalog.json';

/** Variations that show each scene at its best: a full escape, a close race, a narrow colour-war win. */
export const defaultSeeds = Object.fromEntries(Object.entries(catalog.scenes).map(([name, scene]) => [name, scene.seed])) as Record<SceneName, number>;

// Some random starts end too early to make a good video (a race won in one second, a hexagon escape on the
// first bounce). Shuffle skips those.
type Check = (data: never) => boolean;
const worthWatching: Partial<Record<SceneName, Check>> = {
  rings: ((d: {breaks: unknown[]}) => d.breaks.length >= 20) as Check,
  hexagon: ((d: {escaped: number | null}) => d.escaped !== null && d.escaped >= 12) as Check,
  race: ((d: {winAt: number | null}) => d.winAt !== null && d.winAt >= 8) as Check,
  colorwar: ((d: {final: number[]}) => d.final[0] !== d.final[1]) as Check,
};

export function shuffleSeed(scene: SceneName, current: number): number {
  const check = worthWatching[scene];
  for (let attempt = 0; attempt < 40; attempt++) {
    const seed = 1 + Math.floor(Math.random() * 99999);
    if (seed === current) continue;
    if (!check || check(scenes[scene](seed) as never)) return seed;
  }
  return defaultSeeds[scene];
}
