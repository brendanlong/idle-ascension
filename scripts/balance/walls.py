#!/usr/bin/env python3
"""
Wall calibrator. The realm entrances in WALLS should each take an idle player
exactly one regression. Runs the idle bot (regressing only when stuck) over a
few seeds, reads how many regressions it took to reach each wall stage, and
scales that wall's price by one regression's worth for each regression too
many or too few. Usage: walls.py iterations params.json (SIM_TUNE params, as
from tune.py; earlier walls first, since they change the Memories for later ones).
"""
import json, os, re, statistics, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
WALLS = ['stage:22', 'stage:26', 'stage:30', 'stage:34']  # Spirit Severing, Dao Seeking, Immortal Ascension, Godhood
REGRESSION_GAIN = 2.5  # roughly what one regression is worth at these walls
DAMPING = 0.7
SEEDS = [1, 2, 3, 4, 5, 6]

def run(params, seed):
    env = dict(os.environ, SIM_SEED=str(seed), SIM_PLAYER='passive', SIM_PRICES='1', SIM_TUNE=json.dumps(params))
    out = subprocess.run(['npx', 'tsx', 'scripts/sim.ts', '40'], capture_output=True, text=True, env=env, cwd=ROOT).stdout
    final = re.search(r'Final: (.*) after (.*), (\d+) regressions', out)
    buys = json.loads(re.search(r'^PRICES (.*)$', out, re.M).group(1))
    hours = sum(int(n) * {'h': 1, 'm': 1 / 60, 's': 1 / 3600}[u] for n, u in re.findall(r'(\d+)([hms])', final.group(2)))
    return {'hours': hours, 'regressions': int(final.group(3)),
            'walls': {w: buys[w]['regressions'] for w in WALLS if w in buys}}

def main():
    iterations, path = int(sys.argv[1]), sys.argv[2]
    params = json.load(open(path))
    price = params.setdefault('price', {})
    for it in range(iterations):
        with ThreadPoolExecutor(len(SEEDS)) as ex:
            res = list(ex.map(lambda s: run(params, s), SEEDS))
        counts = {w: [r['walls'].get(w, 0) for r in res] for w in WALLS}
        print(f"#{it} hours {statistics.median(r['hours'] for r in res):.1f} regressions "
              f"{sorted(r['regressions'] for r in res)} | " +
              ' '.join(f"{w}={c}" for w, c in counts.items()), flush=True)
        # Fix the earliest wall that's off; later walls depend on it.
        for w in WALLS:
            k = statistics.median(counts[w])
            if abs(k - 1) >= 0.5:
                price[w] = price.get(w, 1) * REGRESSION_GAIN ** (DAMPING * (1 - k))
                break
        else:
            print('all walls take about one regression')
            break
        json.dump(params, open(path, 'w'), indent=1)

main()
