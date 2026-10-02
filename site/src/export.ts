import { canRenderMediaOnWeb, renderMediaOnWeb } from '@remotion/web-renderer';
import { ExportScene } from './ExportScene.js';
import type { VideoProps } from './VideoScene.js';

export const WIDTH = 1080, HEIGHT = 1920;

export type ExportSupport = {ok: boolean; reason?: string};

export async function exportSupport(): Promise<ExportSupport> {
  if (typeof VideoEncoder === 'undefined') return {ok: false, reason: 'Video export needs a browser with WebCodecs, such as a recent Chrome, Edge, Safari or Firefox.'};
  try {
    const check = await canRenderMediaOnWeb({width: WIDTH, height: HEIGHT, container: 'mp4', videoCodec: 'h264', audioCodec: 'aac'});
    if (check.canRender) return {ok: true};
    const issue = check.issues.find(i => i.severity === 'error');
    return {ok: false, reason: issue?.message ?? 'This browser cannot encode MP4 video.'};
  } catch (error) {
    return {ok: false, reason: (error as Error).message};
  }
}

export async function exportVideo(options: {
  props: VideoProps; durationInFrames: number; fps: number; scale?: number;
  onProgress: (progress: number) => void; signal: AbortSignal;
}): Promise<Blob> {
  const {props, durationInFrames, fps, scale = 1, onProgress, signal} = options;
  const result = await renderMediaOnWeb({
    composition: {component: ExportScene, id: 'melody-bounce', width: WIDTH, height: HEIGHT, fps, durationInFrames, defaultProps: props},
    inputProps: props,
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
    videoBitrate: 'high',
    audioBitrate: 'high',
    scale,
    signal,
    onProgress: p => onProgress(p.progress),
    licenseKey: 'free-license',
    isProduction: true,
    logLevel: 'error',
  });
  return result.getBlob();
}
