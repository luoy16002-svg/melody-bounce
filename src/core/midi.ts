import { readFile } from 'node:fs/promises';
import MidiPackage from '@tonejs/midi';
const { Midi } = MidiPackage;

/** Track is zero-based in @tonejs/midi's parsed, channel-separated track list. */
export function parseMidi(bytes: Uint8Array, track?: number): number[] {
  if (bytes.length < 14 || Buffer.from(bytes.subarray(0, 4)).toString('ascii') !== 'MThd') throw new Error('Invalid MIDI file: missing MThd header');
  let midi: InstanceType<typeof Midi>;
  try { midi = new Midi(bytes); } catch (error) { throw new Error(`Invalid MIDI file: ${String(error)}`); }
  if (track !== undefined && (!Number.isInteger(track) || track < 0 || track >= midi.tracks.length)) throw new Error(`MIDI track must be between 0 and ${midi.tracks.length - 1}`);
  const selected = track === undefined
    ? midi.tracks.filter(t => !t.instrument.percussion && t.notes.length).sort((a, b) => b.notes.length - a.notes.length)[0]
    : midi.tracks[track];
  if (!selected) throw new Error('MIDI file contains no non-drum melody track');
  if (selected.instrument.percussion) throw new Error('Selected MIDI track is a drum track');
  if (!selected.notes.length) throw new Error('Selected MIDI track has no notes');
  const notes = [...selected.notes].sort((a, b) => a.ticks - b.ticks || b.midi - a.midi);
  const melody: number[] = [];
  // At each onset, take the highest starting pitch unless a higher note is still held.
  // Repeated notes remain separate; accompaniment under a sustained treble is skipped.
  let active: typeof notes = [];
  for (let i = 0; i < notes.length;) {
    const start = i, tick = notes[i].ticks;
    while (i < notes.length && notes[i].ticks === tick) i++;
    active = active.filter(n => n.ticks + n.durationTicks > tick);
    const top = notes[start];
    if (!active.some(n => n.midi > top.midi)) melody.push(top.midi);
    active.push(...notes.slice(start, i));
  }
  if (!melody.length) throw new Error('Selected MIDI track has no melody notes');
  return melody;
}
export async function readMidi(file: string, track?: number): Promise<number[]> {
  let bytes: Buffer;
  try { bytes = await readFile(file); } catch (error) { throw new Error(`Cannot read MIDI file ${file}: ${(error as Error).message}`); }
  return parseMidi(bytes, track);
}
