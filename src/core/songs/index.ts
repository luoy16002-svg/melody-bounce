import type { SceneName } from '../index.js';

// Note lists transcribed verbatim from the channel's synth*.py files.
// The works are public domain; these are the channel's short melody excerpts.
export const songs = {
  'fur-elise': { title: 'Für Elise', composer: 'Ludwig van Beethoven', notes: [76,75,76,75,76,71,74,72,69,60,64,69,71,64,68,71,72,64,76,75,76,75,76,71,74,72,69,60,64,69,71,64,72,71,69] },
  'minuet-in-g': { title: 'Minuet in G', composer: 'Christian Petzold', notes: [74,67,69,71,72,74,67,67,76,72,74,76,78,79,67,67,72,74,72,71,69,71,72,71,69,67,66,67,69,71,67,69,74,67,69,71,72,74,67,67,76,72,74,76,78,79,67,67,72,74,72,71,69,71,72,71,69,67,69,71,69,67,66,67] },
  'mountain-king': { title: 'In the Hall of the Mountain King', composer: 'Edvard Grieg', notes: [59,61,62,64,66,62,66,65,61,65,64,60,64,59,61,62,64,66,62,66,71,69,66,62,66,69] },
  'canon-in-d': { title: 'Canon in D', composer: 'Johann Pachelbel', notes: [78,76,74,73,71,69,71,73,74,73,71,69,67,66,67,64,74,78,81,79,78,74,78,76,74,71,74,81,79,83,81,79] },
  'ode-to-joy': { title: 'Ode to Joy', composer: 'Ludwig van Beethoven', notes: [66,66,67,69,69,67,66,64,62,62,64,66,66,64,64,66,66,67,69,69,67,66,64,62,62,64,66,64,62,62,64,64,66,62,64,66,67,66,62,64,66,67,66,64,62,64,57,66,66,67,69,69,67,66,64,62,62,64,66,64,62,62] },
  'rondo-alla-turca': { title: 'Rondo alla Turca', composer: 'Wolfgang Amadeus Mozart', notes: [71,69,68,69,72,74,72,71,72,76,77,76,75,76,83,81,80,81,83,81,80,81,84,81,84] },
  'symphony-40': { title: 'Symphony No. 40', composer: 'Wolfgang Amadeus Mozart', notes: [75,74,74,75,74,74,75,74,74,82,82,81,79,79,77,75,75,74,72,72,74,72,72,74,72,72,74,72,72,81,81,79,78,78,75,74,74,72,70,70] },
  'd-pentatonic': { title: 'D major pentatonic', composer: 'Traditional scale', notes: [47,50,52,54,57,59,62,64,66,69,71,74,76] },
} satisfies Record<string, {title: string; composer: string; notes: number[]}>;
export type SongName = keyof typeof songs;
export const defaultSongs: Record<SceneName, SongName> = {
  rings: 'fur-elise', hexagon: 'minuet-in-g', galton: 'd-pentatonic', grow: 'canon-in-d',
  multiply: 'mountain-king', shrink: 'mountain-king', strings: 'ode-to-joy', colorwar: 'rondo-alla-turca', race: 'symphony-40',
};
