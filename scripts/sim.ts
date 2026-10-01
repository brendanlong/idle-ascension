/**
 * Headless balance simulation: a greedy bot plays the game and reports how
 * long each milestone takes. Run with `npm run sim -- [hours] [stuckMinutes]`.
 * Environment variables:
 *   SIM_SEED=<n>        a different random seed
 *   SIM_PLAYER=<kind>   taper (default): gathers motes, claims encounters and checks in
 *                       for a share of each 10 minutes that falls from 80% in Qi
 *                       Condensation to 10% in Immortal Ascension (and stays while
 *                       replaying after a regression).
 *                       passive: gathers and claims encounters only in the first two
 *                       realms and while replaying after a regression, but buys the moment
 *                       anything is affordable, to show how the economy paces an idle player.
 *                       active: gathers and checks in all the time.
 *   SIM_ACTIVE=<0-1>    taper player with a fixed share instead
 *   SIM_TREASURES=<x>   random (default), none (encounters never give treasures), or all
 *                       (every treasure at level 1 as soon as its realm is reached)
 *   SIM_IMPACT=1        also print how much each resource, technique, core and treasure adds
 *                       to income when it first becomes available
 */
import { CORE_FORM_COSTS, CORE_GRADES, ELEMENTS, type ElementId } from '../src/content/cores';
import { GENERATORS, generatorName } from '../src/content/generators';
import { UPGRADES } from '../src/content/upgrades';
import { PERKS } from '../src/content/perks';
import { REALMS, STAGES, stageName } from '../src/content/realms';
import { MAX_TREASURE_LEVEL, TREASURES } from '../src/content/treasures';
import {
  attemptBreakthrough,
  breakthroughBlocker,
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

const maxHours = Number(process.argv[2] ?? 48);
/** Share of spawning motes an attentive player sweeps up. */
const MOTE_CATCH_RATE = 0.4;
const PLAYER = process.env.SIM_PLAYER ?? 'taper';
const TREASURE_MODE = process.env.SIM_TREASURES ?? 'random';
const FIXED_ACTIVE_FRACTION = process.env.SIM_ACTIVE ? Number(process.env.SIM_ACTIVE) : null;
/** The passive player still gathers in these early realms (by index). */
const PASSIVE_GATHERS_UNTIL_REALM = 2;
const ACTIVE_CYCLE_SECONDS = 600;
const printImpact = !!process.env.SIM_IMPACT;
/** How well the bot plays elemental trials (0-1), for tribulations and optional offers. */
const TRIBULATION_TRIAL_SCORE = 0.8;
const OPTIONAL_TRIAL_SCORE = 0.7;
/** With no progress step for this long, the bot is stuck and regresses if it can. */
const STUCK_SECONDS = Number(process.argv[3] ?? 10) * 60;
/** The bot also regresses once that would multiply its Memory bonus by this much. */
const REGRESS_AT_MEMORY_GAIN = 4;
/** When stuck, the bot regresses if that would multiply its Memory bonus by at least this. */
const REGRESS_WHEN_STUCK_AT_GAIN = 1.1;
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
 *                everything priced for it (gated resources, techniques, core grades and
 *                slots), and so every later realm too
 *   stageGrowth  multiplies a realm's stage cost growth
 *   price        multiplies single prices: "up:<technique id>", "stage:<index>",
 *                "form:<core number>", "grade:<core grade>"
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
  };
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
  CORE_GRADES.forEach((grade, g) => {
    const realm = REALMS.findIndex((r) => (r.coreGradeCap ?? -1) >= g);
    if (g > 0) scaled(grade, 'refineCost', priceMult[realm]);
  });
  const coreFormation = realmIndex('coreFormation');
  (CORE_FORM_COSTS as number[]).forEach((_, n, costs) => {
    costs[n] *= priceMult[Math.min(coreFormation + n, REALMS.length - 1)];
  });
  for (const [key, factor] of Object.entries(tune.price ?? {})) {
    const [kind, id] = key.split(':');
    if (kind === 'up')
      scaled(
        UPGRADES.find((u) => u.id === id)!,
        'cost',
        factor,
      );
    if (kind === 'stage') scaled(STAGES[Number(id)], 'cost', factor);
    if (kind === 'form') (CORE_FORM_COSTS as number[])[Number(id)] *= factor;
    if (kind === 'grade') scaled(CORE_GRADES[Number(id)], 'refineCost', factor);
  }
  // Breakthroughs must keep getting more expensive.
  STAGES.forEach((st, i) => {
    if (i > 1) (st as { cost: number }).cost = Math.max(st.cost, STAGES[i - 1].cost * 1.3);
  });
}

/**
 * Each technique, core and breakthrough the first time it's bought: how long
 * since the previous first-time purchase (the wait for something new,
 * including any regressing and replaying in between), and its price in
 * seconds of passive qi/s. Printed as JSON with SIM_PRICES, for tuning.
 */
const firstBuys: Record<string, { wait: number; seconds: number; realm: string; loop: number }> =
  {};
let lastNewPurchaseAt = 0;
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
      form: CORE_FORM_COSTS,
      grade: CORE_GRADES.map((g) => g.refineCost),
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

