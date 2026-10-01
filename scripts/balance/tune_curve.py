#!/usr/bin/env python3
"""
Fits the breakthrough cost curve and the Memory weight to the sawtooth in the
balance spec (docs/balance-spec.md): the active reference player's stage
times should be floor x growth ^ (stages past its deepest regression).

Tunes SIM_TUNE's "stageCosts" (log10 of each breakthrough's cost) and
"memory.weight". Each round, every stage's cost moves by how far its time is
off target (a stage takes about as long as its cost ÷ income, so twice as long
needs twice the cost), and the weight by how far the stage right after each
regression is: slower than the floor means regressing doesn't reset far
enough. Keeps every round in params.json.history; pick the best one, since
regressions make the fit noisy.

Usage: tune_curve.py iterations params.json (starts from the game's costs if
params.json has none). Write the result into src/content with
SIM_DUMP_PRICES=1 and bake.py, and copy memory.weight into
src/content/memories.ts.
"""
import json, math, os, statistics, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(__file__))
from spec import SPEC, run, sawtooth_ratios

DAMPING = float(os.environ.get('DAMPING', 0.5))
# Each stage costs at least this many decades more than the one before.
MIN_STEP = 0.05

def game_stage_costs():
    out = subprocess.run(['npx', 'tsx', 'scripts/sim.ts'], capture_output=True, text=True,
                         env=dict(os.environ, SIM_DUMP_PRICES='1')).stdout
    return [math.log10(max(c, 1)) for c in json.loads(out)['stage']]

def main():
    iterations, path = int(sys.argv[1]), sys.argv[2]
    params = json.load(open(path))
    params.setdefault('memory', {}).setdefault('weight', 2.3)
    params.setdefault('stageCosts', game_stage_costs())
    history_path = path + '.history'
    history = json.load(open(history_path)) if os.path.exists(history_path) else []
    seeds = SPEC['seeds']
    for it in range(iterations):
        tune = json.dumps(params)
        with ThreadPoolExecutor(len(seeds)) as ex:
            runs = list(ex.map(lambda s: run(('active', 'random', 'efficient', s), tune), seeds))
        n = max(len(r['stageReached']) for r in runs) - 1
        errs, after = {}, []
        for r in runs:
            for k, (ratio, reach) in sawtooth_ratios(r, n).items():
                errs.setdefault(k, []).append(math.log2(max(ratio, 1e-3)))
                if reach and k == reach + 1:
                    after.append(math.log2(max(ratio, 1e-3)))
        stage_err = {k: statistics.median(v) for k, v in errs.items()}
        err = statistics.median(abs(e) for e in stage_err.values())
        history.append({'err': err, 'hours': statistics.median(r['seconds'] for r in runs) / 3600,
                        'regressions': [len(r['regressions']) for r in runs],
                        'params': json.loads(json.dumps(params))})
        json.dump(history, open(history_path, 'w'))
        print(f"#{it} |log2 err| {err:.2f}  {history[-1]['hours']:.2f}h  regressions {history[-1]['regressions']}"
              f"  weight {params['memory']['weight']:.3g}  after regression x{2 ** statistics.median(after or [0]):.2f}"
              f"  | " + ' '.join(f'{k}:{2 ** e:.1f}' for k, e in sorted(stage_err.items())), flush=True)

        costs = params['stageCosts']
        for k, e in stage_err.items():
            if k >= 2:
                costs[k] -= max(-1, min(1, DAMPING * math.log10(2) * e))
        for k in range(2, len(costs)):
            costs[k] = max(costs[k], costs[k - 1] + MIN_STEP)
        if after:
            params['memory']['weight'] *= 2 ** (DAMPING * statistics.median(after))
        json.dump(params, open(path, 'w'), indent=1)

main()
