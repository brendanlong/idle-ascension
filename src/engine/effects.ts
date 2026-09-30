/**
 * Every bonus in the game (upgrades, treasures, perks, cores, buffs, realms)
 * is expressed as a list of Effects, which fold into a single Modifiers object.
 * To add a new kind of bonus, add a field to Modifiers and describe it in
 * STAT_LABELS; everything else picks it up automatically.
 */

export interface Modifiers {
  globalMult: number;
  generatorMult: Record<string, number>;
  generatorCostMult: number;
  clickMult: number;
  clickFlat: number;
  /** Fraction of qi/s added to each click. */
  clickQpsFraction: number;
  moteValueMult: number;
  moteSpawnMult: number;
  encounterRateMult: number;
  /** Subtracted from a tribulation's pass mark. */
  tribulationLeniency: number;
  /** Tribulation trials run this many times slower. */
  tribulationSlowMult: number;
  autoClicksPerSecond: number;
  offlineCapHours: number;
  offlineEfficiency: number;
  coreSlots: number;
  coreCostMult: number;
  memoryBonus: number;
  startingStage: number;
}

export type MultStat =
  | 'globalMult'
  | 'generatorCostMult'
  | 'clickMult'
  | 'moteValueMult'
  | 'moteSpawnMult'
  | 'encounterRateMult'
  | 'tribulationSlowMult'
  | 'coreCostMult';

export type AddStat =
  | 'clickFlat'
  | 'clickQpsFraction'
  | 'tribulationLeniency'
  | 'autoClicksPerSecond'
  | 'offlineCapHours'
  | 'offlineEfficiency'
  | 'coreSlots'
  | 'memoryBonus'
  | 'startingStage';

export type Effect =
  | { type: 'mult'; stat: MultStat; value: number }
  | { type: 'add'; stat: AddStat; value: number }
  | { type: 'generatorMult'; generator: string; value: number };

export function baseModifiers(): Modifiers {
  return {
    globalMult: 1,
    generatorMult: {},
    generatorCostMult: 1,
    clickMult: 1,
    clickFlat: 1,
    clickQpsFraction: 0,
    moteValueMult: 1,
    moteSpawnMult: 1,
    encounterRateMult: 1,
    tribulationLeniency: 0,
    tribulationSlowMult: 1,
    autoClicksPerSecond: 0,
    offlineCapHours: 4,
    offlineEfficiency: 0.5,
    coreSlots: 0,
    coreCostMult: 1,
    memoryBonus: 0.02,
    startingStage: 0,
  };
}

export function applyEffect(mods: Modifiers, effect: Effect): void {
  switch (effect.type) {
    case 'mult':
      mods[effect.stat] *= effect.value;
      break;
    case 'add':
      mods[effect.stat] += effect.value;
      break;
    case 'generatorMult':
      mods.generatorMult[effect.generator] =
        (mods.generatorMult[effect.generator] ?? 1) * effect.value;
      break;
  }
}

export function applyEffects(mods: Modifiers, effects: readonly Effect[]): void {
  for (const e of effects) applyEffect(mods, e);
}

const STAT_LABELS: Record<MultStat | AddStat, string> = {
  globalMult: 'all qi gain',
  generatorCostMult: 'resource costs',
  clickMult: 'cultivation (click) power',
  moteValueMult: 'qi mote value',
  moteSpawnMult: 'qi mote frequency',
  encounterRateMult: 'fortuitous encounter frequency',
  tribulationSlowMult: 'tribulation slowdown',
  coreCostMult: 'core costs',
  clickFlat: 'base click power',
  clickQpsFraction: 'of qi/s added to each click',
  tribulationLeniency: 'tribulation pass marks',
  autoClicksPerSecond: 'automatic clicks per second',
  offlineCapHours: 'hours of closed-door cultivation (offline cap)',
  offlineEfficiency: 'closed-door cultivation efficiency',
  coreSlots: 'core slot',
  memoryBonus: 'qi gain per Memory',
  startingStage: 'starting cultivation stage after regression',
};

const PERCENT_ADD_STATS: ReadonlySet<AddStat> = new Set([
  'clickQpsFraction',
  'offlineEfficiency',
  'memoryBonus',
]);

function trimNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

export function describeEffect(effect: Effect, generatorName?: (id: string) => string): string {
  switch (effect.type) {
    case 'mult':
      return `×${trimNumber(effect.value)} ${STAT_LABELS[effect.stat]}`;
    case 'add': {
      if (effect.stat === 'tribulationLeniency') {
        return `−${trimNumber(effect.value * 100)} points on tribulation pass marks`;
      }
      const sign = effect.value >= 0 ? '+' : '';
      const amount = PERCENT_ADD_STATS.has(effect.stat)
        ? `${trimNumber(effect.value * 100)}%`
        : trimNumber(effect.value);
      return `${sign}${amount} ${STAT_LABELS[effect.stat]}`;
    }
    case 'generatorMult':
      return `×${trimNumber(effect.value)} ${generatorName?.(effect.generator) ?? effect.generator} output`;
  }
}

/** Each level past the first adds this fraction of the level-1 bonus. */
export const LEVEL_BONUS_GROWTH = 0.5;

/** Stats that only make sense as whole numbers; diminishing perks round these down. */
const INTEGER_STATS: ReadonlySet<AddStat> = new Set(['coreSlots', 'startingStage']);

/**
 * The effect with its bonus multiplied by `strength`: ×1.5 at strength 2 is
 * ×2, and +1 is +2. Reductions scale their reciprocal (×0.5 → ×0.33) so they
 * never reach zero.
 */
export function effectAtStrength(effect: Effect, strength: number): Effect {
  if (effect.type === 'add') return { ...effect, value: effect.value * strength };
  const value =
    effect.value < 1
      ? 1 / (1 + (1 / effect.value - 1) * strength)
      : 1 + (effect.value - 1) * strength;
  return { ...effect, value };
}

/** Treasure scaling: each level adds LEVEL_BONUS_GROWTH of the level-1 bonus. */
export function scaleEffect(effect: Effect, level: number): Effect {
  return effectAtStrength(effect, 1 + (level - 1) * LEVEL_BONUS_GROWTH);
}

/** Compound scaling: multipliers multiply each level (×2, ×4, ×8), additions add up. */
export function compoundEffect(effect: Effect, level: number): Effect {
  return { ...effect, value: effect.type === 'add' ? effect.value * level : effect.value ** level };
}

/**
 * Logarithmic scaling, for effects that would break the game if they kept
 * growing at a flat rate: level 1 is the base bonus, and each doubling of the
 * level adds it again (levels 1, 3, 7, 15 give 1×, 2×, 3×, 4× the bonus).
 * Whole-number stats round down.
 */
export function diminishingEffect(effect: Effect, level: number): Effect {
  const scaled = effectAtStrength(effect, Math.log2(1 + level));
  if (scaled.type === 'add' && INTEGER_STATS.has(scaled.stat)) {
    return { ...scaled, value: Math.floor(scaled.value) };
  }
  return scaled;
}
