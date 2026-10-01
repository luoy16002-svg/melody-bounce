import { afterAll, beforeAll, expect, it } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { chromium, type Browser } from 'playwright-core';
import { ensureBrowser } from '@remotion/renderer';

let server: ViteDevServer, browser: Browser, url: string;
beforeAll(async () => {
  await mkdir(resolve('output/playwright'), {recursive: true});
  server = await createServer({configFile: resolve('examples/player/vite.config.ts'), server: {host: '127.0.0.1', port: 0}, logLevel: 'warn'});
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('Missing local Vite address');
  url = `http://127.0.0.1:${address.port}`;
  const status = await ensureBrowser({logLevel: 'warn'});
  if (!('path' in status)) throw new Error('Remotion browser is unavailable');
  browser = await chromium.launch({executablePath: status.path, headless: true});
});
afterAll(async () => { try { if (browser) await browser.close(); } finally { if (server) await server.close(); } });

for (const instrument of ['piano', 'synth']) it(`local Player: ${instrument}, same physics data, audio and frame playback`, async () => {
  const page = await browser.newPage({viewport: {width: 1100, height: 800}});
  const errors: string[] = [], writes: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.method()); });
  try {
    await page.goto(`${url}/?scene=hexagon&seed=14&duration=5&instrument=${instrument}&autoplay=1`);
    await page.locator('[data-ready="true"]').waitFor({timeout: 60000});
    // Read state only. Autoplay is muted; no form submissions or external writes.
    await page.waitForFunction(() => Number(document.querySelector<HTMLElement>('[data-ready]')?.dataset.frame) > 15, undefined, {timeout: 20000});
    const state = await page.locator('[data-ready]').evaluate(element => ({scene: (element as HTMLElement).dataset.scene, cues: (element as HTMLElement).dataset.cues, frame: (element as HTMLElement).dataset.frame, canvases: element.querySelectorAll('canvas').length, audio: [...document.querySelectorAll('audio')].map(a => ({src: a.currentSrc, ready: a.readyState, error: a.error?.message}))}));
    expect(state.scene).toBe('hexagon'); expect(Number(state.cues)).toBe(2); expect(Number(state.frame)).toBeGreaterThan(15); expect(state.canvases).toBe(1);
    expect(state.audio.some(a => a.src.startsWith('blob:') && a.ready >= 2 && !a.error)).toBe(true);
    expect(errors).toEqual([]); expect(writes).toEqual([]);
    await writeFile(resolve(`output/playwright/player-${instrument}.json`), JSON.stringify(state, null, 2));
    await page.screenshot({path: resolve(`output/playwright/player-${instrument}.png`), fullPage: true});
  } finally { await page.close(); }
});
