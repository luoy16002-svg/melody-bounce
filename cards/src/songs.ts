// Public-domain songs for sing-along cards. Lyrics use "/" between lines, spaces between words and "-" between
// syllables; {name} is replaced by the recipient's name. The melody lists one note per syllable as PITCH:BEATS;
// a leading "~" keeps the previous syllable (a note sung on the same syllable).

export type OccasionId = 'birthday' | 'congrats' | 'christmas';

type ChordName = 'C' | 'C7' | 'D' | 'D7' | 'E7' | 'Em' | 'F' | 'G' | 'G7' | 'A7' | 'Am' | 'B7';

type SongDef = {
  id: OccasionId;
  song: string;
  bpm: number;
  /** Beats per accompaniment pulse: 1 for 3/4, 1.5 for 6/8 (a dotted quarter). */
  pulse: number;
  lyrics: string;
  melody: string;
  /** [note index, chord]: the chord starts on that melody note. */
  chords: [number, ChordName][];
  /** Semitones added to melody and chords. */
  transpose?: number;
};

const SONGS: Record<OccasionId, SongDef> = {
  birthday: {
    id: 'birthday', song: 'Happy Birthday to You', bpm: 100, pulse: 1,
    lyrics: 'Hap-py birth-day to you / Hap-py birth-day to you / Hap-py birth-day dear {name} / Hap-py birth-day to you',
    melody: 'G4:.75 G4:.25 A4:1 G4:1 C5:1 B4:2 G4:.75 G4:.25 A4:1 G4:1 D5:1 C5:2 ' +
      'G4:.75 G4:.25 G5:1 E5:1 C5:1 B4:1 ~A4:1.5 F5:.75 F5:.25 E5:1 C5:1 D5:1 C5:3',
    chords: [[2, 'C'], [5, 'G'], [8, 'G'], [11, 'C'], [14, 'C7'], [17, 'F'], [21, 'C'], [23, 'G7'], [24, 'C']],
  },
  congrats: {
    id: 'congrats', song: "For He's a Jolly Good Fellow", bpm: 138, pulse: 1.5,
    lyrics: "For {name}'s a jol-ly good fel-low, / for {name}'s a jol-ly good fel-low, / for {name}'s a jol-ly good fel-low, / which no-bo-dy can de-ny!",
    // 6/8, written in eighth notes of half a beat.
    melody: 'D5:.5 B4:1 B4:.5 B4:.5 A4:.5 B4:.5 C5:1.5 B4:1 B4:.5 A4:1 A4:.5 A4:.5 G4:.5 A4:.5 B4:1.5 G4:1 ' +
      'A4:.5 B4:1 B4:.5 B4:.5 A4:.5 B4:.5 C5:1.5 E5:1 E5:.5 D5:.5 E5:.5 D5:.5 C5:.5 ~B4:.5 A4:.5 G4:2.5',
    chords: [[1, 'G'], [6, 'C'], [7, 'G'], [9, 'D7'], [14, 'G'], [17, 'G'], [22, 'C'], [25, 'G'], [28, 'D7'], [31, 'G']],
  },
  christmas: {
    id: 'christmas', song: 'We Wish You a Merry Christmas', bpm: 132, pulse: 1, transpose: 5,
    lyrics: 'We wish you a mer-ry Christ-mas, / we wish you a mer-ry Christ-mas, / we wish you a mer-ry Christ-mas / and a hap-py New Year!',
    melody: 'D4:1 G4:1 G4:.5 A4:.5 G4:.5 F#4:.5 E4:1 E4:1 E4:1 A4:1 A4:.5 B4:.5 A4:.5 G4:.5 F#4:1 D4:1 ' +
      'D4:1 B4:1 B4:.5 C5:.5 B4:.5 A4:.5 G4:1 E4:1 D4:.5 D4:.5 E4:1 A4:1 F#4:1 G4:3',
    chords: [[1, 'G'], [6, 'C'], [9, 'A7'], [14, 'D'], [17, 'B7'], [22, 'Em'], [26, 'C'], [28, 'D7'], [29, 'G']],
  },
};

