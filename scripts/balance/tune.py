#!/usr/bin/env python3
"""
Schedule tuner. Runs the idle bot (scripts/sim.ts, SIM_PLAYER=passive) that
regresses only when stuck, over a few seeds, and:
- moves each breakthrough and realm-gated resource price toward its realm's target wait
  (realm-gated resources' output is set separately: SIM_IMPACT=1 reports how far behind the
  best resource each is when its realm is reached, and genQps makes it about twice the best);
  (time since the previous first-time purchase, including regressing),
  with longer waits at the realms where we want a regression (walls);
- cuts the price of anything no seed bought (except techniques unlocked by
  gathering, which the idle bot never unlocks).
In log space each price is its own linear equation; this is a damped
fixed-point iteration with the sim as the measurement.
Usage: tune.py iterations params.json, then write the result into src/content
with: SIM_TUNE="$(cat params.json)" SIM_DUMP_PRICES=1 npx tsx scripts/sim.ts > prices.json
      && scripts/balance/bake.py prices.json && npx prettier --write src
The fit is noisy; compare candidates with scripts/balance/eval.sh before baking.
"""
import json, math, os, re, statistics, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
TARGET = {'qiCondensation': 45, 'foundation': 75, 'coreFormation': 120, 'nascentSoul': 150,
          'spiritSevering': 200, 'daoSeeking': 260, 'immortalAscension': 320, 'godhood': 320}
WALL_WAIT = 15 * 60
WALL_STAGES = {'stage:22', 'stage:26', 'stage:30', 'stage:34'}  # Spirit Severing, Dao Seeking, Immortal Ascension, Godhood
REGRESSION_GAIN = 2.5
SEEDS = [1, 2, 3, 4]
DAMPING = float(os.environ.get('DAMPING', 0.5))
MAX_STEP = float(os.environ.get('MAX_STEP', 4))
MIN_WAIT = 3

def dur(s):
    return sum(int(n) * {'h': 3600, 'm': 60, 's': 1}[u] for n, u in re.findall(r'(\d+)([hms])', s))

def run(params, seed, extra={}):
    env = dict(os.environ, SIM_SEED=str(seed), SIM_PLAYER='passive', SIM_PRICES='1', SIM_TUNE=json.dumps(params), **extra)
    out = subprocess.run(['npx', 'tsx', 'scripts/sim.ts', '40'], capture_output=True, text=True, env=env, cwd=ROOT).stdout
    final = re.search(r'Final: (.*) after (.*), (\d+) regressions', out)
    gaps = re.search(r'longest ([^;]*); (\d+) over 10m; stuck regressions (\d+) \((\d+) futile\)', out)
    buys = json.loads(re.search(r'^PRICES (.*)$', out, re.M).group(1))
    bursts = sum(int(m) for m in re.findall(r'bursts\s+(\d+)', out))
    return {'done': final.group(1) == 'Godhood', 'time': dur(final.group(2)), 'loops': int(final.group(3)),
            'buys': buys, 'futile': int(gaps.group(4)), 'bursts': bursts}

def dump_prices():
    out = subprocess.run(['npx', 'tsx', 'scripts/sim.ts'], capture_output=True, text=True, cwd=ROOT,
                         env=dict(os.environ, SIM_DUMP_PRICES='1')).stdout
    return json.loads(out)

def fixed_price(key):
    # Techniques and cores keep their own prices (by hand early, or from their realm's
    # entry cost or their resource's cost); the tuner sets the realm structure around
    # them: breakthroughs and late resources. Tuning techniques fed back on itself: one that
    # barely helps gets bought the moment it's cheap, looks "too quick", and gets pricier
    # every round.
    return key.startswith(('up:', 'form:', 'grade:'))

def all_keys():
    d = dump_prices()
    return {f'up:{u}' for u in d['up'] if not fixed_price(f'up:{u}')}

def main():
    iterations, path = int(sys.argv[1]), sys.argv[2]
    params = json.load(open(path)) if os.path.exists(path) else {}
    keys = all_keys()
    for it in range(iterations):
        with ThreadPoolExecutor(len(SEEDS)) as ex:
            res = list(ex.map(lambda s: run(params, s), SEEDS))
        # Keep every evaluated set of prices: the fit is noisy, so pick the best round, not the last.
        regs = statistics.median(r['loops'] for r in res)
        futile = statistics.median(r['futile'] for r in res)
        history = json.load(open(path + '.history')) if os.path.exists(path + '.history') else []
        history.append({'regressions': regs, 'futile': futile, 'done': sum(r['done'] for r in res),
                        'hours': statistics.median(r['time'] for r in res) / 3600, 'params': json.loads(json.dumps(params))})
        json.dump(history, open(path + '.history', 'w'))
        price = params.setdefault('price', {})
        errs, by_realm, long_waits = [], {}, []
        for key in set().union(*(r['buys'].keys() for r in res)):
            seen = [r['buys'][key] for r in res if key in r['buys']]
            realm = statistics.mode(b['realm'] for b in seen)
            if realm not in TARGET or fixed_price(key): continue
            wait = max(MIN_WAIT, statistics.median(b['wait'] for b in seen))
            goal = WALL_WAIT if key in WALL_STAGES else TARGET[realm]
            err = math.log(goal / wait)
            errs.append(abs(err))
            if key not in WALL_STAGES: by_realm.setdefault(realm, []).append(wait)
            if wait > 2 * goal: long_waits.append((round(wait / 60), key))
            step = math.exp(DAMPING * err)
            # Regressions it took to reach this: walls should take one, everything else none.
            regs = statistics.median(b.get('regressions', 0) for b in seen)
            extra = regs - (1 if key in WALL_STAGES else 0)
            if extra > 0: step = min(step, REGRESSION_GAIN ** -extra)
            price[key] = price.get(key, 1) * min(MAX_STEP, max(1 / MAX_STEP ** 2, step))
        # Never bought by any seed: too expensive to matter, so cheaper until it's bought.
        bought = set().union(*(r['buys'].keys() for r in res))
        unbought = sorted(keys - bought)
        for key in unbought:
            price[key] = price.get(key, 1) / MAX_STEP

        med = lambda xs: statistics.median(xs)
        print(f"#{it} total {med([r['time'] for r in res]) / 3600:.1f}h regressions {med([r['loops'] for r in res])} "
              f"futile {med([r['futile'] for r in res])} done {sum(r['done'] for r in res)}/4 bursts {med([r['bursts'] for r in res])} "
              f"| |log err| {med(errs):.2f} | wait " + ' '.join(f"{k[:4]}={med(v):.0f}s" for k, v in by_realm.items()) +
              f" | long {sorted(long_waits, reverse=True)[:5]} | unbought {len(unbought)}", flush=True)
        json.dump(params, open(path, 'w'), indent=1)

main()
