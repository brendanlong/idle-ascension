#!/usr/bin/env python3
"""
Writes tuned parameters (SIM_TUNE params, as from tune_curve.py) into
src/content: the breakthrough cost curve (COST_CURVE in realms.ts), the
resource ladder (RESOURCE_LADDER in generators.ts) and the Memory curve
(MEMORIES in memories.ts). Everything else is priced from those.
Usage: bake.py params.json
"""
import json, os, re, sys

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
params = json.load(open(sys.argv[1]))

def num(x):
    return f'{float(f"{x:.3g}"):g}'

def write_object(path, name, values):
    full = os.path.join(ROOT, path)
    s = open(full).read()
    for key, value in values.items():
        pattern = re.compile(r'(' + name + r'[^=]*= \{[^}]*?\b' + key + r': )([^,\n}]+)', re.S)
        s, n = pattern.subn(lambda m: m.group(1) + num(value), s, count=1)
        assert n == 1, (name, key)
    open(full, 'w').write(s)

if 'curve' in params:
    write_object('src/content/realms.ts', 'COST_CURVE', params['curve'])
if 'ladder' in params:
    write_object('src/content/generators.ts', 'RESOURCE_LADDER', params['ladder'])
if 'memory' in params:
    write_object('src/content/memories.ts', 'MEMORIES', params['memory'])
print('baked')
