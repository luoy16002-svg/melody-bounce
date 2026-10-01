import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { scenes, type SceneName } from '../src/core/index.js';
type Json = null | boolean | string | number | Json[] | {[key: string]: Json};
const manifest = JSON.parse(readFileSync(new URL('./golden/manifest.json', import.meta.url), 'utf8')) as { fixtures: {scene: string; seed: number; file: string}[] };

function compare(actual: Json, expected: Json, path = ''): void {
  if (typeof expected === 'number') {
    expect(typeof actual, path).toBe('number');
    const tolerance = path.includes('.frames') || /\.(x|y|ax|ay|nx|ny)$/.test(path) ? 1e-7 : 1e-9;
    expect(Math.abs((actual as number) - expected), path).toBeLessThanOrEqual(tolerance);
  } else if (Array.isArray(expected)) {
    expect(Array.isArray(actual), path).toBe(true);
    expect((actual as Json[]).length, path + '.length').toBe(expected.length);
    expected.forEach((v, i) => compare((actual as Json[])[i], v, `${path}[${i}]`));
  } else if (expected !== null && typeof expected === 'object') {
    expect(Object.keys(actual as object).sort(), path).toEqual(Object.keys(expected).sort());
    for (const [key, value] of Object.entries(expected)) compare((actual as {[key: string]: Json})[key], value, path + '.' + key);
  } else expect(actual, path).toEqual(expected);
}

describe('complete Python reference runs', () => {
  for (const fixture of manifest.fixtures) it(`${fixture.scene}, seed ${fixture.seed}`, () => {
    const scene = (fixture.scene === 'escape' ? 'rings' : fixture.scene) as SceneName;
    const actual = scenes[scene](fixture.seed);
    const expected = JSON.parse(readFileSync(new URL('./golden/' + fixture.file, import.meta.url), 'utf8')) as Json;
    compare(actual, expected);
    // Event timestamps use strict comparison above; explicitly lock event frames too.
    for (const key of ['hits', 'bounces', 'breaks', 'escapes', 'clashes', 'clacks', 'near']) {
      if (key in actual) {
        const events = (actual as unknown as Record<string, {t: number}[]>)[key];
        const reference = (expected as unknown as Record<string, {t: number}[]>)[key];
        expect(events.map(e => Math.floor(e.t * 60))).toEqual(reference.map(e => Math.floor(e.t * 60)));
      }
    }
  });
});
