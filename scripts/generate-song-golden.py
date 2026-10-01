"""Extract public-domain melody lists without importing or executing audio scripts."""
import ast
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def constants(filename):
    output = {}
    tree = ast.parse((ROOT / 'test/reference/audio' / filename).read_text(encoding='utf-8'))
    for node in tree.body:
        if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name):
            try:
                output[node.targets[0].id] = ast.literal_eval(node.value)
            except (ValueError, TypeError):
                pass
    return output

canon = constants('synth_grow.py')
ode = constants('synth_strings.py')
race = constants('synth_race.py')
pent = constants('synth_galton.py')['PENT']
notes = {
    'fur-elise': constants('synth.py')['FUR_ELISE'],
    'minuet-in-g': constants('synth_hexagon.py')['MINUET'],
    'mountain-king': constants('synth_multiply.py')['THEME'],
    'canon-in-d': [n for n, _ in canon['S1'] + canon['S2'] + canon['S3']],
    'ode-to-joy': ode['A1'] + ode['A2'] + ode['B'] + ode['A2'],
    'rondo-alla-turca': constants('synth_colorwar.py')['TURCA'],
    'symphony-40': race['P1'] + race['P2'] + race['P3'] + race['P4'],
    'd-pentatonic': [62 + 12 * ((b - 6) // 5) + pent[(b - 6) % 5] for b in range(13)],
}
(ROOT / 'test/golden/songs.json').write_text(json.dumps(notes, indent=2) + '\n')
