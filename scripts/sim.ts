/**
 * Headless balance simulation: a greedy bot plays the game and reports how
 * long each milestone takes. Run with `npm run sim -- [hours]`.
 * Environment variables:
 *   SIM_SEED=<n>        a different random seed
 *   SIM_PLAYER=<kind>   taper (default): gathers motes, claims encounters and checks in
 *                       for a share of each 10 minutes that falls from 80% in Qi
 *                       Condensation to 10% in Immortal Ascension (and stays while
 *                       replaying after a regression).
 *                       passive: gathers and claims encounters only to get started (under
 *                       1 qi/s) and while replaying after a regression, but buys the moment
 *                       anything is affordable, to show how the economy paces an idle player.
 *                       active: gathers and checks in all the time.
 *   SIM_ACTIVE=<0-1>    taper player with a fixed share instead
 *   SIM_REGRESS=<mode>  efficient (default), never or eager: see REGRESS_MODE
 *   SIM_SPEC=1          print measurements for scripts/balance/spec.py
 *   SIM_NO_CORES=1      never form or refine cores, to see how far the game goes without them
 *   SIM_TREASURES=<x>   random (default), none (encounters never give treasures), or all
 *                       (every treasure at level 1 as soon as its realm is reached)
 *   SIM_IMPACT=1        also print how much each resource, technique, core and treasure adds
 *                       to income when it first becomes available
 */
import { readFileSync } from 'node:fs';
import { CORE_GRADES, CORE_SLOT_REALMS, ELEMENTS, type ElementId } from '../src/content/cores';
import { baseModifiers } from '../src/engine/effects';
import {
  GENERATORS,
  RESOURCE_LADDER,
  generatorName,
  priceResources,
} from '../src/content/generators';
import { MEMORIES } from '../src/content/memories';
import { UPGRADES, priceUpgrades } from '../src/content/upgrades';
import { PERKS, type PerkDef } from '../src/content/perks';
import {
  COST_CURVE,
  REALMS,
  STAGES,
  curveCosts,
  stageName,
  type CostCurve,
} from '../src/content/realms';
import { MAX_TREASURE_LEVEL, TREASURES } from '../src/content/treasures';
import {
  attemptBreakthrough,
  breakthroughBlocker,
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
  generatorCost,
  isGeneratorUnlocked,
  isGeneratorVisible,
} from '../src/engine/economy';
import { claimEncounter } from '../src/engine/encounters';
import { acceptTrial, completeTrial } from '../src/engine/trials';
import { formatDuration, formatNumber } from '../src/engine/format';
import {
  buyPerk,
  perkCost,
  memorySettledFraction,
  pendingMemories,
  perkStatus,
  regress,
  regressionBlocker,
} from '../src/engine/prestige';
import { createInitialState, type GameState } from '../src/engine/state';
import { activeQps, computeStats, revivalMult } from '../src/engine/stats';
import { tick } from '../src/engine/tick';

const maxHours = Number(process.argv[2] ?? 48);
const PLAYER = process.env.SIM_PLAYER ?? 'taper';
const TREASURE_MODE = process.env.SIM_TREASURES ?? 'random';
const FIXED_ACTIVE_FRACTION = process.env.SIM_ACTIVE ? Number(process.env.SIM_ACTIVE) : null;
/** Waits in realms up to this one (by index) are the early game, left out of the late-game gap summary. */
const EARLY_GAME_UNTIL_REALM = 2;
/** The passive player gathers only to get going, until it makes this much qi/s. */
const PASSIVE_STARTUP_QPS = 1;
const ACTIVE_CYCLE_SECONDS = 600;
const printImpact = !!process.env.SIM_IMPACT;
/** SIM_SPEC=1 prints raw measurements as SPEC {json}, for scripts/balance/spec.py to grade. */
const specMode = !!process.env.SIM_SPEC;
const trackImpact = printImpact || specMode;
const BALANCE_SPEC = JSON.parse(
  readFileSync(new URL('./balance/spec.json', import.meta.url), 'utf8'),
) as {
  newResource: { spendSeconds: number };
  sawtooth: { growth: number; boredSeconds: number };
};
/** How well the bot plays elemental trials (0-1), for tribulations and optional offers. */
const TRIBULATION_TRIAL_SCORE = 0.8;
const OPTIONAL_TRIAL_SCORE = 0.7;
/**
 * SIM_REGRESS: when the bot regresses.
 *   efficient (default)  once bored (the next stage is more than the spec's
 *                        sawtooth.boredSeconds away), if regressing would
 *                        multiply the Memory bonus by REGRESS_AT_GAIN: what a
 *                        player does when a big number tempts them (the spec's
 *                        payoff check says whether it was worth it)
 *   never                never, to check regression is optional
 *   eager                also whenever nothing new has been bought for
 *                        STUCK_SECONDS (3 minutes), for any gain
 */
