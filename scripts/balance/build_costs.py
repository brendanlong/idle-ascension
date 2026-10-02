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
so twice as long needs twice the cost), smooths the cost steps so the curve
doesn't follow one bot's quirks, and nudges the resource ladder: its cost
ratio so a new resource arrives about every stagesPerTier stages, and its
early and late efficiency steps so each one, with its first technique and a
minute of income, makes about as much as all the others combined. Every round is kept
in params.json.history.

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
# Runs stop here; stages not reached get the last reached stage's correction.
RUN_HOURS = 6

def content():
    out = subprocess.run(['npx', 'tsx', 'scripts/sim.ts'], capture_output=True, text=True, cwd=ROOT,
                         env=dict(os.environ, SIM_DUMP_PRICES='1')).stdout
    costs = json.loads(out)['baseStage']
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
    params.setdefault('ladder', {'costRatio': 13, 'efficiencyStep': 0.5, 'efficiencyStepLate': 0.5,
                                 'stagesPerTier': 2})
    params['ladder'].setdefault('efficiencyStepLate', params['ladder']['efficiencyStep'])
    history = json.load(open(path + '.history')) if os.path.exists(path + '.history') else []
    seeds = SPEC['seeds']
    for it in range(rounds):
        tune = json.dumps(params)
        with ThreadPoolExecutor(len(seeds)) as ex:
            runs = list(ex.map(lambda s: run(('reference', 'random', 'never', 'no cores', s), tune,
                                             hours=RUN_HOURS, layer='base'), seeds))
        costs = params['stageCosts']
        n = len(costs) - 1
        ratios = {k: statistics.median(max(1, r['stageSeconds'][k]) / ramp(k, n)
                                       for r in runs if len(r['stageSeconds']) > k) for k in range(1, n + 1)
                  if any(len(r['stageSeconds']) > k for r in runs)}
        err = statistics.mean(abs(math.log2(x)) for x in ratios.values())
        # New resources: when each was first bought, against one every stagesPerTier stages.
        arrivals = {}
        for r in runs:
            for x in r['newThings']:
                if x['key'].startswith('gen:'):
                    arrivals.setdefault(x['key'][4:], []).append(sum(1 for t in r['stageReached'] if t <= x['t']) - 1)
        # In order of arrival: the ladder's tiers, cheapest first.
        tiers = sorted(statistics.median(v) for v in arrivals.values())
        spacing = params['ladder']['stagesPerTier']
        late = statistics.mean(stage - spacing * tier for tier, stage in enumerate(tiers)) if tiers else 0
        # How strong each new resource is when it arrives, against all the others (log2, 0 is
        # right), for the earlier and later halves of the ladder.
        by_tier = {}
        for r in runs:
            for x in r['newResourceShares']:
                if x['share']:
                    by_tier.setdefault(x['id'], []).append(math.log2(x['share']))
        tier_strength = [statistics.median(v) for v in by_tier.values()]
        half = len(tier_strength) // 2
        strong_early = statistics.mean(tier_strength[:half]) if half else 0
        strong_late = statistics.mean(tier_strength[half:]) if tier_strength[half:] else 0
        strong = statistics.mean(tier_strength) if tier_strength else 0
        history.append({'err': err, 'hours': statistics.median(r['seconds'] for r in runs) / 3600,
                        'regressions': [len(r['regressions']) for r in runs], 'stages': ratios,
                        'resourcesLate': late, 'resourceStrength': strong,
                        'params': json.loads(json.dumps(params))})
        json.dump(history, open(path + '.history', 'w'))
        print(f"#{it} |log2 err| {err:.2f}  {history[-1]['hours']:.2f}h  regressions {history[-1]['regressions']}"
              f"  resources {late:+.1f} stages late, x{2 ** strong_early:.2g} / x{2 ** strong_late:.2g} the others"
              f" (ratio {params['ladder']['costRatio']:.3g}, step {params['ladder']['efficiencyStep']:.2g}"
              f" to {params['ladder']['efficiencyStepLate']:.2g})  | "
              + ' '.join(f'{k}:{x:.2g}' for k, x in ratios.items()), flush=True)

        # Too fast (ratio under 1) means the stage should cost more.
        last = max(ratios)
        for k in range(1, n + 1):
            costs[k] -= DAMPING * math.log10(ratios.get(k, ratios[last]))
        params['stageCosts'] = smooth(costs)
        # Resources arriving late should be cheaper relative to each other.
        params['ladder']['costRatio'] *= 1.5 ** (-DAMPING * late / spacing / 4)
        # Too strong on arrival means each tier should be less efficient than the last.
        params['ladder']['efficiencyStep'] *= 1.3 ** (-DAMPING * strong_early)
        params['ladder']['efficiencyStepLate'] *= 1.3 ** (-DAMPING * strong_late)
        json.dump(params, open(path, 'w'), indent=1)

main()