function recordPurchase(key: string, cost: number): void {
  if (key.startsWith('gen:')) return;
  if (!firstBuys[key]) {
    const qps = computeStats(state, false).qps;
    firstBuys[key] = {
      wait: time - lastNewPurchaseAt,
      seconds: qps > 0 ? cost / qps : Infinity,
      realm: REALMS[STAGES[state.stage].realmIndex].id,
      loop: state.prestige.loops,
    };
    if (key.startsWith('up:')) techniquesThisTick++;
    lastNewPurchaseAt = time;
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
/** Stuck regressions whose next loop got no further: Memories didn't get the player over the hump. */
let futileRegressions = 0;
let loopBestStage = 0;
let previousLoop: { best: number; stuck: boolean } | null = null;

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
    return isReplaying() || STAGES[state.stats.bestStage].realmIndex <= PASSIVE_GATHERS_UNTIL_REALM;
  return inTaperWindow();
}

/** Buying, breaking through and regressing. */
function isCheckedIn(): boolean {
  return PLAYER === 'taper' ? inTaperWindow() : true;
}

/** Qi/s while idle (passive) and while gathering motes (active), buffs excluded. */
function income(s: GameState): { passive: number; active: number } {
  const stats = computeStats(s, false);
  const gathered = stats.moteSpawnPerSecond * MOTE_CATCH_RATE * stats.moteValue;
  return { passive: stats.qps, active: stats.qps + gathered };
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
/**
 * On first reaching each realm, how cost-effective each resource is (next
 * unit's qi/s per qi) compared with the best one: SIM_IMPACT prints the
 * multiplier an old resource would need to be the best deal again.
 */
const resourceEfficiency: { realm: string; byGenerator: Record<string, number> }[] = [];
const efficiencyCheckedRealms = new Set<number>();
function trackResourceEfficiency(): void {
  const realm = STAGES[state.stage].realmIndex;
  if (efficiencyCheckedRealms.has(realm)) return;
  efficiencyCheckedRealms.add(realm);
  const stats = computeStats(state, false);
  const efficiency: Record<string, number> = {};
  GENERATORS.forEach((g, i) => {
    if (!isGeneratorVisible(state, i)) return;
    efficiency[g.id] = stats.generatorUnitQps[g.id] / generatorCost(state, stats.mods, g.id);
  });
  const best = Math.max(...Object.values(efficiency));
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
      cost: breakthroughCost(state, next.index),
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
  const element = CORE_ORDER.find((e) => canFormCore(state, stats.mods, e));
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
    if (!choice.buy()) return;
    recordPurchase(key, cost);
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
    absorbMotes(state, stats, stats.moteSpawnPerSecond * MOTE_CATCH_RATE);
    if (state.encounter.active) claimEncounter(state, stats, rng);
    const trial = acceptTrial(state);
    if (trial) completeTrial(state, stats, trial, OPTIONAL_TRIAL_SCORE, rng);
    if (TREASURE_MODE === 'none') state.treasures = treasuresBefore;
  }
  tick(state, 1, rng);
  time++;
  activity().seconds++;
  if (isCheckedIn()) spend();
  if (TREASURE_MODE === 'all') grantAllTreasures();
  if (computeStats(state, false).qps >= lastStepIncome * STEP_INCOME_GAIN) recordStep();
  if (time % 60 === 0) ratioSamples[STAGES[state.stage].realmIndex].push(activeRatio());
  trackRealmVisits();
  if (printImpact) {
    trackLaterImpact();
    trackTreasures();
    trackResourceEfficiency();
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
    ((stuck && memoryGain >= REGRESS_WHEN_STUCK_AT_GAIN) || memoryGain >= REGRESS_AT_MEMORY_GAIN)
  ) {
    if (stuck) stuckRegressions++;
    if (previousLoop?.stuck && loopBestStage <= previousLoop.best) futileRegressions++;
    previousLoop = { best: loopBestStage, stuck };
    const label = `regress (+${pending} memories${stuck ? `, stuck at ${stageName(state.stage)}` : ''}`;
    state = regress(state, 0)!;
    lastRegression = time;
    loopBestStage = 0;
    realmActivity = {};
    let boughtPerk = true;
    while (boughtPerk) {
      boughtPerk = false;
      for (const p of PERKS)
        if (perkStatus(state, p.id) === 'available')
          boughtPerk = buyPerk(state, p.id) || boughtPerk;
    }
    recordStep();
    report(`${label}, ×${(computeStats(state).memoryMult / memoryMultBefore).toFixed(2)})`);
  }
}

console.log(
  `\nFinal: ${stageName(state.stage)} after ${formatDuration(time)}, ${state.prestige.loops} regressions`,
);
const lateGaps = stepGaps
  .filter((g) => g.realm > PASSIVE_GATHERS_UNTIL_REALM)
  .map((g) => g.seconds)
  .sort((a, b) => b - a);
console.log(
  `Gaps between actions after the early game: longest ${lateGaps.slice(0, 3).map(formatDuration).join(', ')}; ${lateGaps.filter((g) => g > 10 * 60).length} over 10m; stuck regressions ${stuckRegressions} (${futileRegressions} futile)`,
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
if (process.env.SIM_PRICES) console.log(`PRICES ${JSON.stringify(firstBuys)}`);
console.log(`Realms: ${REALMS.length}, stages: ${STAGES.length}, elements: ${ELEMENTS.length}`);