const REGRESS_MODE = process.env.SIM_REGRESS ?? 'efficient';
const NO_CORES = !!process.env.SIM_NO_CORES;
const STUCK_SECONDS = 3 * 60;
const REGRESS_WHEN_STUCK_AT_GAIN = 1.1;
const REGRESS_AT_GAIN = 3;
/**
 * An action: buying a technique, core or breakthrough, regressing, or buying
 * resources worth this much more passive qi/s since the last action.
 */
const STEP_INCOME_GAIN = 1.05;
const CORE_ORDER: ElementId[] = ['wood', 'fire', 'water', 'earth', 'metal'];

/**
 * SIM_TUNE='{"qps":0.5,"shift":{"daoSeeking":0.1},"stageGrowth":{"coreFormation":1.5}}'
 * scales content before the run, for trying balance changes without editing
 * src/content:
 *   qps          multiplies every resource's output
 *   shift        multiplies the cost jump into a realm: that realm's breakthroughs and
 *                everything priced for it (gated resources, techniques), and so every
 *                later realm too
 *   stageGrowth  multiplies a realm's stage cost growth
 *   price        multiplies single prices: "up:<technique id>", "stage:<index>",
 *                "gen:<resource>" (base cost)
 *   genQps       multiplies a resource's output
 *   curve        overrides COST_CURVE (src/content/realms.ts)
 *   memory       overrides MEMORIES (src/content/memories.ts)
 *   ladder       overrides RESOURCE_LADDER (src/content/generators.ts)
 * SIM_PRICES=1 prints, as JSON, each of those prices the first time the bot
 * paid it: the wait since its previous purchase, and its price in seconds of
 * passive qi/s.
 */
function applyTuning(): void {
  if (!process.env.SIM_TUNE) return;
  const tune = JSON.parse(process.env.SIM_TUNE) as {
    qps?: number;
    shift?: Record<string, number>;
    stageGrowth?: Record<string, number>;
    price?: Record<string, number>;
    genQps?: Record<string, number>;
    curve?: Partial<CostCurve>;
    memory?: Partial<typeof MEMORIES>;
    ladder?: Partial<typeof RESOURCE_LADDER>;
  };
  Object.assign(RESOURCE_LADDER, tune.ladder);
  priceResources();
  priceUpgrades();
  if (tune.curve) applyCostCurve(tune.curve);
  Object.assign(MEMORIES, tune.memory);
  const priceMult: number[] = [];
  REALMS.forEach((r, i) => (priceMult[i] = (priceMult[i - 1] ?? 1) * (tune.shift?.[r.id] ?? 1)));
  const realmIndex = (id: string) => REALMS.findIndex((r) => r.id === id);
  const scaled = <T>(item: T, key: keyof T, factor: number) => {
    (item as Record<keyof T, number>)[key] *= factor;
  };
  for (const g of GENERATORS) {
    scaled(g, 'baseQps', tune.qps ?? 1);
    if (!g.minRealm) continue;
    const factor = priceMult[realmIndex(g.minRealm)];
    scaled(g, 'baseCost', factor);
    for (const u of UPGRADES)
      if (u.unlock.type === 'generator' && u.unlock.id === g.id) scaled(u, 'cost', factor);
  }
  for (const u of UPGRADES)
    if (u.unlock.type === 'realm') scaled(u, 'cost', priceMult[realmIndex(u.unlock.realm)]);
  for (const st of STAGES) {
    const growth = tune.stageGrowth?.[REALMS[st.realmIndex].id] ?? 1;
    scaled(st, 'cost', priceMult[st.realmIndex] * growth ** st.stageInRealm);
  }
  for (const [id, factor] of Object.entries(tune.genQps ?? {}))
    scaled(
      GENERATORS.find((g) => g.id === id)!,
      'baseQps',
      factor,
    );
  for (const [key, factor] of Object.entries(tune.price ?? {})) {
    const [kind, id] = key.split(':');
    if (kind === 'gen')
      scaled(
        GENERATORS.find((g) => g.id === id)!,
        'baseCost',
        factor,
      );
    if (kind === 'up')
      scaled(
        UPGRADES.find((u) => u.id === id)!,
        'cost',
        factor,
      );
    if (kind === 'stage') scaled(STAGES[Number(id)], 'cost', factor);
  }
}

