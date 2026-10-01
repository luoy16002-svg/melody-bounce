import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { RenderInternals } from '@remotion/renderer';
const execute = promisify(execFile);

/** Isolate the pinned Remotion 4 binary resolver; no system FFmpeg is required. */
export async function mediaTool(type: 'ffmpeg' | 'ffprobe', args: string[]) {
  const binary = RenderInternals.getExecutablePath({type, binariesDirectory: null, indent: false, logLevel: 'error'});
  try { return await execute(binary, args, {windowsHide: true, maxBuffer: 16 * 1024 * 1024}); }
  catch (error) { throw new Error(`${type} failed: ${(error as Error & {stderr?: string}).stderr ?? (error as Error).message}`); }
}
