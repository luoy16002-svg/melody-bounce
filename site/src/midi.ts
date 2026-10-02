import { Midi } from '@tonejs/midi';

export type MidiTrack = {index: number; label: string; notes: number};
export type MidiSong = {title: string; notes: number[]; tracks: MidiTrack[]; track: number};

/** Browser twin of src/core/midi.ts parseMidi: same track choice and the same top-voice melody. */
export function readMidi(bytes: Uint8Array, fileName: string, track?: number): MidiSong {
  if (bytes.length < 14 || String.fromCharCode(...bytes.subarray(0, 4)) !== 'MThd') throw new Error('That file is not a MIDI file.');
  let midi: Midi;
  try { midi = new Midi(bytes); } catch { throw new Error('This MIDI file could not be read.'); }
  const tracks: MidiTrack[] = midi.tracks.flatMap((t, index) => !t.instrument.percussion && t.notes.length
    ? [{index, notes: t.notes.length, label: t.name.trim() || t.instrument.name || `Track ${index + 1}`}] : []);
  if (!tracks.length) throw new Error('This MIDI file has no melody track (only drums or no notes).');
  const chosen = track !== undefined && tracks.some(t => t.index === track) ? track : [...tracks].sort((a, b) => b.notes - a.notes)[0].index;
  const notes = [...midi.tracks[chosen].notes].sort((a, b) => a.ticks - b.ticks || b.midi - a.midi);
  const melody: number[] = [];
  // At each onset, take the highest starting pitch unless a higher note is still held.
  let active: typeof notes = [];
  for (let i = 0; i < notes.length;) {
    const start = i, tick = notes[i].ticks;
    while (i < notes.length && notes[i].ticks === tick) i++;
    active = active.filter(n => n.ticks + n.durationTicks > tick);
    const top = notes[start];
    if (!active.some(n => n.midi > top.midi)) melody.push(top.midi);
    active.push(...notes.slice(start, i));
  }
  if (!melody.length) throw new Error('No melody notes found in that track.');
  const title = midi.header.name?.trim() || fileName.replace(/\.(mid|midi)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Your song';
  return {title: title.slice(0, 60), notes: melody, tracks, track: chosen};
}
