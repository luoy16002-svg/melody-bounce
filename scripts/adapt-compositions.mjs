import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

export const compositionFiles = {
  'Escape.tsx': ['Escape', 'rings', 'Für Elise'],
  'Multiply.tsx': ['Multiply', 'multiply', 'In the Hall of the Mountain King'],
  'Grow.tsx': ['Grow', 'grow', 'Canon in D'],
  'Strings.tsx': ['Strings', 'strings', 'Ode to Joy'],
  'Race.tsx': ['Race', 'race', 'Mozart’s Symphony No. 40'],
  'mb/Hexagon.tsx': ['Hexagon', 'hexagon', 'Minuet in G'],
  'mb/Galton.tsx': ['Galton', 'galton', null],
  'mb/Shrink.tsx': ['Shrink', 'shrink', 'In the Hall of the Mountain King'],
  'mb/ColorWar.tsx': ['ColorWar', 'colorwar', 'Rondo alla Turca'],
};

// This adapter changes data/audio/font sources and maps output time to the 60 Hz
// reference timeline. Canvas drawing, styles, hooks, counters, and copy are retained.
export function adaptComposition(source, file) {
  const mb = file.startsWith('mb/');
  const parent = mb ? '../../' : '../';
  let text = source.replace(/\r\n/g, '\n');
  text = text.replace("from '@remotion/google-fonts/Outfit'", `from '${parent}font.js'`);
  text = text.replace(/, staticFile/g, '').replace(/staticFile, /g, '');
  text = text.replace("from './Shell'", "from './Shell.js'");
  text = text.replace('const frame = useCurrentFrame();\n  const { fps } = useVideoConfig();\n  const t = frame / fps;',
    'const outputFrame = useCurrentFrame();\n  const { fps } = useVideoConfig();\n  const t = outputFrame / fps;\n  const frame = Math.floor(t * 60 + 1e-8);');
  if (file === 'mb/Shell.tsx') {
    return text.replace('audio: string;', 'audio?: string;').replace('<Audio src={staticFile(audio)} />', '{audio && <Audio src={audio} />}');
  }
  const [name, scene, song] = compositionFiles[file];
  text = text.replace(/^import sim from .*;\n/m, '');
  text = text.replace(/<Audio src=\{staticFile\('[^']+'\)\} \/>/g, '{audioSrc && <Audio src={audioSrc} />}');
  text = text.replace(/audio="[^"]+\.wav"/, 'audio={audioSrc}');
  if (song) {
    if (mb) {
      text = text.replace(/credit="([^"]*)"/, (_, credit) => {
        const prefix = credit.slice(0, credit.indexOf(song));
        return `credit={${JSON.stringify(prefix)} + (musicTitle ?? ${JSON.stringify(song)})}`;
      });
    } else text = text.replace(song, `{musicTitle ?? ${JSON.stringify(song)}}`);
  }
  // Upstream assumes a climax was reached. Keep its end card beyond the clip if
  // a new seed reaches the Python time limit without a win/escape/fill.
  text = text.replace('const TW = S.winAt;', 'const TW = S.winAt ?? S.frames.length / 60 + 3600;');
  text = text.replace('const TF = S.fillAt;', 'const TF = S.fillAt ?? S.frames.length / 60 + 3600;');
  text = text.replace('const TB = S.breakAt;', 'const TB = S.breakAt ?? S.frames.length / 60 + 3600;');
  text = text.replace('const END = S.escapes[S.escapes.length - 1].t;', 'const END = S.escapes.length === S.spawned ? S.escapes[S.escapes.length - 1].t : S.duration + 3600;');
  if (name === 'Hexagon') text = text.replace(/S\.escaped/g, '(S.escaped ?? S.frames.length / 60 + 3600)');
  text = text.replace('S.squeezed;', '(S.squeezed ?? S.frames.length / 60 + 3600);');
  text = text.replace('S.squeezed + 3.6', '(S.squeezed ?? S.frames.length / 60 + 3600) + 3.6');
  const bodyStart = text.indexOf('\ntype ') + 1;
  if (bodyStart === 0) throw new Error(`Missing data boundary: ${file}`);
  const imports = text.slice(0, bodyStart) + `import type { CompositionProps } from '${parent}types.js';\n\n`;
  const body = text.slice(bodyStart).replace(/export const /g, 'const ');
  const factory = `function create${name}(sim: unknown, audioSrc?: string, ${song ? 'musicTitle' : '_musicTitle'}?: string) {\n${body.split('\n').map(line => line ? '  ' + line : '').join('\n')}\n  return ${name};\n}\n\n`;
  return imports + factory + `export const ${name}: React.FC<CompositionProps<'${scene}'>> = ({ data, audioSrc, musicTitle }) => {\n  const View = React.useMemo(() => create${name}(data, audioSrc, musicTitle), [data, audioSrc, musicTitle]);\n  return <View />;\n};\n`;
}

if (process.argv.includes('--write')) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  for (const file of [...Object.keys(compositionFiles), 'mb/Shell.tsx']) {
    const source = readFileSync(resolve(root, 'test/reference/compositions', file), 'utf8');
    const target = resolve(root, 'src/render/compositions', file);
    mkdirSync(dirname(target), {recursive: true});
    writeFileSync(target, adaptComposition(source, file));
  }
}
