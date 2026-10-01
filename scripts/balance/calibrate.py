#!/usr/bin/env python3
"""
Prices the realm-gated resources from the economy where they unlock
(SIM_CALIBRATE=1 in scripts/sim.ts) over several seeds of the active
reference bot, and writes the median into their gated(...) prices in
src/content/generators.ts.
Usage: calibrate.py [SIM_TUNE params.json]
"""
import json, math, os, re, statistics, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
sys.path.insert(0, os.path.dirname(__file__))
SEEDS = [1, 2, 3, 4, 5, 6]
tune = open(sys.argv[1]).read() if len(sys.argv) > 1 else '{}'

def run(seed):
    env = dict(os.environ, SIM_SEED=str(seed), SIM_PLAYER='active', SIM_CALIBRATE='1', SIM_TUNE=tune)
    out = subprocess.run(['npx', 'tsx', 'scripts/sim.ts', '40'], capture_output=True, text=True, env=env, cwd=ROOT).stdout
    return json.loads(re.search(r'^CALIBRATION (.*)$', out, re.M).group(1))

with ThreadPoolExecutor(len(SEEDS)) as ex:
    runs = list(ex.map(run, SEEDS))
gm = lambda xs: 10 ** statistics.median(math.log10(x) for x in xs)
prices = {g: [gm([r[g][0] for r in runs]), gm([r[g][1] for r in runs])] for g in runs[0]}

def lit(x):
    e = math.floor(math.log10(x))
    m = round(x / 10 ** e, 1)
    if m >= 10: m, e = m / 10, e + 1
    if -3 <= e < 0:
        return f'{m * 10 ** e:.2g}'
    return f'{int(round(m * 10 ** e)):_}' if 0 <= e < 7 else f'{m:g}e{e}'

path = os.path.join(ROOT, 'src/content/generators.ts')
gens = open(path).read()
for gid, (share, qps_per_qi) in prices.items():
    block = re.compile(r"(id: '" + gid + r"',.*?gated\('\w+', )([^,]+), ([^)]+)\)", re.S)
    gens, n = block.subn(lambda m: f'{m.group(1)}{lit(share)}, {lit(qps_per_qi)})', gens, count=1)
    assert n == 1, gid
open(path, 'w').write(gens)
print({g: [lit(c), lit(q)] for g, (c, q) in prices.items()})
