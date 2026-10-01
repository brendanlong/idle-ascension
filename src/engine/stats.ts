import { BUFFS_BY_ID } from '../content/buffs';
import { CORE_GRADES, ELEMENTS, ELEMENTS_BY_ID, GENERATING_CYCLE_BONUS } from '../content/cores';
import { GENERATORS } from '../content/generators';
import { MEMORIES } from '../content/memories';
import { PERKS, type PerkDef } from '../content/perks';
import { REALMS, STAGES, firstStageOfRealm } from '../content/realms';
import { TREASURES_BY_ID, type TreasureDef } from '../content/treasures';
import { UPGRADES_BY_ID, type UpgradeDef } from '../content/upgrades';
import {
  applyEffects,
  baseModifiers,
  compoundEffect,
  diminishingEffect,
  scaleEffect,
  type Effect,
  type Modifiers,
} from './effects';
import type { GameState } from './state';

export interface Stats {
  mods: Modifiers;
  realmMult: number;
  memoryMult: number;
  cycleMult: number;
  /** Qi/s produced by a single unit of each generator, after all bonuses. */
  generatorUnitQps: Record<string, number>;
  generatorQps: number;
  /** Qi/s from motes gathered automatically. */
  autoMoteQps: number;
  /** Total passive qi/s. */
  qps: number;
  moteValue: number;
  moteSpawnPerSecond: number;
}

const BASE_MOTE_SPAWN_PER_SECOND = 1;
/** Most motes the field holds at once. */
export const MAX_MOTES = 60;
/**
 * Motes appear faster on an emptier field: this many times the usual rate when
 * it's empty, fading logarithmically to nothing at MAX_MOTES (about the usual
 * rate at 10 waiting). Gathering keeps the field low, so it stays lively,
 * while a field left alone fills up less the faster motes spawn.
 */
const MOTE_EMPTY_FIELD_BOOST = 3;

/**
 * An attentive gatherer catches about this share of motes while keeping about
 * MOTES_LEFT_WHILE_GATHERING waiting on the field (so it refills faster).
 */
const ATTENTIVE_MOTE_CATCH = 0.4;
const MOTES_LEFT_WHILE_GATHERING = 5;

/** Qi/s while actively gathering motes: what qi events are measured in. */
export function activeQps(stats: Stats): number {
  const motes = moteSpawnRate(stats.moteSpawnPerSecond, MOTES_LEFT_WHILE_GATHERING);
  return stats.qps + motes * ATTENTIVE_MOTE_CATCH * stats.moteValue;
}

export function moteSpawnRate(spawnPerSecond: number, motesOnField: number): number {
  const room = Math.log((MAX_MOTES + 1) / (Math.min(motesOnField, MAX_MOTES) + 1));
  return (spawnPerSecond * MOTE_EMPTY_FIELD_BOOST * room) / Math.log(MAX_MOTES + 1);
}
/**
 * A mote is worth this much qi times all qi multipliers, or this many seconds
 * of resource qi/s if that's more, before mote multipliers. Early on the base
 * value carries you; later motes track production.
 */
const MOTE_BASE_VALUE = 5;
const MOTE_QPS_SECONDS = 1;

export function realmMultiplier(stage: number): number {
  let mult = 1;
  for (let i = 1; i <= stage; i++) mult *= REALMS[STAGES[i].realmIndex].stageMultiplier;
  return mult;
}

export function unlockedCoreSlots(state: GameState, mods: Modifiers): number {
  return state.stage >= firstStageOfRealm('coreFormation') ? mods.coreSlots : 0;
}

/** Number of adjacent pairs in the generating cycle among the given elements. */
export function generatingPairs(elements: ReadonlySet<string>): number {
  return ELEMENTS.filter(
    (e, i) => elements.has(e.id) && elements.has(ELEMENTS[(i + 1) % ELEMENTS.length].id),
  ).length;
}

export function perkEffects(perk: PerkDef, level: number): Effect[] {
  if (level <= 0) return [];
  const scale = perk.scaling === 'diminishing' ? diminishingEffect : compoundEffect;
  return perk.effects.map((e) => scale(e, level));
}

export function treasureEffects(treasure: TreasureDef, level: number): Effect[] {
  return [...(treasure.fixedEffects ?? []), ...treasure.effects.map((e) => scaleEffect(e, level))];
}

