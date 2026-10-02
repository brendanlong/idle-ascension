#!/usr/bin/env python3
"""
Grades the game against the balance spec (docs/balance-spec.md, numbers in
spec.json): runs the reference player and the other bots over spec.json's
seeds with SIM_SPEC=1 and prints each check with what fails.
Usage: spec.py [SIM_TUNE params.json]
SPEC_RESULTS=path keeps the sim results there and reuses them, for changing the checks.
"""
import json, os, re, statistics, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SPEC = json.load(open(os.path.join(os.path.dirname(__file__), 'spec.json')))
TUNE = open(sys.argv[1]).read() if __name__ == '__main__' and len(sys.argv) > 1 else '{}'
# Never regressing is meant to be a slog: stop there and count it slow enough.
NEVER_REGRESS_HOURS = 12
REALMS = ['qiCondensation', 'foundation', 'coreFormation', 'nascentSoul', 'spiritSevering',
          'daoSeeking', 'immortalAscension']

def run(job, tune=TUNE, hours=None, layer=''):
    """job: (player, treasures, regress mode, 'cores' or 'no cores', seed); layer: SIM_LAYER."""
    player, treasures, regress, cores, seed = job
    env = dict(os.environ, SIM_SEED=str(seed), SIM_PLAYER=player, SIM_TREASURES=treasures, SIM_LAYER=layer,
               SIM_REGRESS=regress, SIM_NO_CORES='' if cores == 'cores' else '1', SIM_SPEC='1', SIM_TUNE=tune)
    hours = hours or (NEVER_REGRESS_HOURS if regress == 'never' else 40)
    out = subprocess.run(['npx', 'tsx', 'scripts/sim.ts', str(hours)], capture_output=True, text=True,
                         env=env, cwd=ROOT).stdout
    return json.loads(re.search(r'^SPEC (.*)$', out, re.M).group(1))

def ramp(k, n):
    """Target seconds for stage k of n: flat at first, then rising linearly to last."""
    r = SPEC['ramp']
    if k <= r['flatUntil']:
        return r['first']
    return r['first'] + (r['last'] - r['first']) * (k - r['flatUntil']) / (n - r['flatUntil'])

def ramp_ratios(run, n):
    """Each stage's time (within the life that first reached it) ÷ its target."""
    return {k: max(1, sec) / ramp(k, n) for k, sec in enumerate(run['stageSeconds']) if k >= 1}

def slow_from(runs, n):
    """The first stage whose median time is more than twice its target: where a player stops keeping up."""
    by_stage = {}
    for r in runs:
        for k, ratio in ramp_ratios(r, n).items():
            by_stage.setdefault(k, []).append(ratio)
    return next((k for k, v in sorted(by_stage.items()) if k >= 2 and statistics.median(v) > 2), None)

def geometric(first, last, i, n):
    return first * (last / first) ** (i / (n - 1))

def gain(i, attr=None):
    """An impact's income multiplier (None when income was 0: no measurable gain)."""
    values = [i[a] for a in ([attr] if attr else ['active', 'passive'])]
    return max((v for v in values if v is not None), default=1)

def fmt(s):
    s = round(s)
    return f'{s // 3600}h{s % 3600 // 60:02d}m' if s >= 3600 else f'{s // 60}m{s % 60:02d}s' if s >= 60 else f'{s}s'

failures = 0
def check(name, ok, detail=''):
    global failures
    failures += not ok
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f'\n      {detail}' if detail else ''))

VARIANTS = {
    'reference': ('reference', 'random', 'perRealm', 'cores'),
    'twice': ('reference', 'random', 'twicePerRealm', 'cores'),
    'never': ('reference', 'random', 'never', 'cores'),
    'resourcesOnly': ('reference', 'random', 'never', 'no cores'),
    'noTreasures': ('reference', 'none', 'perRealm', 'cores'),
    'allTreasures': ('reference', 'all', 'perRealm', 'cores'),
    'active': ('active', 'random', 'efficient', 'cores'),
    'passive': ('passive', 'random', 'efficient', 'cores'),
}

