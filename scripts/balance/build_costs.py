#!/usr/bin/env python3
"""
Builds base breakthrough costs (see "Breakthrough costs are built in layers"
in docs/balance-spec.md): plays the reference player with resources and
techniques alone (no cores, no regressions, SIM_LAYER=base pricing) and prices
each stage so it takes the spec's ramp time. The game multiplies these by
the cores and Memories curves (content/progress.ts), which follow from their
schedules, so they need no playing.

Each round plays the spec's seeds with the current costs, moves every stage's
cost by how far its time is off target (a stage takes about cost ÷ income,
so twice as long needs twice the cost), and fits BASE_COST_CURVE (a cubic in
log cost) to those costs so it's smooth and doesn't follow one bot's quirks.
The resource ladder isn't fit: it follows from the stage schedule (see
RESOURCE_LADDER in src/content/generators.ts). Every round is kept in
params.json.history.

Usage: build_costs.py rounds params.json (starts from the game's content if
params.json doesn't exist). Write the result into src/content with
bake.py params.json.
"""
import json, math, os, statistics, sys
from concurrent.futures import ThreadPoolExecutor
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from spec import SPEC, game_content, ramp, run

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
DAMPING = float(os.environ.get('DAMPING', 0.7))
# Runs stop here; stages not reached get the last reached stage's correction.
RUN_HOURS = 6

STAGES = 35

def curve(coefficients, k):
    return sum(c * k ** power for power, c in enumerate(coefficients))

def main():
    rounds, path = int(sys.argv[1]), sys.argv[2]
    params = json.load(open(path)) if os.path.exists(path) else {}
    if 'baseCurve' not in params:
        params['baseCurve'] = game_content()['baseCurve']
    history = json.load(open(path + '.history')) if os.path.exists(path + '.history') else []
    seeds = SPEC['seeds']
    for it in range(rounds):
        tune = json.dumps(params)
        with ThreadPoolExecutor(len(seeds)) as ex:
            runs = list(ex.map(lambda s: run(('reference', 'random', 'never', 'no cores', s), tune,
                                             hours=RUN_HOURS, layer='base'), seeds))
        n = STAGES - 1
        costs = [None] + [curve(params['baseCurve'], k) for k in range(1, n + 1)]
        ratios = {k: statistics.median(max(1, r['stageSeconds'][k]) / ramp(k, n)
                                       for r in runs if len(r['stageSeconds']) > k) for k in range(1, n + 1)
                  if any(len(r['stageSeconds']) > k for r in runs)}
        err = statistics.mean(abs(math.log2(x)) for x in ratios.values())
        history.append({'err': err, 'hours': statistics.median(r['seconds'] for r in runs) / 3600,
                        'regressions': [len(r['regressions']) for r in runs], 'stages': ratios,
                        'params': json.loads(json.dumps(params))})
        json.dump(history, open(path + '.history', 'w'))
        print(f"#{it} |log2 err| {err:.2f}  {history[-1]['hours']:.2f}h  | "
              + ' '.join(f'{k}:{x:.2g}' for k, x in ratios.items()), flush=True)

        # Too fast (ratio under 1) means the stage should cost more.
        last = max(ratios)
        for k in range(1, n + 1):
            costs[k] -= DAMPING * math.log10(ratios.get(k, ratios[last]))
        stages = range(1, n + 1)
        params['baseCurve'] = list(np.polyfit(list(stages), [costs[k] for k in stages], 3)[::-1])
        json.dump(params, open(path, 'w'), indent=1)

main()
