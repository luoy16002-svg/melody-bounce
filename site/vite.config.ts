import { defineConfig } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error plain ESM helper shared with scripts/build-pages.mjs
import { fillPartials } from './content/partials.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workspace = resolve(root, '..');

export default defineConfig({
  root,
  publicDir: resolve(root, 'public'),
  plugins: [{name: 'partials', transformIndexHtml: (html: string) => fillPartials(html, '/')}],
  server: {host: '127.0.0.1', fs: {allow: [workspace]}},
  preview: {host: '127.0.0.1'},
  worker: {format: 'es'},
  build: {outDir: resolve(root, 'dist'), emptyOutDir: true, target: 'es2022', assetsDir: 'app', chunkSizeWarningLimit: 1500},
});
