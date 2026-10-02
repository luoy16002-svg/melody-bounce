import type { Timeline } from './songs.js';

export const TITLE_Y = 300, NAME_Y = 470, LYRICS_TOP = 870, LINE_GAP = 132, FROM_Y = 1580;
export const FONT = 'Outfit, system-ui, sans-serif';
const MAX_LINE = 960;

export type Placed = {x: number; w: number; cx: number; y: number; size: number; text: string};

/** Places every syllable: words separated by spaces, syllables of a word touching. Long lines shrink to fit. */
export function layoutLyrics(ctx: CanvasRenderingContext2D, timeline: Timeline): {placed: Placed[]; lines: number} {
  const lines = Math.max(...timeline.syllables.map(s => s.line)) + 1;
  const placed: Placed[] = new Array(timeline.syllables.length);
  for (let line = 0; line < lines; line++) {
    const ids = timeline.syllables.map((s, i) => (s.line === line ? i : -1)).filter(i => i >= 0);
    let size = 80, widths: number[] = [], space = 0, total = 0;
    for (; size >= 40; size -= 2) {
      ctx.font = `800 ${size}px ${FONT}`;
      space = ctx.measureText(' ').width * 1.05;
      widths = ids.map(i => ctx.measureText(timeline.syllables[i].text).width);
      total = widths.reduce((a, b) => a + b, 0) + ids.slice(0, -1).reduce((sum, id) => sum + (timeline.syllables[id].joinNext ? 0 : space), 0);
      if (total <= MAX_LINE) break;
    }
    let x = 540 - total / 2;
    const y = LYRICS_TOP + line * LINE_GAP;
    ids.forEach((id, k) => {
      const s = timeline.syllables[id];
      placed[id] = {x, w: widths[k], cx: x + widths[k] / 2, y, size, text: s.text};
      x += widths[k] + (s.joinNext ? 0 : space);
    });
  }
  return {placed, lines};
}
