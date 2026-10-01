#!/usr/bin/env python3
"""
Fits the smooth breakthrough cost curve (SIM_TUNE's "curve", see COST_CURVE in
src/content/realms.ts) and the Memory weight to the sawtooth in the balance spec
(docs/balance-spec.md): the active reference player's stage times should be
floor x growth ^ (stages past its deepest regression).

The curve has only a few parameters, so it stays smooth whatever the bot
happens to do; stages that are still off target point at content (bursts of
income) rather than prices. A coordinate search: each round tries nudging
each parameter both ways and keeps whichever scores best (mean |log2| of each
stage's median time ÷ target over the spec's seeds), halving the nudges when
nothing helps. Keeps every evaluation in params.json.history.

Realm-gated resources are priced from the economy as they unlock
(SIM_CALIBRATE), since their right price depends on the curve; run
calibrate.py on the result to write them.

Usage: tune_curve.py rounds params.json
Write the result into src/content with bake.py params.json.
"""
import json, math, os, statistics, sys
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(__file__))
from spec import SPEC, run, sawtooth_ratios

START = {'curve': {'early': 0.9, 'late': 0.9, 'mid': 14, 'width': 2}, 'memory': {'weight': 2.5}}
# (section, parameter, nudge, whether the nudge multiplies)
NUDGES = [('curve', 'early', 0.1, False), ('curve', 'late', 0.1, False), ('curve', 'mid', 2, False),
          ('curve', 'width', 1, False), ('memory', 'weight', 1.5, True)]
LIMITS = {'width': (0.3, 10), 'early': (0.05, 3), 'late': (0.05, 3)}

def score(params, history, path):
    tune = json.dumps(params)
    seeds = SPEC['seeds']
    with ThreadPoolExecutor(len(seeds)) as ex:
        runs = list(ex.map(lambda s: run(('active', 'random', 'efficient', s), tune, calibrate=True), seeds))
    n = max(len(r['stageReached']) for r in runs) - 1
    errs = {}
    for r in runs:
        for k, (ratio, _) in sawtooth_ratios(r, n).items():
            errs.setdefault(k, []).append(math.log2(max(ratio, 1e-3)))
    stage_err = {k: statistics.median(v) for k, v in errs.items()}
    # Not reaching Godhood counts as far off for every stage it never reached.
    missing = n - len(stage_err)
    err = (sum(abs(e) for e in stage_err.values()) + 5 * missing) / n
    history.append({'err': err, 'hours': statistics.median(r['seconds'] for r in runs) / 3600,
                    'regressions': [len(r['regressions']) for r in runs], 'stages': stage_err,
                    'params': json.loads(json.dumps(params))})
    json.dump(history, open(path + '.history', 'w'))
    return err

def main():
    rounds, path = int(sys.argv[1]), sys.argv[2]
    params = json.load(open(path)) if os.path.exists(path) else START
    history = json.load(open(path + '.history')) if os.path.exists(path + '.history') else []
    nudges = {p: d for _, p, d, _ in NUDGES}
    best = score(params, history, path)
    print(f'start {best:.3f} {json.dumps(params)}', flush=True)
    for it in range(rounds):
        improved = False
        for section, p, _, mult in NUDGES:
            for sign in (1, -1):
                trial = json.loads(json.dumps(params))
                d = nudges[p]
                value = trial[section][p] * d ** sign if mult else trial[section][p] + sign * d
                lo, hi = LIMITS.get(p, (-math.inf, math.inf))
                trial[section][p] = min(hi, max(lo, value))
                err = score(trial, history, path)
                if err < best:
                    best, params, improved = err, trial, True
                    break
        if not improved:
            for p in nudges:
                nudges[p] = nudges[p] ** 0.5 if any(m for _, q, _, m in NUDGES if q == p) else nudges[p] / 2
        h = history[-1]
        print(f'#{it} best {best:.3f}  {json.dumps(params)}  nudges {nudges}', flush=True)
        json.dump(params, open(path, 'w'), indent=1)

main()
