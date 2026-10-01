#!/usr/bin/env python3
"""
Tunes realm entry costs (SIM_TUNE's "entries", see applyStageCurve in
scripts/sim.ts; every other breakthrough lies on a smooth curve through them)
so each player's first time through each realm, including any regressions it
takes, follows its TARGET_MINUTES. Each round moves the cost of leaving a
realm (the next realm's entry) by DECADES_PER_DOUBLING for each doubling
between actual and target time, averaged over the players with a target for
that realm, damped.
Usage: tune_curve.py iterations params.json (keeps every round in params.json.history)
"""
import json, math, os, re, statistics, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
REALMS = ['Qi Condensation', 'Foundation Establishment', 'Core Formation', 'Nascent Soul',
          'Spirit Severing', 'Dao Seeking', 'Immortal Ascension']
TARGET_MINUTES = {
    # Active early, idle late: the player the game is paced for.
    'taper': dict(zip(REALMS, [6, 6, 7, 9, 12, 15, 18])),
    # Gathering throughout. Late on the tapering bot only checks in every 10 minutes, so its
    # times there stop depending on prices; this keeps the late realms from collapsing.
    'active': dict(zip(REALMS, [5, 3, 4, 4, 5, 6, 7])),
    # Idle throughout. Fitting both at once oscillates, so this is opt-in (PLAYERS=taper,active,passive).
    'passive': dict(zip(REALMS[3:], [25, 28, 32, 36])),
}
REALM_IDS = dict(zip(REALMS, ['qiCondensation', 'foundation', 'coreFormation', 'nascentSoul',
                              'spiritSevering', 'daoSeeking', 'immortalAscension']))
NEXT_REALM = dict(zip(REALM_IDS.values(), list(REALM_IDS.values())[1:] + ['godhood']))
DECADES_PER_DOUBLING = 1
MAX_SLOPE_CHANGE = 1.5
STAGES_IN = {'foundation': 4, 'coreFormation': 4, 'nascentSoul': 4, 'spiritSevering': 4,
             'daoSeeking': 4, 'immortalAscension': 4}
SEEDS = [1, 2, 3, 4]
DAMPING = float(os.environ.get('DAMPING', 0.4))

def dur(s):
    return sum(int(n) * {'h': 3600, 'm': 60, 's': 1}[u] for n, u in re.findall(r'(\d+)([hms])', s))

def run(params, player, seed):
    env = dict(os.environ, SIM_SEED=str(seed), SIM_PLAYER=player, SIM_TUNE=json.dumps(params))
    out = subprocess.run(['npx', 'tsx', 'scripts/sim.ts', '40'], capture_output=True, text=True, env=env, cwd=ROOT).stdout
    final = re.search(r'Final: (.*) after (.*), (\d+) regressions', out)
    times = {m.group(1): dur(m.group(2)) / 60 for m in re.finditer(r'^  (\S.*?)\s{2,}(\S.*?) over \d+ loops?', out, re.M)}
    return {'hours': dur(final.group(2)) / 3600, 'regressions': int(final.group(3)), 'times': times}

def smooth(entries):
    # Each realm's average step (decades per stage, up to the next realm's entry) is
    # within MAX_SLOPE_CHANGE of the previous realm's, so no realm races or walls.
    slope = None
    for rid, nxt in list(NEXT_REALM.items())[1:]:
        start = entries[rid]
        s = (entries[nxt] - start) / STAGES_IN[rid]
        if slope is not None:
            s = min(slope * MAX_SLOPE_CHANGE, max(slope / MAX_SLOPE_CHANGE, s))
        entries[nxt] = start + s * STAGES_IN[rid]
        slope = s

def main():
    iterations, path = int(sys.argv[1]), sys.argv[2]
    params = json.load(open(path))
    history_path = path + '.history'
    history = json.load(open(history_path)) if os.path.exists(history_path) else []
    players = os.environ.get('PLAYERS', 'taper,active').split(',')
    jobs = [(p, s) for p in players for s in SEEDS]
    for it in range(iterations):
        with ThreadPoolExecutor(len(jobs)) as ex:
            res = list(ex.map(lambda j: run(params, *j), jobs))
        summary, errs, changes = {}, [], {}
        for player in players:
            targets = TARGET_MINUTES[player]
            rs = [r for (p, _), r in zip(jobs, res) if p == player]
            times = {r: statistics.median(x['times'].get(r, 0) for x in rs) for r in targets}
            summary[player] = {'hours': statistics.median(x['hours'] for x in rs),
                               'regressions': statistics.median(x['regressions'] for x in rs), 'times': times}
            for r, t in times.items():
                err = math.log2(targets[r] / max(t, 0.1))
                errs.append(abs(err))
                changes.setdefault(r, []).append(err)
        err = statistics.median(errs)
        history.append({'err': err, 'players': summary, 'params': json.loads(json.dumps(params))})
        json.dump(history, open(history_path, 'w'))
        print(f"#{it} |log2 err| {err:.2f} | " + ' | '.join(
            f"{p} {s['hours']:.2f}h regs {s['regressions']} " +
            ' '.join(f"{REALM_IDS[r][:4]}={t:.1f}m" for r, t in s['times'].items())
            for p, s in summary.items()), flush=True)
        entries = params['entries']
        for r, errs_r in changes.items():
            change = DAMPING * DECADES_PER_DOUBLING * statistics.mean(errs_r)
            entries[NEXT_REALM[REALM_IDS[r]]] += min(1, max(-1, change))
        smooth(entries)
        json.dump(params, open(path, 'w'), indent=1)

main()
