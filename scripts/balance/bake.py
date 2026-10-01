#!/usr/bin/env python3
"""Writes tuned prices (SIM_TUNE params) back into src/content, rounded to 2 significant figures."""
import json, math, os, re, subprocess, sys

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
prices = json.load(open(sys.argv[1]))  # from SIM_DUMP_PRICES=1 with the tuned SIM_TUNE

def lit(x):
    if x == 0: return '0'
    if x < 1: return f'{float(f"{x:.2g}"):g}'
    e = math.floor(math.log10(x))
    m = round(x / 10 ** e, 1)
    if m >= 10: m, e = m / 10, e + 1
    if e < 7:
        v = int(round(m * 10 ** e))
        return f'{v:_}'
    ms = f'{m:g}'
    return f'{ms}e{e}'

def path(p): return os.path.join(ROOT, p)
def read(p): return open(path(p)).read()
def write(p, s): open(path(p), 'w').write(s)

# Stage costs, grouped by realm in order.
realms = read('src/content/realms.ts')
stage_iter = iter(prices['stage'])
def stage_block(m):
    names = m.group(0)
    count = 1 if "stageNames: ['']" in names else (9 if 'LAYERS' in names else 4)
    costs = [lit(next(stage_iter)) for _ in range(count)]
    return re.sub(r'stageCosts: \[[^\]]*\]', f"stageCosts: [{', '.join(costs)}]", names)
realms = re.sub(r"stageNames: [^\n]*\n\s*stageCosts: \[[^\]]*\]", stage_block, realms)
write('src/content/realms.ts', realms)

# Technique prices.
ups = read('src/content/upgrades.ts')
gens = read('src/content/generators.ts')
gen_ids = set(re.findall(r"^    id: '(\w+)',", gens, re.M))
for uid, cost in prices['up'].items():
    if re.match(r'^(\w+)-[15]$', uid) and uid[:-2] in gen_ids:
        continue  # resource and revival techniques are priced from the resource's own cost
    pat = re.compile(r"(id: '" + re.escape(uid) + r"',.*?cost: )([^,\n]+)(,)", re.S)
    ups, n = pat.subn(lambda mm: mm.group(1) + lit(cost) + mm.group(3), ups, count=1)
    assert n == 1, uid
write('src/content/upgrades.ts', ups)
for gid, (cost, qps) in prices['gen'].items():
    block = re.compile(r"(id: '" + gid + r"',.*?baseCost: )([^,\n]+)(,\s*baseQps: )([^,\n]+)(,)", re.S)
    gens, n = block.subn(lambda mm: mm.group(1) + lit(cost) + mm.group(3) + lit(qps) + mm.group(5), gens, count=1)
    assert n == 1, gid
write('src/content/generators.ts', gens)

# Core prices come from realm breakthroughs (engine/cores.ts), so there's nothing to write.
print('baked')
