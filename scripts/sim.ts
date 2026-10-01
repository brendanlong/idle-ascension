/**
 * Headless balance simulation: a greedy bot plays the game and reports how
 * long each milestone takes. Run with `npm run sim -- [clicksPerSecond] [hours] [stallMinutes]`.
 * Environment variables:
 *   SIM_SEED=<n>      a different random seed
 *   SIM_ACTIVE=<0-1>  fraction of each 10 minutes spent actively playing: clicking, catching
 *                     motes, claiming encounters and trials, buying and breaking through. The
 *                     rest is idle. By default it tapers from 80% at the start toward 10%,
 *                     halving the gap every 2 hours, like a player who gets more passive.
 *   SIM_IMPACT=1      also print how much each resource, technique, core and treasure adds
 *                     to income when it first becomes available
 */
import { CORE_GRADES, ELEMENTS, type ElementId } from '../src/content/cores';
import { GENERATORS, generatorName } from '../src/content/generators';
import { UPGRADES } from '../src/content/upgrades';
import { PERKS } from '../src/content/perks';
import { REALMS, STAGES, stageName } from '../src/content/realms';
import { MAX_TREASURE_LEVEL, TREASURES } from '../src/content/treasures';
import {
  attemptBreakthrough,
  breakthroughCost,
  nextStage,
  recordTribulationTrial,
} from '../src/engine/breakthrough';
import {
  canFormCore,
  canRefineCore,
  coreFormCost,
  coreRefineCost,
  formCore,
  refineCore,
} from '../src/engine/cores';
import {
  absorbMotes,
  availableUpgrades,
  buyGenerator,
  buyUpgrade,
  click,
  generatorCost,
  isGeneratorVisible,
} from '../src/engine/economy';
import { claimEncounter } from '../src/engine/encounters';
import { acceptTrial, completeTrial } from '../src/engine/trials';
import { formatDuration, formatNumber } from '../src/engine/format';
import {
  buyPerk,
  pendingMemories,
  perkStatus,
  regress,
  regressionBlocker,
} from '../src/engine/prestige';
import { createInitialState, type GameState } from '../src/engine/state';
import { computeStats } from '../src/engine/stats';
import { tick } from '../src/engine/tick';

const clicksPerSecond = Number(process.argv[2] ?? 3);
const maxHours = Number(process.argv[3] ?? 48);
const MOTE_CATCH_RATE = 0.4;
const FIXED_ACTIVE_FRACTION = process.env.SIM_ACTIVE ? Number(process.env.SIM_ACTIVE) : null;
const ACTIVE_CYCLE_SECONDS = 600;
const printImpact = !!process.env.SIM_IMPACT;
/** How well the bot plays elemental trials (0-1), for tribulations and optional offers. */
const TRIBULATION_TRIAL_SCORE = 0.8;
const OPTIONAL_TRIAL_SCORE = 0.7;
const STALL_SECONDS = Number(process.argv[4] ?? 45) * 60;
/** The bot regresses once that would multiply its Memory bonus by this much (or it's stalled). */
const REGRESS_AT_MEMORY_GAIN = 1.5;
const CORE_ORDER: ElementId[] = ['wood', 'fire', 'water', 'earth', 'metal'];

let seed = Number(process.env.SIM_SEED ?? 12345);
const rng = () => {
  seed = (seed * 1664525 + 1013904223) % 2 ** 32;
  return seed / 2 ** 32;
};

let state: GameState = createInitialState(0);
state.flags.introSeen = true;
let time = 0;
let lastProgress = 0;
/** Gaps between breakthroughs (or before regressing), the "sitting on your hands" time. */
const waits: number[] = [];
let loopLongestWait = { seconds: 0, stage: 0 };
function recordWait(): void {
  const gap = time - lastProgress;
  waits.push(gap);
  if (gap > loopLongestWait.seconds) loopLongestWait = { seconds: gap, stage: state.stage };
}

