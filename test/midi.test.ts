import { describe, it, expect } from 'vitest';
import MidiPackage from '@tonejs/midi';
import { parseMidi } from '../src/core/midi.js';
const { Midi } = MidiPackage;

describe('MIDI melody extraction', () => {
  it('chooses the busiest non-drum track and highest simultaneous voice', () => {
    const midi = new Midi();
    const drums = midi.addTrack(); drums.channel = 9;
    for (let i = 0; i < 20; i++) drums.addNote({ midi: 36, ticks: i * 120, durationTicks: 60 });
    midi.addTrack().addNote({ midi: 90, ticks: 0, durationTicks: 120 });
    const melody = midi.addTrack();
    for (const tick of [0, 480, 960]) for (const pitch of [48, 60, 76]) melody.addNote({ midi: pitch, ticks: tick, durationTicks: 240 });
    expect(parseMidi(midi.toArray())).toEqual([76, 76, 76]);
    expect(parseMidi(midi.toArray(), 1)).toEqual([90]);
    expect(() => parseMidi(midi.toArray(), 0)).toThrow('drum');
    expect(() => parseMidi(midi.toArray(), 3)).toThrow('track');
  });
  it('skips accompaniment beneath sustained treble and preserves repeated notes', () => {
    const midi = new Midi(), track = midi.addTrack();
    track.addNote({ midi: 76, ticks: 0, durationTicks: 960 });
    track.addNote({ midi: 48, ticks: 240, durationTicks: 120 });
    track.addNote({ midi: 60, ticks: 480, durationTicks: 120 });
    track.addNote({ midi: 76, ticks: 960, durationTicks: 240 });
    track.addNote({ midi: 72, ticks: 1200, durationTicks: 240 });
    expect(parseMidi(midi.toArray())).toEqual([76, 76, 72]);
  });
  it('rejects corrupt MIDI and files with no melody', () => {
    expect(() => parseMidi(Buffer.from('not midi'))).toThrow('Invalid MIDI');
    expect(() => parseMidi(new Midi().toArray())).toThrow('no non-drum');
    const midi = new Midi(); midi.addTrack().channel = 9;
    midi.tracks[0].addNote({ midi: 36, ticks: 0, durationTicks: 120 });
    expect(() => parseMidi(midi.toArray())).toThrow('no non-drum');
    expect(() => parseMidi(midi.toArray(), -1)).toThrow('track');
  });
});