const CHORD_TONES: Record<ChordName, number[]> = {
  C: [48, 55, 60, 64], C7: [48, 58, 60, 64], D: [50, 57, 62, 66], D7: [50, 60, 62, 66], E7: [52, 56, 62, 64],
  Em: [52, 59, 64, 67], F: [53, 57, 60, 65], G: [43, 55, 59, 62], G7: [43, 53, 59, 62], A7: [45, 55, 61, 64],
  Am: [45, 57, 60, 64], B7: [47, 54, 57, 63],
};

const PITCH = /^([A-G])(#|b)?(-?\d)$/;
function midi(pitch: string): number {
  const m = PITCH.exec(pitch);
  if (!m) throw new Error(`Bad pitch ${pitch}`);
  const base = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11}[m[1] as 'C'];
  return 12 * (Number(m[3]) + 1) + base + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

export type Syllable = {text: string; line: number; word: number; isName: boolean; joinNext: boolean};
export type TimedNote = {t: number; dur: number; midi: number; syllable: number; hop: boolean};
export type Timeline = {
  occasion: OccasionId;
  song: string;
  syllables: Syllable[];
  notes: TimedNote[];
  chords: {t: number; end: number; tones: number[]}[];
  beat: number;
  pulse: number;
  start: number;
  songEnd: number;
  end: number;
};

export const INTRO = 1.6, OUTRO = 4.6;

/** Drops control characters and the few characters that could confuse the lyric template. */
export function cleanText(raw: string, max: number): string {
  return [...raw].filter(c => c.charCodeAt(0) >= 32 && !'<>{}'.includes(c)).join('').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function cleanName(raw: string): string {
  return cleanText(raw, 24);
}

export function buildTimeline(occasion: OccasionId, rawName: string): Timeline {
  const def = SONGS[occasion];
  const name = cleanName(rawName) || 'you';
  const syllables: Syllable[] = [];
  def.lyrics.split('/').forEach((line, lineIndex) => {
    line.trim().split(/\s+/).forEach((word, wordIndex) => {
      if (word.includes('{name}')) {
        syllables.push({text: word.replace('{name}', name), line: lineIndex, word: wordIndex, isName: true, joinNext: false});
        return;
      }
      const parts = word.split('-');
      parts.forEach((part, i) => syllables.push({text: part, line: lineIndex, word: wordIndex, isName: false, joinNext: i < parts.length - 1}));
    });
  });
  const beat = 60 / def.bpm;
  const notes: TimedNote[] = [];
  let t = INTRO, syllable = -1;
  for (const token of def.melody.trim().split(/\s+/)) {
    const hop = token.startsWith('~');
    const [pitch, beats] = token.replace('~', '').split(':');
    if (!hop) syllable++;
    const dur = Number(beats) * beat;
    notes.push({t, dur, midi: midi(pitch) + (def.transpose ?? 0), syllable, hop});
    t += dur;
  }
  if (syllable !== syllables.length - 1) throw new Error(`${occasion}: ${syllable + 1} sung syllables for ${syllables.length} lyric syllables`);
  const songEnd = t;
  const chords = def.chords.map(([index, chord], i) => ({
    t: notes[index].t,
    end: i + 1 < def.chords.length ? notes[def.chords[i + 1][0]].t : songEnd,
    tones: CHORD_TONES[chord].map(tone => tone + (def.transpose ?? 0)),
  }));
  return {occasion, song: def.song, syllables, notes, chords, beat, pulse: def.pulse * beat, start: INTRO, songEnd, end: songEnd + OUTRO};
}

export const OCCASIONS: Record<OccasionId, {label: string; title: string; song: string; blurb: string}> = {
  birthday: {label: 'Birthday', title: 'Happy Birthday', song: SONGS.birthday.song, blurb: 'The birthday song, with their name in the third line.'},
  congrats: {label: 'Congratulations', title: 'Congratulations', song: SONGS.congrats.song, blurb: 'For a new job, a graduation, a retirement or any big win.'},
  christmas: {label: 'Christmas', title: 'Merry Christmas', song: SONGS.christmas.song, blurb: 'The carol everyone knows, sung to them by name.'},
};
export const OCCASION_IDS = Object.keys(OCCASIONS) as OccasionId[];
