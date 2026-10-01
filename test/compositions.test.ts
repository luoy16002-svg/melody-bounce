import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { it, expect } from 'vitest';
import { adaptComposition, compositionFiles } from '../scripts/adapt-compositions.mjs';

const manifest = JSON.parse(readFileSync(new URL('./reference/provenance.json', import.meta.url), 'utf8')) as Record<string, string>;
for (const file of [...Object.keys(compositionFiles), 'mb/Shell.tsx']) it(`${file}: only declared data/audio/font/time wiring changed`, () => {
  const original = readFileSync(new URL('./reference/compositions/' + file, import.meta.url));
  expect(createHash('sha256').update(original).digest('hex')).toBe(manifest['studio/src/' + file]);
  expect(readFileSync(new URL('../src/render/compositions/' + file, import.meta.url), 'utf8')).toBe(adaptComposition(original.toString('utf8'), file));
});