export function computeModifiers(state: GameState, includeBuffs = true): Modifiers {
  const mods = baseModifiers();
  for (const id of Object.keys(state.upgrades)) {
    const u = UPGRADES_BY_ID.get(id);
    if (u) applyEffects(mods, upgradeEffects(state, u));
  }
  for (const [id, level] of Object.entries(state.treasures)) {
    const t = TREASURES_BY_ID.get(id);
    if (t) applyEffects(mods, treasureEffects(t, level));
  }
  for (const perk of PERKS)
    applyEffects(mods, perkEffects(perk, state.prestige.perks[perk.id] ?? 0));
  for (const core of state.cores) {
    const element = ELEMENTS_BY_ID.get(core.element);
    if (element) applyEffects(mods, element.effects(core.grade));
  }
  if (includeBuffs) {
    for (const b of state.buffs) {
      const def = BUFFS_BY_ID.get(b.id);
      if (def) applyEffects(mods, def.effects);
    }
  }
  const currentRealm = STAGES[state.stage].realmIndex;
  for (let r = 0; r <= currentRealm; r++) applyEffects(mods, REALMS[r].effects ?? []);
  return mods;
}

/** A revival makes its resource's total output this many times your best resource's. */
const REVIVAL_LEAD = 1.5;
/** For revivals learned before they were sized on purchase. */
const UNSIZED_REVIVAL_MULT = 25;

/**
 * The multiplier a revival of this resource would get if learned now: enough
 * to make its total output REVIVAL_LEAD times the best other resource's,
 * however far behind it has fallen by the time you buy it.
 */
export function revivalMult(state: GameState, id: string): number {
  const stats = computeStats(state, false);
  const total = (g: string) => stats.generatorUnitQps[g] * (state.generators[g] ?? 0);
  const best = Math.max(...GENERATORS.filter((g) => g.id !== id).map((g) => total(g.id)));
  const own = stats.generatorUnitQps[id] * Math.max(1, state.generators[id] ?? 0);
  return Math.max(1, Number(((REVIVAL_LEAD * best) / own).toPrecision(2)));
}

/** A technique's effects: a revival's, once learned, are what it was sized to then. */
export function upgradeEffects(state: GameState, u: UpgradeDef): readonly Effect[] {
  if (!u.revives) return u.effects;
  const mult = state.upgrades[u.id]
    ? (state.revivals[u.revives] ?? UNSIZED_REVIVAL_MULT)
    : revivalMult(state, u.revives);
  return [{ type: 'generatorMult', generator: u.revives, value: mult }];
}

export function computeStats(state: GameState, includeBuffs = true): Stats {
  const mods = computeModifiers(state, includeBuffs);
  const realmMult = realmMultiplier(state.stage);
  const memoryMult = (1 + MEMORIES.weight * state.prestige.memories) ** mods.memoryPower;
  const cycleMult =
    GENERATING_CYCLE_BONUS ** generatingPairs(new Set(state.cores.map((c) => c.element)));
  const coreMult = state.cores.reduce((m, c) => m * CORE_GRADES[c.grade].mult, 1);
  const global = mods.globalMult * realmMult * memoryMult * cycleMult * coreMult;

  const generatorUnitQps: Record<string, number> = {};
  let generatorQps = 0;
  for (const g of GENERATORS) {
    const unit = g.baseQps * (mods.generatorMult[g.id] ?? 1) * global;
    generatorUnitQps[g.id] = unit;
    generatorQps += unit * (state.generators[g.id] ?? 0);
  }

  const baseMoteValue = MOTE_BASE_VALUE * mods.moteBaseMult * global;
  const moteValue = Math.max(baseMoteValue, generatorQps * MOTE_QPS_SECONDS) * mods.moteValueMult;
  const moteSpawnPerSecond = BASE_MOTE_SPAWN_PER_SECOND * mods.moteSpawnMult;
  const autoMoteQps = moteSpawnPerSecond * Math.min(1, mods.moteAutoCollect) * moteValue;

  return {
    mods,
    realmMult,
    memoryMult,
    cycleMult,
    generatorUnitQps,
    generatorQps,
    autoMoteQps,
    qps: generatorQps + autoMoteQps,
    moteValue,
    moteSpawnPerSecond,
  };
}
