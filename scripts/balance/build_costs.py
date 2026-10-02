#!/usr/bin/env python3
"""
Builds breakthrough costs from the content (see "Breakthrough costs are built
from play" in docs/balance-spec.md): plays the reference player (it buys
whatever pays off, fades from gathering to idling, and regresses once per
realm) and prices each stage so it takes the spec's ramp time.

Each round plays the spec's seeds with the current costs, moves every stage's
cost by how far its time is off target (a stage takes about cost ÷ income,
so twice as long needs twice the cost), smooths the cost steps so the curve
doesn't follow one bot's quirks, and nudges the resource ladder's cost ratio
so a new resource arrives about every RESOURCE_SPACING stages. Every round is
kept in params.json.history.

Usage: build_costs.py rounds params.json (starts from the game's content if
params.json doesn't exist). Write the result into src/content with
bake.py params.json.
"""
import json, math, os, statistics, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from spec import SPEC, ramp, run

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
DAMPING = float(os.environ.get('DAMPING', 0.7))
# Cost steps are averaged over this many stages.
SMOOTHING = 5
MIN_STEP = 0.1  # decades
RESOURCE_SPACING = 2
# Runs stop here; stages not reached get the last reached stage's correction.
RUN_HOURS = 6

def content():
    out = subprocess.run(['npx', 'tsx', 'scripts/sim.ts'], capture_output=True, text=True, cwd=ROOT,
                         env=dict(os.environ, SIM_DUMP_PRICES='1')).stdout
    costs = json.loads(out)['stage']
    return [None] + [math.log10(c) for c in costs[1:]]

def smooth(log_costs):
    steps = np.diff(log_costs[1:])
    pad = SMOOTHING // 2
    padded = np.concatenate([np.full(pad, steps[0]), steps, np.full(pad, steps[-1])])
    smoothed = np.maximum(np.convolve(padded, np.ones(SMOOTHING) / SMOOTHING, mode='valid'), MIN_STEP)
    return [None, log_costs[1]] + list(log_costs[1] + np.cumsum(smoothed))

def main():
    rounds, path = int(sys.argv[1]), sys.argv[2]
    params = json.load(open(path)) if os.path.exists(path) else {}
    params.setdefault('stageCosts', content())
    params.setdefault('ladder', {'costRatio': 13, 'efficiencyStep': 0.5})
    history = json.load(open(path + '.history')) if os.path.exists(path + '.history') else []
    seeds = SPEC['seeds']
    for it in range(rounds):
        tune = json.dumps(params)
        with ThreadPoolExecutor(len(seeds)) as ex:
            runs = list(ex.map(lambda s: run(('reference', 'random', 'perRealm', 'cores', s), tune,
                                             hours=RUN_HOURS), seeds))
        costs = params['stageCosts']
        n = len(costs) - 1
        ratios = {k: statistics.median(max(1, r['stageSeconds'][k]) / ramp(k, n)
                                       for r in runs if len(r['stageSeconds']) > k) for k in range(1, n + 1)
                  if any(len(r['stageSeconds']) > k for r in runs)}
        err = statistics.mean(abs(math.log2(x)) for x in ratios.values())
        # New resources: when each was first bought, against one every RESOURCE_SPACING stages.
        arrivals = {}
        for r in runs:
            for x in r['newThings']:
                if x['key'].startswith('gen:'):
                    arrivals.setdefault(x['key'][4:], []).append(sum(1 for t in r['stageReached'] if t <= x['t']) - 1)
        # In order of arrival: the ladder's tiers, cheapest first.
        tiers = sorted(statistics.median(v) for v in arrivals.values())
        late = statistics.mean(stage - RESOURCE_SPACING * tier for tier, stage in enumerate(tiers)) if tiers else 0
        history.append({'err': err, 'hours': statistics.median(r['seconds'] for r in runs) / 3600,
                        'regressions': [len(r['regressions']) for r in runs], 'stages': ratios,
                        'resourcesLate': late, 'params': json.loads(json.dumps(params))})
        json.dump(history, open(path + '.history', 'w'))
        print(f"#{it} |log2 err| {err:.2f}  {history[-1]['hours']:.2f}h  regressions {history[-1]['regressions']}"
              f"  resources {late:+.1f} stages late, cost ratio {params['ladder']['costRatio']:.3g}  | "
              + ' '.join(f'{k}:{x:.2g}' for k, x in ratios.items()), flush=True)

        # Too fast (ratio under 1) means the stage should cost more.
        last = max(ratios)
        for k in range(1, n + 1):
            costs[k] -= DAMPING * math.log10(ratios.get(k, ratios[last]))
        params['stageCosts'] = smooth(costs)
        # Resources arriving late should be cheaper relative to each other.
        params['ladder']['costRatio'] *= 1.5 ** (-DAMPING * late / RESOURCE_SPACING / 4)
        json.dump(params, open(path, 'w'), indent=1)

main()