/** Per-realm activity in the current loop, printed for the final loop. */
interface RealmActivity {
  seconds: number;
  generatorsBought: number;
  techniques: number;
  /** Generator types the bot bought for the first time (not ones granted by Buried Stash). */
  firstBought: string[];
}
let realmActivity: Record<string, RealmActivity> = {};
function activity(): RealmActivity {
  const realm = REALMS[STAGES[state.stage].realmIndex].name;
  return (realmActivity[realm] ??= {
    seconds: 0,
    generatorsBought: 0,
    techniques: 0,
    firstBought: [],
  });
}
const reachedRealm = new Set<number>();

function activeFraction(): number {
  return FIXED_ACTIVE_FRACTION ?? 0.1 + 0.7 * 0.5 ** (time / 3600 / 2);
}

function isActive(): boolean {
  return time % ACTIVE_CYCLE_SECONDS < ACTIVE_CYCLE_SECONDS * activeFraction();
}

/** Qi/s while idle (passive) and while actively playing (plus clicks and caught motes), buffs excluded. */
function income(s: GameState): { passive: number; active: number } {
  const stats = computeStats(s, false);
  const play =
    clicksPerSecond * stats.clickPower +
    stats.moteSpawnPerSecond * MOTE_CATCH_RATE * stats.moteValue;
  return { passive: stats.qps, active: stats.qps + play };
}

function averageIncome(i: { passive: number; active: number }): number {
  return i.passive + activeFraction() * (i.active - i.passive);
}

/** What something added to income at the moment it was first bought (or could first be found). */
interface Impact {
  kind: string;
  name: string;
  stage: string;
  loop: number;
  /** Cost in seconds of average income just before buying. */
  costSeconds: number;
  passiveMult: number;
  activeMult: number;
  /**
   * The same 5 minutes later in the same loop (or, for treasures, the first
   * time their realm's last stage is reached). Not measured for cores.
   */
  later?: { passiveMult: number; activeMult: number };
  /** Resources only: their share of passive qi/s 5 minutes later, and the most it ever reached. */
  generatorId?: string;
  shareLater?: number;
  peakShare?: number;
}
const impacts = new Map<string, Impact>();
const laterChecks: {
  impact: Impact;
  at: number;
  loop: number;
  undo: (s: GameState) => void;
}[] = [];

function multipliers(after: GameState, before: GameState) {
  const a = income(after);
  const b = income(before);
  return { passiveMult: a.passive / b.passive, activeMult: a.active / b.active };
}

function recordImpact(
  key: string,
  kind: string,
  name: string,
  cost: number,
  undo: (s: GameState) => void,
  generatorId?: string,
): void {
  if (!printImpact || impacts.has(key)) return;
  const without = structuredClone(state);
  undo(without);
  const impact: Impact = {
    kind,
    name,
    stage: stageName(state.stage),
    loop: state.prestige.loops,
    costSeconds: cost / averageIncome(income(without)),
    ...multipliers(state, without),
    generatorId,
  };
  impacts.set(key, impact);
  // Undoing a core later would also undo the refines bought since, so only resources and techniques.
  if (kind !== 'core') laterChecks.push({ impact, at: time + 300, loop: impact.loop, undo });
}

function trackLaterImpact(): void {
  const stats = computeStats(state, false);
  for (const check of laterChecks) {
    const { impact } = check;
    if (time === check.at && state.prestige.loops === check.loop) {
      const without = structuredClone(state);
      check.undo(without);
      impact.later = multipliers(state, without);
    }
    if (!impact.generatorId || stats.qps <= 0) continue;
    const id = impact.generatorId;
    const share = (stats.generatorUnitQps[id] * state.generators[id]) / stats.qps;
    impact.peakShare = Math.max(impact.peakShare ?? 0, share);
    if (impact.later && time === check.at) impact.shareLater = share;
  }
}

/**
 * Treasures turn up at random, often realms after they become findable, so
 * instead of measuring when the bot finds one, measure what a level-1 copy
 * would add on first entering its realm and on first reaching the realm's last stage.
 */
