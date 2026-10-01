"""Run the original audio control flow with tagged, silent DSP calls.

The copied synth files are never edited. sys.settrace records their actual add()
calls; replacing expensive voices/reverb does not alter selection/rate limits.
NumPy/soundfile are required only for regeneration, never by the TS runtime/CI.
"""
import ast
import contextlib
import hashlib
import importlib
import io
import json
from pathlib import Path
import sys

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / 'test/reference/audio'
OUT = ROOT / 'test/golden/audio'
OUT.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(AUDIO))
FILES = {'escape': 'synth', 'hexagon': 'synth_hexagon', 'galton': 'synth_galton',
         'grow': 'synth_grow', 'multiply': 'synth_multiply', 'shrink': 'synth_shrink',
         'strings': 'synth_strings', 'colorwar': 'synth_colorwar', 'race': 'synth_race'}
MODULES = {key: importlib.import_module(value) for key, value in FILES.items()}


class Tagged(np.ndarray):
    def __new__(cls, voice):
        obj = np.empty(0).view(cls)
        obj.voice = voice
        return obj


def tag(kind, duration, gain, **kwargs):
    return Tagged({'kind': kind, 'duration': float(duration), 'gain': float(gain), **kwargs})


WRAPPERS = {
    'piano': lambda m, dur=1.6, vel=1.0: tag('piano', dur, vel, note=int(m)),
    'bell': lambda f, dur=1.2, amp=0.1: tag('bell', dur, amp, frequency=float(f)),
    'pluck': lambda f, dur, amp, bright=0.6, seed=0: tag('pluck', dur, amp, frequency=float(f), bright=float(bright), seed=int(seed)),
    'shimmer': lambda dur=0.5, amp=0.05, seed=0: tag('shimmer', dur, amp, seed=int(seed)),
    'clack': lambda amp=0.12, seed=0: tag('clack', 0.06, amp, seed=int(seed)),
    'swoosh': lambda dur=0.5, amp=0.05, seed=1: tag('swoosh', dur, amp, seed=int(seed)),
    'woodblock': lambda amp=0.12: tag('woodblock', 0.08, amp),
    'click': lambda freq, amp: tag('click', 0.02, amp, frequency=float(freq)),
}


def primary_lines(path, scene):
    tree = ast.parse(path.read_text(encoding='utf-8'))
    main = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'main')
    target = 'events' if scene == 'escape' else "d['balls']" if scene == 'galton' else "d['hits']" if scene in ('race', 'multiply') else "d['bounces']"
    lines = set()
    for loop in ast.walk(main):
        if not isinstance(loop, ast.For) or target not in ast.unparse(loop.iter):
            continue
        for node in ast.walk(loop):
            if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Name) or node.func.id != 'add':
                continue
            call = node.args[0]
            if not isinstance(call, ast.Call) or not isinstance(call.func, ast.Name) or call.func.id not in ('piano', 'pluck'):
                continue
            pitch = call.args[0]
            if isinstance(pitch, ast.Call) and isinstance(pitch.func, ast.Name) and pitch.func.id == 'hz':
                pitch = pitch.args[0]
            if isinstance(pitch, ast.Name) and pitch.id == 'm':
                lines.update(range(node.lineno, node.end_lineno + 1))
    if not lines:
        raise RuntimeError('No primary melody sites: ' + scene)
    return lines