function applyCostCurve(curve: Partial<CostCurve>): void {
  Object.assign(COST_CURVE, curve);
  setStageCosts(curveCosts(COST_CURVE, STAGES.length));
}

/**
 * Sets every breakthrough cost, and re-prices what follows it: resources
 * (priceResources) and techniques (priceUpgrades).
 */
function setStageCosts(costs: number[]): void {
  STAGES.forEach((st, i) => ((st as { cost: number }).cost = costs[i]));
  for (const st of STAGES)
    (REALMS[st.realmIndex].stageCosts as number[])[st.stageInRealm] = st.cost;
  priceResources();
  priceUpgrades();
}

/**
 * Each technique, core and breakthrough the first time it's bought: how long
 * since the previous first-time purchase (the wait for something new,
 * including any regressing and replaying in between), and its price in
 * seconds of passive qi/s. Printed as JSON with SIM_PRICES, for tuning.
 */
const firstBuys: Record<
  string,
  {
    wait: number;
    seconds: number;
    realm: string;
    loop: number;
    efficiency?: number;
    /** Regressions since the previous first-time purchase: how many it took to reach this. */
    regressions: number;
  }
> = {};
/** SIM_SPEC: the first time each technique, core grade, resource, stage and insight level was bought. */
const newThings: { t: number; key: string }[] = [];
const newThingKeys = new Set<string>();
/** SIM_SPEC: when each stage was first reached, in any life. */
const stageReached: number[] = [0];
/**
 * SIM_SPEC: for each stage, how long the life that first reached it took to
 * get there from the previous stage (so a regression's replay isn't counted).
 */
const stageSeconds: number[] = [0];
/** When the current life reached each stage. */
let lifeStageAt: number[] = [];
/**
 * SIM_SPEC: each regression, how long waiting would have taken instead, and
 * how many stages further a second regression from the same place would
 * carry the player (its Memory gain in stages of sawtooth growth).
 */
const regressions: { t: number; from: number; wait: number; repeatStages: number }[] = [];
/** SIM_SPEC: gathering ÷ idle income each minute at the frontier (not replaying), by realm. */
const frontierRatios: number[][] = REALMS.map(() => []);
/**
 * SIM_SPEC: for each resource when it's first bought, its total output after
 * learning its first technique and spending newResource.spendSeconds of
 * income on it, as a share of all the other resources' output (none when
 * nothing else produces yet).
 */
const newResourceShares: { id: string; realm: string; share: number | null }[] = [];
let lastNewPurchaseAt = 0;
let loopAtLastNewPurchase = 0;
/** First-time techniques bought in the same moment: "you can buy several at once". */
const bursts: { realm: number; count: number }[] = [];
let techniquesThisTick = 0;

applyTuning();
if (process.env.SIM_DUMP_PRICES) {
  // Prices after SIM_TUNE, for writing tuned values back into src/content.
  console.log(
    JSON.stringify({
      up: Object.fromEntries(UPGRADES.map((u) => [u.id, u.cost])),
      stage: STAGES.map((st) => st.cost),
      form: CORE_SLOT_REALMS.map((_, n) => coreFormCost(baseModifiers(), n)),
      gen: Object.fromEntries(GENERATORS.map((g) => [g.id, [g.baseCost, g.baseQps]])),
    }),
  );
  process.exit(0);
}

let seed = Number(process.env.SIM_SEED ?? 12345);
const rng = () => {
  seed = (seed * 1664525 + 1013904223) % 2 ** 32;
  return seed / 2 ** 32;
};

let state: GameState = createInitialState(0);
state.flags.introSeen = true;
let time = 0;

/** A resource's next unit's qi/s per qi, relative to the best other visible resource. */
function relativeEfficiency(id: string): number {
  const stats = computeStats(state, false);
  const efficiency = (gid: string) =>
    stats.generatorUnitQps[gid] / generatorCost(state, stats.mods, gid);
  const others = GENERATORS.filter((g, i) => g.id !== id && isGeneratorVisible(state, i));
  return efficiency(id) / Math.max(...others.map((g) => efficiency(g.id)));
}