const treasureCheckedStages = new Set<number>();
function trackTreasures(): void {
  const stage = STAGES[state.stage];
  const realm = REALMS[stage.realmIndex];
  const isLast = stage.stageInRealm === realm.stageNames.length - 1;
  if ((!stage.isMajor && !isLast) || treasureCheckedStages.has(state.stage)) return;
  treasureCheckedStages.add(state.stage);
  for (const t of TREASURES.filter((t) => t.minRealm === realm.id)) {
    const withIt = structuredClone(state);
    withIt.treasures[t.id] = 1;
    const without = structuredClone(state);
    delete without.treasures[t.id];
    const mults = multipliers(withIt, without);
    const key = `treasure:${t.id}`;
    const existing = impacts.get(key);
    if (existing) existing.later = mults;
    else {
      impacts.set(key, {
        kind: `treasure (${t.rarity})`,
        name: t.name,
        stage: stageName(state.stage),
        loop: state.prestige.loops,
        costSeconds: 0,
        ...mults,
        ...(isLast && !stage.isMajor ? { later: mults } : {}),
      });
    }
  }
}

function spend(): void {
  let bought = true;
  while (bought) {
    bought = false;
    let stats = computeStats(state);
    const next = nextStage(state);
    const nextCost = next ? breakthroughCost(state, next.index) : Infinity;
    if (next && state.qi >= nextCost) {
      const result = attemptBreakthrough(state, stats.mods, rng);
      if (result !== 'blocked') {
        while (state.tribulation) recordTribulationTrial(state, TRIBULATION_TRIAL_SCORE);
        recordWait();
        lastProgress = time;
        bought = true;
        continue;
      }
    }
    for (const u of availableUpgrades(state)) {
      if (u.cost <= state.qi && buyUpgrade(state, u.id)) {
        bought = true;
        activity().techniques++;
        recordImpact(`upgrade:${u.id}`, 'technique', u.name, u.cost, (s) => {
          delete s.upgrades[u.id];
        });
      }
    }
    stats = computeStats(state);
    for (const element of CORE_ORDER) {
      const cost = coreFormCost(stats.mods, state.cores.length);
      if (canFormCore(state, stats.mods, element) && state.qi >= cost) {
        formCore(state, stats.mods, element);
        bought = true;
        recordImpact(`core:${element}`, 'core', `form ${element} core`, cost, (s) => {
          s.cores.pop();
        });
      }
    }
    state.cores.forEach((core, i) => {
      const cost = coreRefineCost(state, stats.mods, i);
      if (canRefineCore(state, i) && state.qi >= cost * 2) {
        refineCore(state, stats.mods, i);
        bought = true;
        const grade = CORE_GRADES[core.grade].name;
        recordImpact(
          `refine:${core.element}:${core.grade}`,
          'core',
          `${core.element} → ${grade}`,
          cost,
          (s) => {
            s.cores[i].grade--;
          },
        );
      }
    });
    // Save up for a breakthrough if it's within a few minutes of income.
    const reserve = nextCost < stats.qps * 180 ? nextCost : 0;
    stats = computeStats(state);
    let best: { id: string; ratio: number; cost: number } | null = null;
    GENERATORS.forEach((g, i) => {
      if (!isGeneratorVisible(state, i)) return;
      const cost = generatorCost(state, stats.mods, g.id);
      const ratio = stats.generatorUnitQps[g.id] / cost;
      if (!best || ratio > best.ratio) best = { id: g.id, ratio, cost };
    });
    const b = best as { id: string; cost: number } | null;
    if (b && state.qi - b.cost >= reserve && buyGenerator(state, stats.mods, b.id)) {
      bought = true;
      activity().generatorsBought++;
      if (state.generators[b.id] === 1) activity().firstBought.push(b.id);
      recordImpact(
        `generator:${b.id}`,
        'resource',
        generatorName(b.id),
        b.cost,
        (s) => {
          s.generators[b.id]--;
        },
        b.id,
      );
    }
  }
}

/**
 * Seconds spent in each realm per loop, and the loop that first completed it
 * (left it for the next realm). Loops up to that one are the realm's first
 * visits, which shouldn't be skipped; later loops are replays, which should be quick.
 */