manifest = {'numpy': np.__version__, 'sources': {}, 'fixtures': []}
physics = json.loads((ROOT / 'test/golden/manifest.json').read_text())
original_write = sf.write
sf.write = lambda *args, **kwargs: None
try:
    for fixture in physics['fixtures']:
        scene, seed = fixture['scene'], fixture['seed']
        module = MODULES[scene]
        source = AUDIO / (FILES[scene] + '.py')
        manifest['sources'][source.name] = hashlib.sha256(source.read_bytes()).hexdigest()
        selected = primary_lines(source, scene)
        recorded, melody = [], []
        saved = {key: getattr(module, key) for key in [*WRAPPERS, 'reverb'] if hasattr(module, key)}
        for key, wrapper in WRAPPERS.items():
            if key in saved:
                setattr(module, key, wrapper)
        module.reverb = lambda x, *args, **kwargs: x

        def trace(frame, event, arg):
            if event == 'call' and frame.f_code.co_name == 'add' and frame.f_globals is module.__dict__:
                sig = frame.f_locals['sig']
                if isinstance(sig, Tagged):
                    cue = {'t': float(frame.f_locals['t']), 'pan': float(frame.f_locals.get('pan', 0)), 'voice': sig.voice}
                    recorded.append(cue)
                    if frame.f_back.f_lineno in selected:
                        melody.append(cue)
            return None

        try:
            sys.settrace(trace)
            with contextlib.redirect_stdout(io.StringIO()), np.errstate(all='ignore'):
                module.main(str(ROOT / 'test/golden' / fixture['file']), str(OUT / 'unused.wav'))
        finally:
            sys.settrace(None)
            for key, value in saved.items():
                setattr(module, key, value)
        filename = f'{scene}-{seed}.json'
        (OUT / filename).write_text(json.dumps({'melody': melody, 'voices': recorded}, separators=(',', ':')) + '\n')
        manifest['fixtures'].append({'scene': scene, 'seed': seed, 'file': filename})
        print(filename, len(melody), 'selected notes,', len(recorded), 'tagged voices')
finally:
    sf.write = original_write
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')

# Waveform probes run the real, unmodified DSP functions, including reverb.
base = MODULES['escape']
probes = []
for voice in [
    {'kind': 'piano', 'note': 69, 'duration': 0.02, 'gain': 0.7},
    {'kind': 'piano', 'note': 76, 'duration': 0.04, 'gain': 0.9},
    {'kind': 'bell', 'frequency': base.hz(88), 'duration': 0.025, 'gain': 0.06},
    {'kind': 'pluck', 'frequency': base.hz(62), 'duration': 0.04, 'gain': 0.26, 'bright': 0.7, 'seed': 21},
    {'kind': 'shimmer', 'duration': 0.025, 'gain': 0.03, 'seed': 7},
    {'kind': 'clack', 'duration': 0.06, 'gain': 0.09, 'seed': 5321},
    {'kind': 'swoosh', 'duration': 0.04, 'gain': 0.05, 'seed': 521},
    {'kind': 'woodblock', 'duration': 0.08, 'gain': 0.12},
    {'kind': 'click', 'frequency': 2670, 'duration': 0.02, 'gain': 0.02},
]:
    kind = voice['kind']
    if kind == 'piano':
        samples = base.piano(voice['note'], voice['duration'], voice['gain'])
    elif kind == 'bell':
        samples = base.bell(voice['frequency'], voice['duration'], voice['gain'])
    elif kind == 'pluck':
        samples = MODULES['strings'].pluck(voice['frequency'], voice['duration'], voice['gain'], voice['bright'], voice['seed'])
    elif kind == 'shimmer':
        samples = base.shimmer(voice['duration'], voice['gain'], voice['seed'])
    elif kind == 'clack':
        samples = MODULES['race'].clack(voice['gain'], voice['seed'])
    elif kind == 'swoosh':
        samples = MODULES['race'].swoosh(voice['duration'], voice['gain'], voice['seed'])
    elif kind == 'woodblock':
        samples = MODULES['colorwar'].woodblock(voice['gain'])
    else:
        samples = MODULES['galton'].click(voice['frequency'], voice['gain'])
    probes.append({'voice': voice, 'samples': samples.tolist()})
dry = base.piano(69, 0.02, 0.7)
(OUT / 'waveforms.json').write_text(json.dumps({'probes': probes, 'reverb': base.reverb(dry, secs=0.03, wet=0.22, seed=7).tolist()}, separators=(',', ':')) + '\n')

vectors = []
for seed in [0, 69, 116, 2**32 + 1]:
    rng = np.random.default_rng(seed)
    vectors.append({'seed': seed, 'state': [str(int(x)) for x in np.random.SeedSequence(seed).generate_state(4, dtype=np.uint64)],
                    'random': rng.random(32).tolist(), 'normal': rng.normal(0, 1, 4096).tolist(),
                    'choices': [int(rng.choice([86, 88, 90, 93, 95, 98])) for _ in range(32)]})
(ROOT / 'test/golden/numpy-random.json').write_text(json.dumps(vectors, separators=(',', ':')) + '\n')
