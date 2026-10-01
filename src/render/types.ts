import type { SceneData, SceneName, Simulation } from '../core/index.js';

export type CompositionProps<N extends SceneName> = {data: SceneData<N>; audioSrc?: string; musicTitle?: string};
export type SceneProps = {simulation: Simulation; audioSrc?: string; musicTitle?: string};
export type RenderInput = SceneProps & {fps: number; durationInFrames: number};
