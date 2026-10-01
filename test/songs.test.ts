import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { songs } from '../src/core/songs/index.js';
it('preserves every note in the channel melodies and Galton bin scale', () => {
  const expected = JSON.parse(readFileSync(new URL('./golden/songs.json', import.meta.url), 'utf8'));
  expect(Object.fromEntries(Object.entries(songs).map(([id, song]) => [id, song.notes]))).toEqual(expected);
});
