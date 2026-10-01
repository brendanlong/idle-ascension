import { BUFFS_BY_ID } from '../content/buffs';
import { CORE_GRADES, ELEMENTS, ELEMENTS_BY_ID, GENERATING_CYCLE_BONUS } from '../content/cores';
import { GENERATORS } from '../content/generators';
import { PERKS, type PerkDef } from '../content/perks';
import { REALMS, STAGES, firstStageOfRealm } from '../content/realms';
import { TREASURES_BY_ID, type TreasureDef } from '../content/treasures';
import { UPGRADES_BY_ID } from '../content/upgrades';
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
  clickPower: number;
  autoClickQps: number;
  /** Total passive qi/s. */
  qps: number;
  moteValue: number;
  moteSpawnPerSecond: number;
}

const BASE_MOTE_SPAWN_PER_SECOND = 1;
/**
 * A mote is worth this fraction of a click's flat power (not the part that
 * comes from qi/s), or this many seconds of qi/s if that's more, before mote
 * multipliers. Early on motes track clicks; later they track production.
 */
const MOTE_CLICK_FRACTION = 1;
const MOTE_QPS_SECONDS = 0.04;

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
    if (u) applyEffects(mods, u.effects);
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

export function computeStats(state: GameState, includeBuffs = true): Stats {
  const mods = computeModifiers(state, includeBuffs);
  const realmMult = realmMultiplier(state.stage);
  const memoryMult = 1 + state.prestige.memories * mods.memoryBonus;
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

  const flatClickPower = mods.clickFlat * mods.clickMult * global;
  const clickPower = flatClickPower + mods.clickQpsFraction * generatorQps;
  const autoClickQps = mods.autoClicksPerSecond * clickPower;

  return {
    mods,
    realmMult,
    memoryMult,
    cycleMult,
    generatorUnitQps,
    generatorQps,
    clickPower,
    autoClickQps,
    qps: generatorQps + autoClickQps,
    moteValue:
      Math.max(
        flatClickPower * MOTE_CLICK_FRACTION,
        (generatorQps + autoClickQps) * MOTE_QPS_SECONDS,
      ) * mods.moteValueMult,
    moteSpawnPerSecond: BASE_MOTE_SPAWN_PER_SECOND * mods.moteSpawnMult,
  };
}
