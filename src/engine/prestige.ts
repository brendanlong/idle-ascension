import { generatorCount } from '../content/generators';
import { MEMORIES } from '../content/memories';
import { PERKS, PERKS_BY_ID, STASH_GENERATORS, type PerkDef } from '../content/perks';
import { FINAL_STAGE, firstStageOfRealm } from '../content/realms';
import { log } from './events';
import { createInitialState, type GameState } from './state';
import { computeModifiers } from './stats';

const REGRESSION_REALM = 'coreFormation';
/** Memories gained by regressing from a given stage: exponential in how deep you got (see MEMORIES). */
export function memoriesForStage(stage: number): number {
  const first = firstStageOfRealm(REGRESSION_REALM);
  if (stage < first) return 0;
  return Math.floor(
    MEMORIES.first * MEMORIES.growthPerStage ** (Math.min(stage, FINAL_STAGE) - first),
  );
}

/**
 * Memories settle over the first part of each life: regressing sooner gives
 * that share of them, so repeated quick regressions can't compound.
 */
export const MEMORY_SETTLE_SECONDS = 10 * 60;

export function memorySettledFraction(state: GameState): number {
  return Math.min(1, state.stats.loopTime / MEMORY_SETTLE_SECONDS);
}

export function pendingMemories(state: GameState): number {
  return Math.floor(memoriesForStage(state.stage) * memorySettledFraction(state));
}

export function regressionBlocker(state: GameState): string | null {
  if (state.stage < firstStageOfRealm(REGRESSION_REALM)) {
    return 'Your soul is too weak to survive the return. Reach Core Formation first.';
  }
  if (pendingMemories(state) < 1) return 'You would gain no Memories.';
  if (state.tribulation) return 'Not in the middle of a tribulation!';
  return null;
}

/** Returns the next loop's starting state, or null if regression isn't allowed right now. */
export function regress(state: GameState, now = Date.now()): GameState | null {
  if (regressionBlocker(state)) return null;
  const gained = pendingMemories(state);
  const fresh = createInitialState(now);
  const prestige = {
    ...state.prestige,
    memories: state.prestige.memories + gained,
    loops: state.prestige.loops + 1,
  };
  const keptLevel = specialPerkLevel(prestige.perks, 'keepTreasures');
  const treasures = Object.fromEntries(
    Object.entries(state.treasures)
      .map(([id, level]) => [id, Math.min(level, keptLevel)] as const)
      .filter(([, level]) => level > 0),
  );

  const next: GameState = {
    ...fresh,
    qiEarnedTotal: state.qiEarnedTotal,
    prestige,
    treasures,
    stats: { ...state.stats, loopClicks: 0, loopTime: 0 },
    flags: { ...state.flags },
    settings: { ...state.settings },
  };

  const mods = computeModifiers(next);
  const maxStartingStage = firstStageOfRealm('foundation') - 1;
  next.stage = Math.min(Math.floor(mods.startingStage), maxStartingStage);

  const stash = stashGenerators(specialPerkLevel(prestige.perks, 'startingResources'));
  for (const [id, count] of Object.entries(stash)) next.generators[id] += count;

  log(`You return to the beginning, carrying ${gained} new Memories.`, 'epic');
  return next;
}

function specialPerkLevel(
  perks: Record<string, number>,
  special: NonNullable<PerkDef['special']>,
): number {
  return PERKS.filter((p) => p.special === special).reduce(
    (level, p) => level + (perks[p.id] ?? 0),
    0,
  );
}

/** Total generators the Buried Stash grants at a given level. */
export function stashGenerators(level: number): Record<string, number> {
  const total: Record<string, number> = {};
  for (const bundle of STASH_GENERATORS.slice(0, level)) {
    for (const [id, count] of Object.entries(bundle)) total[id] = (total[id] ?? 0) + count;
  }
  return total;
}

/** What a special (non-Effect) perk does at a given level, for display. */
export function describeSpecialPerk(perk: PerkDef, level: number): string | null {
  switch (perk.special) {
    case 'startingResources': {
      const items = Object.entries(stashGenerators(level)).map(([id, n]) => generatorCount(id, n));
      return `Start each loop with ${items.join(', ')}`;
    }
    case 'keepTreasures':
      return `Keep each treasure at up to level ${level} when you regress`;
    case undefined:
      return null;
  }
}

/** Stages in a realm after Qi Condensation, for pricing perk levels. */
const STAGES_PER_REALM = 4;

/**
 * Each level of a perk costs as much more than the last as a regression
 * yields one realm deeper, so regressing once per realm buys about a level of
 * each perk.
 */
function perkLevelGrowth(): number {
  return MEMORIES.growthPerStage ** STAGES_PER_REALM;
}

/**
 * Perks are priced from the Memories a regression yields, so at any depth the
 * next level of every perk costs a share of one regression there: you choose
 * a few each time, and regressing again from the same depth buys the rest.
 */
export function perkCost(perk: PerkDef, currentLevel: number): number {
  const memories = memoriesForStage(firstStageOfRealm(perk.firstRealm));
  return Math.ceil(perk.share * memories * perkLevelGrowth() ** currentLevel);
}

export function spentMemories(state: GameState): number {
  let spent = 0;
  for (const perk of PERKS) {
    const level = state.prestige.perks[perk.id] ?? 0;
    for (let l = 0; l < level; l++) spent += perkCost(perk, l);
  }
  return spent;
}

export function availableMemories(state: GameState): number {
  return state.prestige.memories - spentMemories(state);
}

export type PerkStatus = 'maxed' | 'locked' | 'unaffordable' | 'available';

export function perkStatus(state: GameState, perkId: string): PerkStatus {
  const perk = PERKS_BY_ID.get(perkId)!;
  const level = state.prestige.perks[perkId] ?? 0;
  if (level >= perk.maxLevel) return 'maxed';
  if (perk.requires?.some((r) => !(state.prestige.perks[r] ?? 0))) return 'locked';
  if (perk.minRealm && state.stats.bestStage < firstStageOfRealm(perk.minRealm)) return 'locked';
  if (availableMemories(state) < perkCost(perk, level)) return 'unaffordable';
  return 'available';
}

export function buyPerk(state: GameState, perkId: string): boolean {
  if (perkStatus(state, perkId) !== 'available') return false;
  state.prestige.perks[perkId] = (state.prestige.perks[perkId] ?? 0) + 1;
  log(`Insight gained: ${PERKS_BY_ID.get(perkId)!.name}.`, 'good');
  return true;
}
