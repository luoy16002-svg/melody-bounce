import { defineConfig } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const workspace = resolve(root, '../..');
export default defineConfig({
  root,
  server: {host: '127.0.0.1', fs: {allow: [workspace]}},
  worker: {format: 'es'},
  build: {outDir: resolve(workspace, '.tmp/player-build'), emptyOutDir: false, target: 'es2022'},
});