def main():
    seeds = SPEC['seeds']
    jobs = [v + (s,) for v in VARIANTS.values() for s in seeds]
    cache = os.environ.get('SPEC_RESULTS')
    if cache and os.path.exists(cache):
        results = {tuple(k.split('|')[:4]) + (int(k.split('|')[4]),): v for k, v in json.load(open(cache)).items()}
    else:
        with ThreadPoolExecutor(len(jobs)) as ex:
            results = dict(zip(jobs, ex.map(run, jobs)))
        if cache:
            json.dump({'|'.join(map(str, k)): v for k, v in results.items()}, open(cache, 'w'))
    runs = {name: [results[v + (s,)] for s in seeds] for name, v in VARIANTS.items()}
    reference = runs['reference']
    n = len(reference[0]['stageSeconds']) - 1
    total = lambda rs: statistics.median(r['seconds'] for r in rs)

    for name in ('reference', 'active', 'passive'):
        rs = runs[name]
        print(f"{name}: {sum(r['done'] for r in rs)}/{len(rs)} reached Godhood, median {fmt(total(rs))}, "
              f"regressions {[len(r['regressions']) for r in rs]}")
    print()

    # 1. The ramp: each stage a bit longer than the last, for the reference player.
    rp = SPEC['ramp']
    by_stage = {}
    for r in reference:
        for k, ratio in ramp_ratios(r, n).items():
            by_stage.setdefault(k, []).append(ratio)
    off = [(k, statistics.median(v)) for k, v in sorted(by_stage.items())
           if not 1 / rp['tolerance'] <= statistics.median(v) <= rp['tolerance']]
    check(f"reference stage times follow the ramp ({rp['first']}s, rising from stage {rp['flatUntil']} "
          f"to {fmt(rp['last'])}) within x{rp['tolerance']}", not off,
          ', '.join(f'stage {k} x{x:.2f}' for k, x in off))
    for name in ('reference', 'passive'):
        faster = []
        for r in runs[name]:
            reached = r['stageReached']
            for k in range(2, len(reached)):
                if any(reached[k - 1] <= x['t'] < reached[k] for x in r['regressions']):
                    continue  # a regression in between resets the climb
                a, b = r['stageSeconds'][k - 1], r['stageSeconds'][k]
                if b < rp['monotoneSlack'] * a:
                    faster.append((k, a, b))
        check(f'{name}: within a life, each stage takes at least {rp["monotoneSlack"]}x as long as the last',
              not faster, f'{len(faster)} over {len(runs[name])} runs, e.g. ' +
              ', '.join(f'stage {k} {fmt(b)} after {fmt(a)}' for k, a, b in faster[:8]))

    # Layers: each system carries a player who never regresses further before they fall behind.
    for name, key, label in [('resourcesOnly', 'resourcesOnlySlowFrom', 'resources and techniques alone'),
                             ('never', 'withCoresSlowFrom', 'with cores, never regressing')]:
        lo, hi = SPEC['layers'][key]
        at = slow_from(runs[name], n)
        check(f'{label}: falls behind the ramp (stages over twice their target) around stage {lo}-{hi}',
              at is not None and lo <= at <= hi, f'first stage over twice its target: {at}')

    # 2. Always something new to buy, never a pile at once.
    sb = SPEC['somethingToBuy']
    for name in ('reference', 'passive'):
        long_gaps = []
        for r in runs[name]:
            reached, ts = r['stageReached'], sorted(x['t'] for x in r['newThings'])
            for a, b in zip(ts, ts[1:]):
                k = sum(1 for x in reached if x <= a)  # the stage being worked toward
                if k >= len(reached):
                    continue
                allowed = max(sb['minGapSeconds'], sb['maxGapShareOfStage'] * (reached[k] - reached[k - 1]))
                if b - a > allowed:
                    long_gaps.append((k, b - a, allowed))
        worst = sorted(long_gaps, key=lambda g: g[2] / g[1])[:6]
        check(f"{name}: nothing new for at most {sb['maxGapShareOfStage']} of the stage's time "
              f"(or {sb['minGapSeconds']}s)", not long_gaps,
              f'{len(long_gaps)} gaps over {len(runs[name])} runs; worst: ' +
              ', '.join(f'stage {k} {fmt(g)} (allowed {fmt(a)})' for k, g, a in worst))
        bursts = [b for r in runs[name] for b in r['bursts'] if b['count'] > sb['maxBurst']]
        check(f"{name}: never more than {sb['maxBurst']} new techniques bought at once", not bursts,
              f'{len(bursts)} bursts, up to {max((b["count"] for b in bursts), default=0)} at once')

    # 3. Upgrades are meaningful. Gathering upgrades do nothing while idle, so each counts its better side.
    gains = {}
    for r in reference + runs['active'] + runs['passive']:
        for i in r['impacts']:
            if i['kind'] in ('technique', 'core') and i['key'] not in SPEC['upgradeExempt']:
                gains.setdefault(i['name'], []).append(gain(i))
    weak = sorted((statistics.median(g), name) for name, g in gains.items()
                  if statistics.median(g) < SPEC['minUpgradeGain'])
    check(f"every technique and core adds at least x{SPEC['minUpgradeGain']} when bought",
          not weak, f'{len(weak)} of {len(gains)}: ' + ', '.join(f'{name} x{g:.2f}' for g, name in weak))
    lo, hi = SPEC['newResource']['shareOfOthers']
    shares = {}
    for r in reference:
        for x in r['newResourceShares']:
            if x['share'] is not None:
                shares.setdefault(x['id'], []).append(x['share'])
    off = [(i, statistics.median(s)) for i, s in shares.items() if not lo <= statistics.median(s) <= hi]
    check(f"a new resource, its first technique and {SPEC['newResource']['spendSeconds']}s of income "
          f'makes {lo}-{hi}x all other resources', not off, ', '.join(f'{i} {s:.2g}x' for i, s in off))
    arrivals = {}
    for r in reference:
        stage_at = lambda t: sum(1 for x in r['stageReached'] if x <= t) - 1
        for x in r['newThings']:
            if x['key'].startswith('gen:'):
                arrivals.setdefault(x['key'][4:], []).append(stage_at(x['t']))
    print('      new resources first bought at stage: ' +
          ' '.join(f'{g} {statistics.median(s):g}' for g, s in arrivals.items()))

    # 4. Gathering's edge over idling.
    ar = SPEC['activeRatio']
    off = []
    for k, realm in enumerate(REALMS):
        vals = [r['frontierRatios'][k + 1] for r in runs['active'] if r['frontierRatios'][k + 1]]
        if not vals:
            continue
        want, got = geometric(ar['first'], ar['last'], k, len(REALMS)), statistics.median(vals)
        if not want / ar['tolerance'] <= got <= want * ar['tolerance']:
            off.append((realm, got, want))
    check(f"gathering is worth about x{ar['first']} idle income at first, sliding to x{ar['last']}", not off,
          ', '.join(f'{r} x{g:.1f} (want x{w:.1f})' for r, g, w in off))

    # 5. Regression.
    rg = SPEC['regression']
    slowdown = total(runs['never']) / total(reference)
    check(f"never regressing is at least {rg['neverSlowdownAtLeast']}x slower", slowdown >= rg['neverSlowdownAtLeast'],
          f"x{slowdown:.1f} ({sum(r['done'] for r in runs['never'])}/{len(runs['never'])} finished within "
          f"{NEVER_REGRESS_HOURS}h)")
    lo, hi = rg['twicePerRealmFaster']
    speedup = total(reference) / total(runs['twice'])
    check(f'regressing twice per realm is {lo}-{hi}x faster', lo <= speedup <= hi, f'x{speedup:.2f}')
    repeats = [x['repeatGain'] for r in reference for x in r['regressions']]
    check(f"regressing again from the same place adds at most x{rg['maxRepeatGain']}",
          all(x <= rg['maxRepeatGain'] for x in repeats), ', '.join(f'x{x:.1f}' for x in repeats))
    slow = {}
    for r in reference + runs['passive']:
        for v in r['realms']:
            if v and v['replay'] is not None and v['firstVisit'] > 0:
                slow.setdefault(v['id'], []).append(v['replay'] / v['firstVisit'])
    slow = {k: statistics.median(v) for k, v in slow.items() if statistics.median(v) > rg['maxReplayShare']}
    check(f"replaying a finished realm takes at most {rg['maxReplayShare']} of the first visit", not slow,
          ', '.join(f'{k} {v:.0%}' for k, v in slow.items()))

    # 6. Treasures.
    lo, hi = SPEC['treasures']['levelOneGain']
    gains = {}
    for r in reference:
        for i in r['impacts']:
            # Treasures that don't change income (encounters, tribulations) aren't graded here.
            if i['kind'].startswith('treasure') and gain(i) > 1.001:
                gains.setdefault(i['name'], []).append(gain(i))
    off = [(name, statistics.median(g)) for name, g in gains.items() if not lo <= statistics.median(g) <= hi]
    check(f'each treasure adds x{lo}-{hi} when found', not off, ', '.join(f'{name} x{g:.2f}' for name, g in off))
    spread = total(runs['noTreasures']) / total(runs['allTreasures'])
    check(f"treasure luck changes total time by at most x{SPEC['treasures']['maxLuckSpread']}",
          spread <= SPEC['treasures']['maxLuckSpread'], f'none / all treasures: x{spread:.2f}')

    print(f'\n{failures} checks failing')

if __name__ == '__main__':
    main()
