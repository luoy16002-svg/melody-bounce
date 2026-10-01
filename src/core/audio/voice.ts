export type Voice =
  | {kind: 'piano'; note: number; duration: number; gain: number}
  | {kind: 'bell'; frequency: number; duration: number; gain: number}
  | {kind: 'pluck'; frequency: number; duration: number; gain: number; bright: number; seed: number}
  | {kind: 'shimmer' | 'swoosh'; duration: number; gain: number; seed: number}
  | {kind: 'clack'; duration: number; gain: number; seed: number}
  | {kind: 'woodblock'; duration: number; gain: number}
  | {kind: 'click'; frequency: number; duration: number; gain: number}
  | {kind: 'pad'; notes: number[]; duration: number; gain: number}
  | {kind: 'grow-pad'; notes: number[]; duration: number; gain: number; samples: number; detune: number}
  | {kind: 'riser'; notes: [number, number][]; duration: number; gain: number; samples: number; tremStart: number; tremDelta: number; envelope: 'time' | 'linspace'}
  | {kind: 'noise-rise'; duration: number; samples: number; gain: number; seed: number; power: number; envelope: 'time' | 'linspace'}
  | {kind: 'noise-decay'; duration: number; gain: number; seed: number; decay: number}
  | {kind: 'boom'; duration: number; gain: number; startHz: number; fallHz: number; decay: number};

export type ScoreCue = {
  t: number;
  pan: number;
  voice: Voice;
  role: 'melody' | 'bass' | 'accent' | 'peg' | 'effect';
  collisionTime?: number;
};
export type Score = {
  cues: ScoreCue[];
  audioDuration: number;
  reverb: {seconds: number; wet: number};
  fade: {seconds: number; power: number};
  peak: number;
};
export type InstrumentName = 'piano' | 'synth';
export const SAMPLE_RATE = 48000;
export const hz = (m: number): number => 440 * 2 ** ((m - 69) / 12);
