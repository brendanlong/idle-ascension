#!/usr/bin/env python3
"""
Writes tuned parameters (SIM_TUNE params, as from build_costs.py) into
src/content: breakthrough costs (STAGE_COSTS in realms.ts), the resource
ladder (RESOURCE_LADDER in generators.ts) and the Memory curve (MEMORIES in
memories.ts). Everything else is priced from those.
Usage: bake.py params.json
"""
import json, math, os, re, sys

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

def lit(x):
    e = math.floor(math.log10(x))
    m = round(x / 10 ** e, 1)
    if m >= 10: m, e = m / 10, e + 1
    return f'{int(round(m * 10 ** e)):_}' if e < 7 else f'{m:g}e{e}'

if 'stageCosts' in params:
    full = os.path.join(ROOT, 'src/content/realms.ts')
    costs = ['0'] + [lit(10 ** c) for c in params['stageCosts'][1:]]
    s = open(full).read()
    s, n = re.subn(r'(STAGE_COSTS: readonly number\[\] = \[)[^\]]*(\])', lambda m: m.group(1) + ', '.join(costs) + m.group(2), s)
    assert n == 1
    open(full, 'w').write(s)
if 'ladder' in params:
    write_object('src/content/generators.ts', 'RESOURCE_LADDER', params['ladder'])
if 'memory' in params:
    write_object('src/content/memories.ts', 'MEMORIES', params['memory'])
print('baked')
