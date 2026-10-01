#!/usr/bin/env python3
"""
Grades the game against the balance spec (docs/balance-spec.md, numbers in
spec.json): runs the reference players over spec.json's seeds with SIM_SPEC=1
and prints each check with what fails.
Usage: spec.py [SIM_TUNE params.json]
SPEC_RESULTS=path keeps the sim results there and reuses them, for changing the checks.
"""
import json, math, os, re, statistics, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SPEC = json.load(open(os.path.join(os.path.dirname(__file__), 'spec.json')))
TUNE = open(sys.argv[1]).read() if __name__ == '__main__' and len(sys.argv) > 1 else '{}'
NEVER_REGRESS_HOURS = 8
LAST_REALM_FIRST_STAGE = 30  # Immortal Ascension
REALMS = ['qiCondensation', 'foundation', 'coreFormation', 'nascentSoul', 'spiritSevering',
          'daoSeeking', 'immortalAscension']

def run(job, tune=TUNE, hours=None):
    player, treasures, regress, cores, seed = job
    env = dict(os.environ, SIM_SEED=str(seed), SIM_PLAYER=player, SIM_TREASURES=treasures,
               SIM_REGRESS=regress, SIM_NO_CORES='' if cores == 'cores' else '1', SIM_SPEC='1', SIM_TUNE=tune)
    # Never regressing is meant to be tedious: stop at NEVER_REGRESS_HOURS and count it slow enough.
    hours = hours or (NEVER_REGRESS_HOURS if regress == 'never' else 40)
    out = subprocess.run(['npx', 'tsx', 'scripts/sim.ts', str(hours)], capture_output=True, text=True,
                         env=env, cwd=ROOT).stdout
    return json.loads(re.search(r'^SPEC (.*)$', out, re.M).group(1))

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

def floor(k, n):
    st = SPEC['sawtooth']
    return st['floorFirst'] + (st['floorLast'] - st['floorFirst']) * (k - 1) / (n - 1)

def sawtooth_ratios(run, n):
    """Each stage's time ÷ its sawtooth target, given the deepest regression before it."""
    reached, ratios = run['stageReached'], {}
    for k in range(1, len(reached)):
        reach = max((x['from'] for x in run['regressions'] if x['t'] < reached[k]), default=0)
        st = SPEC['sawtooth']
        growth = st['growth'] if reach else st['firstLifeGrowth']
        target = floor(k, n) * growth ** (k - 1 - reach)
        if k >= LAST_REALM_FIRST_STAGE:
            target *= st['lastRealmLonger']
        ratios[k] = (max(1, run['stageSeconds'][k]) / target, reach)
    return ratios

def bored_at(run):
    """The first stage that takes longer than boredSeconds."""
    return next((k for k, sec in enumerate(run['stageSeconds'])
                 if k >= 2 and sec > SPEC['sawtooth']['boredSeconds']), None)

def stage_times(runs):
    """Median seconds from first reaching each stage to first reaching the next, by stage."""
    n = max(len(r['stageReached']) for r in runs)
    return [statistics.median([r['stageReached'][k] - r['stageReached'][k - 1]
                               for r in runs if len(r['stageReached']) > k]) for k in range(1, n)]