interface RealmVisits {
  seconds: Map<number, number>;
  completedLoop?: number;
}
const realmVisits: RealmVisits[] = [];
let previousRealm = 0;
function trackRealmVisits(): void {
  const r = STAGES[state.stage].realmIndex;
  const loop = state.prestige.loops;
  const left = realmVisits[previousRealm];
  if (r > previousRealm && left && left.completedLoop === undefined) left.completedLoop = loop;
  previousRealm = r;
  const v = (realmVisits[r] ??= { seconds: new Map() });
  v.seconds.set(loop, (v.seconds.get(loop) ?? 0) + 1);
}

/** Where active-play income comes from: "gen 40% auto 10% gather 5% click 25% motes 20%". */
function incomeSources(): string {
  const stats = computeStats(state, false);
  const sources = {
    gen: stats.generatorQps,
    auto: stats.autoClickQps,
    gather: stats.autoMoteQps,
    click: clicksPerSecond * stats.clickPower,
    motes: stats.moteSpawnPerSecond * MOTE_CATCH_RATE * stats.moteValue,
  };
  const total = Object.values(sources).reduce((a, b) => a + b, 0);
  return Object.entries(sources)
    .map(([k, v]) => `${k} ${String(Math.round((v / total) * 100)).padStart(2)}%`)
    .join(' ');
}

function report(label: string): void {
  const stats = computeStats(state);
  console.log(
    `${formatDuration(time).padStart(8)}  loop ${state.prestige.loops}  ${label.padEnd(44)} qi/s ${formatNumber(stats.qps).padStart(9)}  mem ${String(state.prestige.memories).padStart(4)}  ${incomeSources()}`,
  );
}

while (time < maxHours * 3600) {
  const stats = computeStats(state);
  if (isActive()) {
    for (let i = 0; i < clicksPerSecond; i++) click(state, stats);
    absorbMotes(state, stats, stats.moteSpawnPerSecond * MOTE_CATCH_RATE);
    if (state.encounter.active) claimEncounter(state, stats, rng);
    const trial = acceptTrial(state);
    if (trial) completeTrial(state, stats, trial, OPTIONAL_TRIAL_SCORE, rng);
  }
  tick(state, 1, rng);
  time++;
  activity().seconds++;
  // Idle players don't shop or face tribulations; they catch up when they check in.
  if (isActive()) spend();
  trackRealmVisits();
  if (printImpact) {
    trackLaterImpact();
    trackTreasures();
  }

  const realmIndex = STAGES[state.stage].realmIndex;
  if (!reachedRealm.has(realmIndex + state.prestige.loops * 100)) {
    reachedRealm.add(realmIndex + state.prestige.loops * 100);
    report(`reached ${stageName(state.stage)}`);
  }
  if (state.flags.ascended) {
    report('ASCENDED');
    break;
  }

  const pending = pendingMemories(state);
  const stalled = time - lastProgress > STALL_SECONDS;
  const { memoryMult: memoryMultBefore, mods } = computeStats(state);
  const memoryGain = (memoryMultBefore + pending * mods.memoryBonus) / memoryMultBefore;
  if (
    isActive() &&
    !regressionBlocker(state) &&
    (stalled || memoryGain >= REGRESS_AT_MEMORY_GAIN)
  ) {
    recordWait();
    const wait = `longest wait ${formatDuration(loopLongestWait.seconds)} at ${stageName(loopLongestWait.stage)}`;
    loopLongestWait = { seconds: 0, stage: 0 };
    const label = `regress (+${pending} memories${stalled ? ', stalled' : ''}`;
    state = regress(state, 0)!;
    realmActivity = {};
    lastProgress = time;
    let boughtPerk = true;
    while (boughtPerk) {
      boughtPerk = false;
      for (const p of PERKS)
        if (perkStatus(state, p.id) === 'available')
          boughtPerk = buyPerk(state, p.id) || boughtPerk;
    }
    report(`${label}, ×${(computeStats(state).memoryMult / memoryMultBefore).toFixed(2)})`);
    console.log(`          ${wait}`);
  }
}

