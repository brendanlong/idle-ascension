#!/usr/bin/env python3
"""
Tunes the breakthrough cost curve (SIM_TUNE's "curve", see applyStageCurve in
scripts/sim.ts) so the tapering bot's (active early, idle late) first time
through each realm, including any regressions it takes, follows TARGET_MINUTES. Each round scales the realm's
steps by the damped root of target / actual time.
Usage: tune_curve.py iterations params.json (keeps every round in params.json.history)
"""
import json, math, os, re, statistics, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
TARGET_MINUTES = {'Qi Condensation': 6, 'Foundation Establishment': 6, 'Core Formation': 7,
                  'Nascent Soul': 9, 'Spirit Severing': 12, 'Dao Seeking': 15, 'Immortal Ascension': 18}
REALM_IDS = {'Qi Condensation': 'qiCondensation', 'Foundation Establishment': 'foundation',
             'Core Formation': 'coreFormation', 'Nascent Soul': 'nascentSoul', 'Spirit Severing': 'spiritSevering',
             'Dao Seeking': 'daoSeeking', 'Immortal Ascension': 'immortalAscension'}
NEXT_REALM = {'qiCondensation': 'foundation', 'foundation': 'coreFormation', 'coreFormation': 'nascentSoul',
              'nascentSoul': 'spiritSevering', 'spiritSevering': 'daoSeeking', 'daoSeeking': 'immortalAscension',
              'immortalAscension': 'godhood'}
DECADES_PER_DOUBLING = 1
MIN_REALM_DECADES = 1
SEEDS = [1, 2, 3, 4, 5, 6]
DAMPING = float(os.environ.get('DAMPING', 0.5))

def dur(s):
    return sum(int(n) * {'h': 3600, 'm': 60, 's': 1}[u] for n, u in re.findall(r'(\d+)([hms])', s))

def run(params, seed):
    env = dict(os.environ, SIM_SEED=str(seed), SIM_PLAYER=os.environ.get('PLAYER', 'taper'), SIM_TUNE=json.dumps(params))
    out = subprocess.run(['npx', 'tsx', 'scripts/sim.ts', '40'], capture_output=True, text=True, env=env, cwd=ROOT).stdout
    final = re.search(r'Final: (.*) after (.*), (\d+) regressions', out)
    times = {m.group(1): dur(m.group(2)) / 60 for m in re.finditer(r'^  (\S.*?)\s{2,}(\S.*?) over \d+ loops?', out, re.M)}
    return {'hours': dur(final.group(2)) / 3600, 'regressions': int(final.group(3)), 'times': times}

def main():
    iterations, path = int(sys.argv[1]), sys.argv[2]
    params = json.load(open(path))
    history_path = path + '.history'
    history = json.load(open(history_path)) if os.path.exists(history_path) else []
    for it in range(iterations):
        with ThreadPoolExecutor(len(SEEDS)) as ex:
            res = list(ex.map(lambda s: run(params, s), SEEDS))
        times = {r: statistics.median(x['times'].get(r, 0) for x in res) for r in TARGET_MINUTES}
        err = statistics.median(abs(math.log(TARGET_MINUTES[r] / max(t, 0.1))) for r, t in times.items())
        hours = statistics.median(x['hours'] for x in res)
        regs = statistics.median(x['regressions'] for x in res)
        history.append({'err': err, 'hours': hours, 'regressions': regs, 'times': times, 'params': json.loads(json.dumps(params))})
        json.dump(history, open(history_path, 'w'))
        print(f"#{it} {hours:.2f}h regressions {regs} |log err| {err:.2f} | " +
              ' '.join(f"{REALM_IDS[r][:4]}={t:.1f}m" for r, t in times.items()), flush=True)
        entries = params['entries']
        for r, t in times.items():
            change = DAMPING * DECADES_PER_DOUBLING * math.log2(TARGET_MINUTES[r] / max(t, 0.1))
            entries[NEXT_REALM[REALM_IDS[r]]] += min(1, max(-1, change))
        # Each realm's entry stays at least MIN_REALM_DECADES above the previous one.
        previous = 0
        for rid in NEXT_REALM.values():
            entries[rid] = max(entries[rid], previous + MIN_REALM_DECADES)
            previous = entries[rid]
        json.dump(params, open(path, 'w'), indent=1)

main()