function recordPurchase(key: string, cost: number, efficiency?: number): void {
  if (!newThingKeys.has(key)) {
    newThingKeys.add(key);
    newThings.push({ t: time, key });
  }
  if (key.startsWith('gen:')) {
    // Resources: only the first unit of a realm-gated one is a new purchase.
    const def = GENERATORS.find((g) => `gen:${g.id}` === key)!;
    if (!def.minRealm || firstBuys[key]) return;
  }
  if (!firstBuys[key]) {
    const qps = computeStats(state, false).qps;
    firstBuys[key] = {
      wait: time - lastNewPurchaseAt,
      seconds: qps > 0 ? cost / qps : Infinity,
      realm: REALMS[STAGES[state.stage].realmIndex].id,
      loop: state.prestige.loops,
      efficiency,
      regressions: state.prestige.loops - loopAtLastNewPurchase,
    };
    if (key.startsWith('up:')) techniquesThisTick++;
    lastNewPurchaseAt = time;
    loopAtLastNewPurchase = state.prestige.loops;
    newPurchasesThisLoop++;
  }
  recordStep();
}
/**
 * Gaps between progress steps, by the realm the wait happened in: how long
 * the player goes without anything meaningfully better.
 */
let lastStep = 0;
let lastStepIncome = 0;
const stepGaps: { seconds: number; realm: number }[] = [];
function recordStep(): void {
  stepGaps.push({ seconds: time - lastStep, realm: STAGES[state.stage].realmIndex });
  lastStep = time;
  lastStepIncome = computeStats(state, false).qps;
}
let stuckRegressions = 0;
/** Stuck regressions whose next life bought nothing new: Memories didn't get the player over the hump. */
let futileRegressions = 0;
let loopBestStage = 0;
let newPurchasesThisLoop = 0;
/** How long each regression took to get back to the previous life's furthest stage. */
const replayTimes: number[] = [];
let replayTarget: number | null = null;
let previousLoopStuck = false;

/** Active ÷ passive income, sampled each minute by realm. */
const ratioSamples: number[][] = REALMS.map(() => []);

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

/** Default attention by furthest realm reached: Mortal, Qi Condensation, ..., Godhood. */
const ACTIVE_BY_REALM = [0.8, 0.8, 0.7, 0.55, 0.4, 0.3, 0.2, 0.1, 0.1];

function activeFraction(): number {
  return FIXED_ACTIVE_FRACTION ?? ACTIVE_BY_REALM[STAGES[state.stats.bestStage].realmIndex];
}

/** After regressing, the player stays to replay familiar stages, for up to this long. */
const REPLAY_ATTENTION_SECONDS = 15 * 60;
let lastRegression = -Infinity;

function isReplaying(): boolean {
  return state.stage < state.stats.bestStage && time - lastRegression < REPLAY_ATTENTION_SECONDS;
}

function inTaperWindow(): boolean {
  return isReplaying() || time % ACTIVE_CYCLE_SECONDS < ACTIVE_CYCLE_SECONDS * activeFraction();
}

/** Sweeping motes and claiming encounters and trials. */
function isGathering(): boolean {
  if (PLAYER === 'active') return true;
  if (PLAYER === 'passive')
    return isReplaying() || computeStats(state, false).qps < PASSIVE_STARTUP_QPS;
  return inTaperWindow();
}

/** Buying, breaking through and regressing. */
function isCheckedIn(): boolean {
  return PLAYER === 'taper' ? inTaperWindow() : true;
}

/** Qi/s while idle (passive) and while gathering motes (active), buffs excluded. */
function income(s: GameState): { passive: number; active: number } {
  const stats = computeStats(s, false);
  return { passive: stats.qps, active: activeQps(stats) };
}

function repeatRegressionStages(pending: number): number {
  const memoryMult = (extra: number) => {
    const s = structuredClone(state);
    s.prestige.memories += extra;
    return computeStats(s, false).memoryMult;
  };
  return (
    Math.log(memoryMult(2 * pending) / memoryMult(pending)) / Math.log(BALANCE_SPEC.sawtooth.growth)
  );
}

function secondsToNextStage(): number {
  const next = STAGES[state.stage + 1];
  return next ? (next.cost - state.qi) / averageIncome(income(state)) : 0;
}

function averageIncome(i: { passive: number; active: number }): number {
  const share = PLAYER === 'active' ? 1 : PLAYER === 'passive' ? 0 : activeFraction();
  return i.passive + share * (i.active - i.passive);
}

