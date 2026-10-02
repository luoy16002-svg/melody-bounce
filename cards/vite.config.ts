import { defineConfig } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const workspace = resolve(root, '..');

export default defineConfig({
  root,
  publicDir: resolve(root, 'public'),
  server: {host: '127.0.0.1', fs: {allow: [workspace]}},
  preview: {host: '127.0.0.1'},
  worker: {format: 'es'},
  build: {
    outDir: resolve(root, 'dist'), emptyOutDir: true, target: 'es2022', assetsDir: 'app', chunkSizeWarningLimit: 1500,
    rollupOptions: {input: {main: resolve(root, 'index.html'), card: resolve(root, 'c/index.html')}},
  },
});