def main():
    seeds = SPEC['seeds']
    variants = [('active', 'random', 'efficient', 'cores'), ('passive', 'random', 'efficient', 'cores'),
                ('active', 'none', 'efficient', 'cores'), ('active', 'all', 'efficient', 'cores'),
                ('active', 'random', 'never', 'cores'), ('active', 'random', 'never', 'no cores')]
    jobs = [v + (s,) for v in variants for s in seeds]
    cache = os.environ.get('SPEC_RESULTS')
    if cache and os.path.exists(cache):
        results = {tuple(k.split('|')[:4]) + (int(k.split('|')[4]),): v for k, v in json.load(open(cache)).items()}
    else:
        with ThreadPoolExecutor(len(jobs)) as ex:
            results = dict(zip(jobs, ex.map(run, jobs)))
        if cache:
            json.dump({'|'.join(map(str, k)): v for k, v in results.items()}, open(cache, 'w'))
    runs = lambda p, t='random', g='efficient', c='cores': [results[(p, t, g, c, s)] for s in seeds]
    active, passive = runs('active'), runs('passive')

    for name, rs in [('active', active), ('passive', passive)]:
        print(f"{name}: {sum(r['done'] for r in rs)}/{len(rs)} reached Godhood, median "
              f"{fmt(statistics.median(r['seconds'] for r in rs))}, regressions "
              f"{[len(r['regressions']) for r in rs]}")
    print()

    # 1. The sawtooth: climbing within a life, back to the floor after a regression.
    st = SPEC['sawtooth']
    n = max(len(r['stageReached']) for r in active) - 1
    by_stage = {}
    for r in active:
        for k, (ratio, reach) in sawtooth_ratios(r, n).items():
            by_stage.setdefault(k, []).append((ratio, reach))
    off = []
    for k, xs in sorted(by_stage.items()):
        ratio = statistics.median(x[0] for x in xs)
        if not 1 / st['tolerance'] <= ratio <= st['tolerance']:
            off.append((k, ratio, statistics.median(x[1] for x in xs)))
    check(f"active stage times are floor ({st['floorFirst']}s rising to {st['floorLast']}s) x "
          f"{st['growth']} per stage past the deepest regression, within x{st['tolerance']}", not off,
          ', '.join(f'stage {k} x{r:.2f} (reach {reach:g})' for k, r, reach in off))
    for name, rs in [('active', active), ('passive', passive)]:
        faster = []
        for r in rs:
            reached = r['stageReached']
            for k in range(2, len(reached)):
                if any(reached[k - 1] <= x['t'] < reached[k] for x in r['regressions']):
                    continue  # a regression in between resets the climb
                a, b = r['stageSeconds'][k - 1], r['stageSeconds'][k]
                if b < st['monotoneSlack'] * a:
                    faster.append((k, a, b))
        check(f'{name}: within a life, each stage takes at least {st["monotoneSlack"]}x as long as the last',
              not faster, f'{len(faster)} over {len(rs)} runs, e.g. ' +
              ', '.join(f'stage {k} {fmt(b)} after {fmt(a)}' for k, a, b in faster[:8]))

    # Each system carries the player further before stages get boring.
    for name, rs, key in [('resources and techniques alone', runs('active', 'random', 'never', 'no cores'),
                           'resourcesOnlyBoredBy'),
                          ('with cores, never regressing', runs('active', 'random', 'never'), 'withCoresBoredBy')]:
        lo, hi = SPEC['layers'][key]
        at = [bored_at(r) for r in rs]
        known = [a for a in at if a is not None]
        median = statistics.median(known) if known else None
        check(f'{name}: stages first take over {st["boredSeconds"]}s around stage {lo}-{hi}',
              median is not None and lo <= median <= hi, f'first boring stage per run: {at}')

    # 2. Always something new to buy, never a pile at once.
    sb = SPEC['somethingToBuy']
    for name, rs in [('active', active), ('passive', passive)]:
        long_gaps = []
        for r in rs:
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
              f'{len(long_gaps)} gaps over {len(rs)} runs; worst: ' +
              ', '.join(f'stage {k} {fmt(g)} (allowed {fmt(a)})' for k, g, a in worst))
        bursts = [b for r in rs for b in r['bursts'] if b['count'] > sb['maxBurst']]
        check(f"{name}: never more than {sb['maxBurst']} new techniques bought at once", not bursts,
              f'{len(bursts)} bursts, up to {max((b["count"] for b in bursts), default=0)} at once' +
              (f' (realms {sorted({REALMS[b["realm"] - 1] for b in bursts if b["realm"] > 0})})' if bursts else ''))

    # 3. Upgrades are meaningful.
    # Gathering upgrades do nothing while idle, so each counts its better side.
    gains = {}
    for r in active + passive:
        for i in r['impacts']:
            if i['kind'] in ('technique', 'core') and i['key'] not in SPEC['upgradeExempt']:
                gains.setdefault(i['name'], []).append(gain(i))
    weak = sorted((statistics.median(g), n) for n, g in gains.items()
                  if statistics.median(g) < SPEC['minUpgradeGain'])
    check(f"every technique and core adds at least x{SPEC['minUpgradeGain']} when bought",
          not weak, f'{len(weak)} of {len(gains)}: ' + ', '.join(f'{n} x{g:.2f}' for g, n in weak))
    lo, hi = SPEC['newResource']['shareOfOthers']
    shares = {}
    for r in active:
        for x in r['newResourceShares']:
            if x['share'] is not None:
                shares.setdefault(x['id'], []).append(x['share'])
    off = [(i, statistics.median(s)) for i, s in shares.items() if not lo <= statistics.median(s) <= hi]
    check(f"a new resource, its first technique and {SPEC['newResource']['spendSeconds']}s of income "
          f'makes {lo}-{hi}x all other resources', not off,
          ', '.join(f'{i} {s:.2g}x' for i, s in off))

    # 4. Gathering's edge over idling.
    ar = SPEC['activeRatio']
    off = []
    for k, realm in enumerate(REALMS):
        vals = [r['frontierRatios'][k + 1] for r in active if r['frontierRatios'][k + 1]]
        if not vals:
            continue
        want, got = geometric(ar['first'], ar['last'], k, len(REALMS)), statistics.median(vals)
        if not want / ar['tolerance'] <= got <= want * ar['tolerance']:
            off.append((realm, got, want))
    check(f"gathering is worth about x{ar['first']} idle income at first, sliding to x{ar['last']}", not off,
          ', '.join(f'{r} x{g:.1f} (want x{w:.1f})' for r, g, w in off))

    # 5. Plateaus that regression fixes.
    rg = SPEC['regression']
    without = runs('active', 'random', 'never')
    reference = statistics.median(r['seconds'] for r in active)
    slowdown = statistics.median(r['seconds'] for r in without) / reference
    check(f"never regressing is at least {rg['withoutSlowdownAtLeast']}x slower",
          slowdown >= rg['withoutSlowdownAtLeast'],
          f"x{slowdown:.1f} ({sum(r['done'] for r in without)}/{len(without)} finished within "
          f"{NEVER_REGRESS_HOURS}h); regressions per reference run: {[len(r['regressions']) for r in active]}")
    repeats = [x['repeatStages'] for r in active for x in r['regressions']]
    check(f"regressing again from the same place moves reach at most {st['maxRepeatStages']} stages",
          all(x <= st['maxRepeatStages'] for x in repeats), f"stages: {', '.join(f'{x:.1f}' for x in repeats)}")
    payoffs = []
    for r in active:
        for x in r['regressions']:
            if len(r['stageReached']) > x['from'] + 1:
                payoffs.append((x['wait'] / max(1, r['stageReached'][x['from'] + 1] - x['t']), x['from']))
    weak = [p for p in payoffs if p[0] < rg['minPayoff']]
    check(f"each regression reaches the next stage at least {rg['minPayoff']}x sooner than waiting",
          not weak, ', '.join(f'from stage {s}: x{p:.1f}' for p, s in sorted(weak)))
    slow = {}
    for r in active + passive:
        for v in r['realms']:
            if v and v['replay'] is not None and v['firstVisit'] > 0:
                slow.setdefault(v['id'], []).append(v['replay'] / v['firstVisit'])
    slow = {k: statistics.median(v) for k, v in slow.items() if statistics.median(v) > rg['maxReplayShare']}
    check(f"replaying a finished realm takes at most {rg['maxReplayShare']} of the first visit", not slow,
          ', '.join(f'{k} {v:.0%}' for k, v in slow.items()))

    # 6. Treasures.
    lo, hi = SPEC['treasures']['levelOneGain']
    gains = {}
    for r in active:
        for i in r['impacts']:
            # Treasures that don't change income (encounters, tribulations) aren't graded here.
            if i['kind'].startswith('treasure') and gain(i) > 1.001:
                gains.setdefault(i['name'], []).append(gain(i, 'active'))
    off = [(n, statistics.median(g)) for n, g in gains.items() if not lo <= statistics.median(g) <= hi]
    check(f'each treasure adds x{lo}-{hi} when found', not off, ', '.join(f'{n} x{g:.2f}' for n, g in off))
    spread = statistics.median(r['seconds'] for r in runs('active', 'none')) / \
        statistics.median(r['seconds'] for r in runs('active', 'all'))
    check(f"treasure luck changes total time by at most x{SPEC['treasures']['maxLuckSpread']}",
          spread <= SPEC['treasures']['maxLuckSpread'], f'none / all treasures: x{spread:.2f}')

    print(f'\n{failures} checks failing')

if __name__ == '__main__':
    main()