/** Every treasure of the realms reached, at least at level 1 (SIM_TREASURES=all). */
function grantAllTreasures(): void {
  const realm = STAGES[state.stage].realmIndex;
  for (const t of TREASURES) {
    const reached = REALMS.findIndex((r) => r.id === t.minRealm) <= realm;
    if (reached && !state.treasures[t.id]) state.treasures[t.id] = 1;
  }
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
  if (!trackImpact || impacts.has(key)) return;
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
/**
 * On first reaching each realm, how cost-effective each resource is (next
 * unit's qi/s per qi) compared with the best one: SIM_IMPACT prints the
 * multiplier an old resource would need to be the best deal again.
 */
const resourceEfficiency: { realm: string; byGenerator: Record<string, number> }[] = [];
const efficiencyCheckedRealms = new Set<number>();
function trackNewResources(): void {
  GENERATORS.forEach((g, i) => {
    if (i === 0 || !state.generators[g.id] || newResourceShares.some((r) => r.id === g.id)) return;
    const s = structuredClone(state);
    s.generators[g.id] = 0;
    const budget = averageIncome(income(s)) * BALANCE_SPEC.newResource.spendSeconds;
    if (UPGRADES.some((u) => u.id === `${g.id}-1`)) s.upgrades[`${g.id}-1`] = true;
    for (let spent = 0; ; s.generators[g.id]++) {
      const cost = generatorCost(s, computeStats(s, false).mods, g.id);
      if (spent + cost > budget) break;
      spent += cost;
    }
    const stats = computeStats(s, false);
    const total = (id: string) => stats.generatorUnitQps[id] * s.generators[id];
    const others = GENERATORS.filter((o) => o.id !== g.id).reduce((t, o) => t + total(o.id), 0);
    newResourceShares.push({
      id: g.id,
      realm: REALMS[STAGES[state.stage].realmIndex].id,
      share: others > 0 ? total(g.id) / others : null,
    });
  });
}

function trackResourceEfficiency(): void {
  const realm = STAGES[state.stage].realmIndex;
  if (efficiencyCheckedRealms.has(realm)) return;
  efficiencyCheckedRealms.add(realm);
  const stats = computeStats(state, false);
  // Every unlocked resource, even ones not shown yet, against the best visible one.
  const efficiency: Record<string, number> = {};
  let best = 0;
  GENERATORS.forEach((g, i) => {
    if (!isGeneratorUnlocked(state, g)) return;
    efficiency[g.id] = stats.generatorUnitQps[g.id] / generatorCost(state, stats.mods, g.id);
    if (isGeneratorVisible(state, i)) best = Math.max(best, efficiency[g.id]);
  });
  const byGenerator = Object.fromEntries(
    Object.entries(efficiency).map(([id, e]) => [id, best / e]),
  );
  resourceEfficiency.push({ realm: REALMS[realm].name, byGenerator });
}

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

interface Candidate {
  key: string;
  cost: number;
  /** Applies the purchase's effect without paying, returning a function that undoes it. */
  tryOn: () => () => void;
  buy: () => boolean;
}

function candidates(): Candidate[] {
  const stats = computeStats(state);
  const list: Candidate[] = [];
  const next = nextStage(state);
  const blocker = breakthroughBlocker(state);
  if (next && (blocker === null || blocker === 'Not enough qi.')) {
    list.push({
      key: `stage:${next.index}`,
      cost: next.cost,
      tryOn: () => {
        state.stage++;
        return () => state.stage--;
      },
      buy: () => {
        if (attemptBreakthrough(state, stats.mods, rng) === 'blocked') return false;
        while (state.tribulation) recordTribulationTrial(state, TRIBULATION_TRIAL_SCORE);
        if (state.stage > loopBestStage) loopBestStage = state.stage;
        recordStep();
        return true;
      },
    });
  }
  for (const u of availableUpgrades(state)) {
    list.push({
      key: `up:${u.id}`,
      cost: u.cost,
      tryOn: () => {
        if (u.revives) state.revivals[u.revives] = revivalMult(state, u.revives);
        state.upgrades[u.id] = true;
        return () => delete state.upgrades[u.id];
      },
      buy: () => {
        if (!buyUpgrade(state, u.id)) return false;
        activity().techniques++;
        recordImpact(`upgrade:${u.id}`, 'technique', u.name, u.cost, (s) => {
          delete s.upgrades[u.id];
        });
        return true;
      },
    });
  }
  const element = NO_CORES ? undefined : CORE_ORDER.find((e) => canFormCore(state, stats.mods, e));
  if (element) {
    const cost = coreFormCost(stats.mods, state.cores.length);
    list.push({
      key: `form:${state.cores.length}`,
      cost,
      tryOn: () => {
        state.cores.push({ element, grade: 0 });
        return () => state.cores.pop();
      },
      buy: () => {
        if (!formCore(state, stats.mods, element)) return false;
        recordImpact(`core:${element}`, 'core', `form ${element} core`, cost, (s) => {
          s.cores.pop();
        });
        return true;
      },
    });
  }
  if (!NO_CORES)
    state.cores.forEach((core, i) => {
      if (!canRefineCore(state, i)) return;
      const cost = coreRefineCost(state, stats.mods, i);
      list.push({
        key: `grade:${core.grade + 1}`,
        cost,
        tryOn: () => {
          core.grade++;
          return () => core.grade--;
        },
        buy: () => {
          if (!refineCore(state, stats.mods, i)) return false;
          recordImpact(
            `refine:${core.element}:${core.grade}`,
            'core',
            `${core.element} → ${CORE_GRADES[core.grade].name}`,
            cost,
            (s) => {
              s.cores[i].grade--;
            },
          );
          return true;
        },
      });
    });
  GENERATORS.forEach((g, i) => {
    if (!isGeneratorVisible(state, i)) return;
    const cost = generatorCost(state, stats.mods, g.id);
    list.push({
      key: `gen:${g.id}`,
      cost,
      tryOn: () => {
        state.generators[g.id]++;
        return () => state.generators[g.id]--;
      },
      buy: () => {
        if (!buyGenerator(state, stats.mods, g.id)) return false;
        activity().generatorsBought++;
        if (state.generators[g.id] === 1) activity().firstBought.push(g.id);
        recordImpact(
          `generator:${g.id}`,
          'resource',
          generatorName(g.id),
          cost,
          (s) => {
            s.generators[g.id]--;
          },
          g.id,
        );
        return true;
      },
    });
  });
  return list;
}

/**
 * Picks the purchase that pays for itself soonest (time to afford it plus
 * cost ÷ income gained), counting gathered motes as much as this player
 * gathers. Purchases that don't raise income are bought once they're cheap.
 */
function choosePurchase(options: Candidate[]): Candidate | null {
  const now = averageIncome(income(state));
  let best: { c: Candidate; score: number } | null = null;
  for (const c of options) {
    const undo = c.tryOn();
    const gain = averageIncome(income(state)) - now;
    undo();
    let score: number;
    if (now <= 0) score = c.cost <= state.qi ? c.cost : Infinity;
    else if (gain <= now * 1e-9) score = c.cost <= now * 60 ? 0 : Infinity;
    else score = Math.max(0, c.cost - state.qi) / now + c.cost / gain;
    if (!best || score < best.score) best = { c, score };
  }
  return best && Number.isFinite(best.score) ? best.c : null;
}

function spend(): void {
  techniquesThisTick = 0;
  try {
    buyWhatsWorthIt();
  } finally {
    if (techniquesThisTick > 1)
      bursts.push({ realm: STAGES[state.stage].realmIndex, count: techniquesThisTick });
  }
}

function buyWhatsWorthIt(): void {
  for (let purchases = 0; purchases < 10_000; purchases++) {
    const all = candidates();
    // Players break through as soon as they can.
    const breakthrough = all.find((c) => c.key.startsWith('stage:') && c.cost <= state.qi);
    const choice = breakthrough ?? choosePurchase(all);
    if (!choice) return;
    if (state.qi < choice.cost) return; // saving up for it
    const key = choice.key;
    const cost = choice.cost;
    const efficiency = key.startsWith('gen:') ? relativeEfficiency(key.slice(4)) : undefined;
    if (!choice.buy()) return;
    recordPurchase(key, cost, efficiency);
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
  // Several breakthroughs can happen in one tick, so a realm can be entered and left at once.
  for (let passed = previousRealm; passed < r; passed++) {
    const p = (realmVisits[passed] ??= { seconds: new Map([[loop, 0]]) });
    p.completedLoop ??= loop;
  }
  previousRealm = r;
  const v = (realmVisits[r] ??= { seconds: new Map() });
  v.seconds.set(loop, (v.seconds.get(loop) ?? 0) + 1);
}

/** Gathering's boost over idle income right now: "active ×2.4". */
function activeRatio(): number {
  const i = income(state);
  return i.passive > 0 ? i.active / i.passive : Infinity;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function report(label: string): void {
  const stats = computeStats(state);
  console.log(
    `${formatDuration(time).padStart(8)}  loop ${state.prestige.loops}  ${label.padEnd(60)} qi/s ${formatNumber(stats.qps).padStart(9)}  mem ${String(state.prestige.memories).padStart(5)}  active ×${activeRatio().toFixed(1)}`,
  );
}

while (time < maxHours * 3600) {
  const stats = computeStats(state);
  if (isGathering()) {
    const treasuresBefore = { ...state.treasures };
    absorbMotes(state, stats, (activeQps(stats) - stats.qps) / stats.moteValue);
    if (state.encounter.active) claimEncounter(state, stats, rng);
    const trial = acceptTrial(state);
    if (trial) completeTrial(state, stats, trial, OPTIONAL_TRIAL_SCORE, rng);
    if (TREASURE_MODE === 'none') state.treasures = treasuresBefore;
  }
  tick(state, 1, rng);
  time++;
  activity().seconds++;
  if (isCheckedIn()) spend();
  if (replayTarget !== null && state.stage >= replayTarget) {
    replayTimes.push(time - lastRegression);
    replayTarget = null;
  }
  if (TREASURE_MODE === 'all') grantAllTreasures();
  if (computeStats(state, false).qps >= lastStepIncome * STEP_INCOME_GAIN) recordStep();
  if (time % 60 === 0) ratioSamples[STAGES[state.stage].realmIndex].push(activeRatio());
  trackRealmVisits();
  if (trackImpact) {
    trackLaterImpact();
    trackTreasures();
    trackResourceEfficiency();
  }
  if (specMode) {
    for (let s = lifeStageAt.length; s <= state.stage; s++) lifeStageAt.push(time);
    while (stageReached.length <= state.stats.bestStage) {
      stageSeconds.push(time - lifeStageAt[stageReached.length - 1]);
      stageReached.push(time);
    }
    if (time % 60 === 0 && state.stage >= state.stats.bestStage)
      frontierRatios[STAGES[state.stage].realmIndex].push(activeRatio());
    trackNewResources();
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
  // Stuck: nothing new bought for a while (replays and resource buying don't count).
  const stuck = time - Math.max(lastNewPurchaseAt, lastRegression) > STUCK_SECONDS;
  const memoryMultBefore = computeStats(state).memoryMult;
  const canRegress = isCheckedIn() && !regressionBlocker(state);
  // Measured on the regressed state, which may have fewer treasures (and so a smaller Memory bonus).
  const memoryGain = canRegress
    ? computeStats(regress(structuredClone(state), 0)!).memoryMult / memoryMultBefore
    : 0;
  if (
    canRegress &&
    // Wait for Memories to settle so the regression is worth its full amount.
    REGRESS_MODE !== 'never' &&
    memorySettledFraction(state) >= 1 &&
    ((REGRESS_MODE === 'eager' && stuck && memoryGain >= REGRESS_WHEN_STUCK_AT_GAIN) ||
      (memoryGain >= REGRESS_AT_GAIN && secondsToNextStage() > BALANCE_SPEC.sawtooth.boredSeconds))
  ) {
    if (stuck) stuckRegressions++;
    if (previousLoopStuck && newPurchasesThisLoop === 0) futileRegressions++;
    replayTarget = loopBestStage;
    previousLoopStuck = stuck;
    newPurchasesThisLoop = 0;
    regressions.push({
      t: time,
      from: state.stats.bestStage,
      wait: secondsToNextStage(),
      repeatStages: repeatRegressionStages(pending),
    });
    const label = `regress (+${pending} memories${stuck ? `, stuck at ${stageName(state.stage)}` : ''}`;
    state = regress(state, 0)!;
    lastRegression = time;
    lifeStageAt = [];
    loopBestStage = 0;
    realmActivity = {};
    const perksBefore = { ...state.prestige.perks };
    // The priciest insight it can afford first (the big pick), then fill in with the rest.
    for (;;) {
      const affordable = PERKS.filter((p) => perkStatus(state, p.id) === 'available');
      if (!affordable.length) break;
      const level = (p: PerkDef) => state.prestige.perks[p.id] ?? 0;
      affordable.sort((p, q) => perkCost(q, level(q)) - perkCost(p, level(p)));
      buyPerk(state, affordable[0].id);
      const key = `perk:${affordable[0].id}:${level(affordable[0])}`;
      newThings.push({ t: time, key });
    }
    recordStep();
    report(`${label}, ×${(computeStats(state).memoryMult / memoryMultBefore).toFixed(2)})`);
    const learned = PERKS.filter((p) => state.prestige.perks[p.id] !== perksBefore[p.id]).map(
      (p) => `${p.id} ${perksBefore[p.id] ?? 0}→${state.prestige.perks[p.id]}`,
    );
    if (learned.length) console.log(`${' '.repeat(10)}insights: ${learned.join(', ')}`);
  }
}

console.log(
  `\nFinal: ${stageName(state.stage)} after ${formatDuration(time)}, ${state.prestige.loops} regressions`,
);
const lateGaps = stepGaps
  .filter((g) => g.realm > EARLY_GAME_UNTIL_REALM)
  .map((g) => g.seconds)
  .sort((a, b) => b - a);
console.log(
  `Gaps between actions after the early game: longest ${lateGaps.slice(0, 3).map(formatDuration).join(', ')}; ${lateGaps.filter((g) => g > 10 * 60).length} over 10m; stuck regressions ${stuckRegressions} (${futileRegressions} futile); median replay ${formatDuration(replayTimes.length ? median(replayTimes) : 0)}`,
);
console.log(
  'By realm: gap between actions (median / longest); wait for each new technique, core or breakthrough since the last new one (median / longest); times several new techniques were affordable at once; gathering ÷ idle income:',
);
REALMS.forEach((realm, r) => {
  const gaps = stepGaps.filter((g) => g.realm === r).map((g) => g.seconds);
  const ratios = ratioSamples[r].filter(Number.isFinite);
  if (!gaps.length && !ratios.length) return;
  const ratio = ratios.length
    ? `×${median(ratios).toFixed(1)} (${Math.min(...ratios).toFixed(1)}-${Math.max(...ratios).toFixed(1)})`
    : '—';
  const waits = Object.values(firstBuys)
    .filter((b) => b.realm === realm.id)
    .map((b) => b.wait);
  const burstCount = bursts.filter((b) => b.realm === r).length;
  console.log(
    `  ${realm.name.padEnd(26)} gap ${formatDuration(gaps.length ? median(gaps) : 0).padStart(7)} / ${formatDuration(Math.max(0, ...gaps)).padStart(7)}   wait ${formatDuration(waits.length ? median(waits) : 0).padStart(7)} / ${formatDuration(Math.max(0, ...waits)).padStart(7)}   bursts ${String(burstCount).padStart(3)}   active ${ratio}`,
  );
});
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
  console.log(
    '\nOn first reaching each realm, how many times better the best resource is than each other one:',
  );
  for (const { realm, byGenerator } of resourceEfficiency) {
    const list = Object.entries(byGenerator)
      .filter(([, x]) => x > 1)
      .map(([id, x]) => `${id} ×${x.toPrecision(2)}`)
      .join(', ');
    console.log(`  ${realm.padEnd(26)} ${list}`);
  }
  const unbought = UPGRADES.filter((u) => !impacts.has(`upgrade:${u.id}`)).map((u) => u.name);
  console.log(`Techniques never bought: ${unbought.join(', ') || 'none'}`);
}
if (specMode) {
  const firstVisitSeconds = (v: RealmVisits) =>
    [...v.seconds]
      .filter(([l]) => l <= (v.completedLoop ?? Infinity))
      .reduce((t, [, s]) => t + s, 0);
  const replaySeconds = (v: RealmVisits) =>
    median([...v.seconds].filter(([l]) => l > (v.completedLoop ?? Infinity)).map(([, s]) => s));
  console.log(
    `SPEC ${JSON.stringify({
      done: !!state.flags.ascended,
      seconds: time,
      stageReached,
      stageSeconds,
      newThings,
      bursts,
      regressions,
      frontierRatios: frontierRatios.map((r) => (r.length ? median(r) : null)),
      newResourceShares,
      impacts: [...impacts].map(([key, i]) => ({
        key,
        kind: i.kind,
        name: i.name,
        stage: i.stage,
        passive: i.passiveMult,
        active: i.activeMult,
      })),
      realms: realmVisits.map((v, r) =>
        v && r > 0
          ? {
              id: REALMS[r].id,
              firstVisit: firstVisitSeconds(v),
              replay: replaySeconds(v) ?? null,
            }
          : null,
      ),
    })}`,
  );
}
if (process.env.SIM_PRICES) console.log(`PRICES ${JSON.stringify(firstBuys)}`);
console.log(`Realms: ${REALMS.length}, stages: ${STAGES.length}, elements: ${ELEMENTS.length}`);