console.log(
  `\nFinal: ${stageName(state.stage)} after ${formatDuration(time)}, ${state.prestige.loops} regressions`,
);
const sortedWaits = [...waits].sort((a, b) => b - a);
console.log(
  `Waits between breakthroughs: longest ${sortedWaits.slice(0, 3).map(formatDuration).join(', ')}; ${waits.filter((w) => w > 15 * 60).length} over 15m, ${waits.filter((w) => w > 30 * 60).length} over 30m`,
);
console.log('Final loop by realm:');
for (const [realm, r] of Object.entries(realmActivity)) {
  console.log(
    `  ${realm.padEnd(26)} ${formatDuration(r.seconds).padStart(8)}  bought ${String(r.generatorsBought).padStart(5)} resources, ${String(r.techniques).padStart(3)} techniques  ${r.firstBought.length ? `first bought: ${r.firstBought.join(', ')}` : ''}`,
  );
}
console.log(
  'Realm visits: time spent before first completing it (and over how many loops); median time per later loop:',
);
realmVisits.forEach((v, r) => {
  if (!v || r === 0) return;
  const done = v.completedLoop ?? Infinity;
  const loops = [...v.seconds.keys()];
  const before = loops.filter((l) => l <= done);
  const firstVisits = before.reduce((sum, l) => sum + v.seconds.get(l)!, 0);
  const replays = loops
    .filter((l) => l > done)
    .map((l) => v.seconds.get(l)!)
    .sort((a, b) => a - b);
  const median = replays.length ? formatDuration(replays[Math.floor(replays.length / 2)]) : '—';
  console.log(
    `  ${REALMS[r].name.padEnd(26)} ${formatDuration(firstVisits).padStart(8)} over ${before.length} loop${before.length === 1 ? ' ' : 's'}${v.completedLoop === undefined ? ' (never completed)' : ''}   replays ${median.padStart(8)}`,
  );
});
const treasureLevels = Object.values(state.treasures);
console.log(
  `Treasures: ${treasureLevels.length}/${TREASURES.length} found, levels ${treasureLevels.reduce((a, b) => a + b, 0)}/${TREASURES.length * MAX_TREASURE_LEVEL}`,
);
if (printImpact) {
  const pct = (n: number | undefined) => (n === undefined ? '' : `${Math.round(n * 100)}%`);
  const fixed = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '—');
  const mult = (first: number, peak?: number) =>
    (fixed(first) + (peak === undefined ? '' : `→${fixed(peak)}`)).padStart(10);
  console.log(
    '\nImpact when first bought → 5 minutes later (income with ÷ without, buffs excluded; cost in seconds of average income).',
  );
  console.log(
    'Treasures: what a level-1 copy would add on first entering its realm → first reaching its last stage.',
  );
  console.log(
    `  ${'kind'.padEnd(20)} ${'name'.padEnd(34)} ${'first at'.padEnd(36)} ${'loop'.padStart(4)} ${'cost'.padStart(9)} ${'×idle'.padStart(10)} ${'×active'.padStart(10)}  share +5m / peak`,
  );
  for (const i of impacts.values()) {
    console.log(
      `  ${i.kind.padEnd(20)} ${i.name.padEnd(34)} ${i.stage.padEnd(36)} ${String(i.loop).padStart(4)} ${formatDuration(i.costSeconds).padStart(9)} ${mult(i.passiveMult, i.later?.passiveMult)} ${mult(i.activeMult, i.later?.activeMult)}  ${pct(i.shareLater)} ${i.generatorId ? '/' : ''} ${pct(i.peakShare)}`,
    );
  }
  const unbought = UPGRADES.filter((u) => !impacts.has(`upgrade:${u.id}`)).map((u) => u.name);
  console.log(`Techniques never bought: ${unbought.join(', ') || 'none'}`);
}
console.log(`Realms: ${REALMS.length}, stages: ${STAGES.length}, elements: ${ELEMENTS.length}`);
