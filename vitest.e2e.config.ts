import { defineConfig } from 'vitest/config';
export default defineConfig({test: {
  include: ['test/e2e/**/*.test.ts'], setupFiles: ['test/e2e/setup.ts'],
  testTimeout: 180000, hookTimeout: 180000, maxWorkers: 1, fileParallelism: false,
}});
