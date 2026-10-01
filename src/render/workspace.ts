import { realpath, rm } from 'node:fs/promises';
import { isAbsolute, relative, sep } from 'node:path';

/** Only remove directories created beneath the caller's intended work directory. */
export async function removeWorkDirectory(directory: string, parent: string): Promise<void> {
  const [target, boundary] = await Promise.all([realpath(directory), realpath(parent)]);
  const child = relative(boundary, target);
  if (!child || child === '..' || child.startsWith('..' + sep) || isAbsolute(child)) throw new Error(`Refusing cleanup outside work directory: ${target}`);
  await rm(target, {recursive: true, force: true});
}
