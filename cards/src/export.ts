import { canRenderMediaOnWeb, renderMediaOnWeb } from '@remotion/web-renderer';
import { ExportCard } from './ExportCard.js';
import type { VideoProps } from './CardVideo.js';

export async function canExport(): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined') return false;
  try { return (await canRenderMediaOnWeb({width: 1080, height: 1920, container: 'mp4', videoCodec: 'h264', audioCodec: 'aac'})).canRender; } catch { return false; }
}

export async function exportCard(props: VideoProps, seconds: number, onProgress: (p: number) => void, signal: AbortSignal): Promise<Blob> {
  const fps = 30, durationInFrames = Math.ceil(seconds * fps);
  const result = await renderMediaOnWeb({
    composition: {component: ExportCard, id: 'singing-card', width: 1080, height: 1920, fps, durationInFrames, defaultProps: props},
    inputProps: props, container: 'mp4', videoCodec: 'h264', audioCodec: 'aac', videoBitrate: 'high', audioBitrate: 'high',
    signal, onProgress: p => onProgress(p.progress), licenseKey: 'free-license', isProduction: true, logLevel: 'error',
  });
  return result.getBlob();
}
