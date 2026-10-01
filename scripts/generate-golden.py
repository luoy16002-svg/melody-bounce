"""Run byte-for-byte upstream copies as scripts, with all output inside this repo."""
import hashlib
import json
import pathlib
import random
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'test' / 'golden'
SEEDS = {'escape': [1, 10], 'hexagon': [1, 14], 'galton': [1, 281],
         'grow': [1, 115], 'multiply': [1, 4], 'shrink': [1, 7],
         'strings': [1, 4], 'colorwar': [1, 166], 'race': [1, 116]}
(OUT / 'out').mkdir(parents=True, exist_ok=True)
manifest = {'python': sys.version, 'sources': {}, 'fixtures': []}
for scene, seeds in SEEDS.items():
    src = ROOT / 'test' / 'reference' / (scene + '.py')
    manifest['sources'][scene] = hashlib.sha256(src.read_bytes()).hexdigest()
    for seed in seeds:
        name = f'{scene}-{seed}'
        subprocess.run([sys.executable, '-B', str(src), str(seed), '../' + name], cwd=OUT, check=True)
        manifest['fixtures'].append({'scene': scene, 'seed': seed, 'file': name + '.json'})
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
(OUT / 'out').rmdir()
vectors = []
for seed in [0, 1, -7, 2**32 + 1, 2**53 - 1]:
    rng = random.Random(seed)
    vectors.append({'seed': seed, 'random': [rng.random() for _ in range(20)],
                    'choices': [rng.choice([-1, 1]) for _ in range(20)],
                    'uniform': [rng.uniform(-0.22, 0.22) for _ in range(20)]})
(OUT / 'random.json').write_text(json.dumps(vectors, indent=2) + '\n')
subprocess.run([sys.executable, '-B', str(ROOT / 'scripts/generate-song-golden.py')], cwd=ROOT, check=True)
