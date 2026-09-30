import { BUFFS_BY_ID } from '../content/buffs';
import { GENERATORS, GENERATORS_BY_ID, GENERATOR_COST_GROWTH } from '../content/generators';
import {
  MAX_TREASURE_LEVEL,
  OWNED_TREASURE_WEIGHT_FACTOR,
  RARITIES,
  TREASURES,
  TREASURES_BY_ID,
  type TreasureDef,
} from '../content/treasures';
import { UPGRADES, UPGRADES_BY_ID, type UpgradeDef } from '../content/upgrades';
import { firstStageOfRealm } from '../content/realms';
import { meetsCondition } from './conditions';
import type { Modifiers } from './effects';
import { log } from './events';
import { weightedPick, type Rng } from './rng';
import type { GameState } from './state';
import type { Stats } from './stats';

export function gainQi(state: GameState, amount: number): void {
  state.qi += amount;
  state.qiEarnedThisLoop += amount;
  state.qiEarnedTotal += amount;
}

export function spendQi(state: GameState, amount: number): boolean {
  if (state.qi < amount) return false;
  state.qi -= amount;
  return true;
}

export function click(state: GameState, stats: Stats): number {
  gainQi(state, stats.clickPower);
  state.stats.totalClicks++;
  state.stats.loopClicks++;
  return stats.clickPower;
}

export function absorbMotes(state: GameState, stats: Stats, count: number): number {
  const amount = stats.moteValue * count;
  gainQi(state, amount);
  state.stats.motesAbsorbed += count;
  return amount;
}

// --- Generators ---

/** Total cost of buying `count` more of a generator. */
export function generatorCost(state: GameState, mods: Modifiers, id: string, count = 1): number {
  const def = GENERATORS_BY_ID.get(id);
  if (!def) throw new Error(`Unknown generator ${id}`);
  const owned = state.generators[id] ?? 0;
  const r = GENERATOR_COST_GROWTH;
  return (def.baseCost * mods.generatorCostMult * r ** owned * (r ** count - 1)) / (r - 1);
}

export function maxAffordable(state: GameState, mods: Modifiers, id: string): number {
  const def = GENERATORS_BY_ID.get(id);
  if (!def) return 0;
  const r = GENERATOR_COST_GROWTH;
  const first = def.baseCost * mods.generatorCostMult * r ** (state.generators[id] ?? 0);
  return Math.max(0, Math.floor(Math.log((state.qi * (r - 1)) / first + 1) / Math.log(r)));
}

export function buyGenerator(state: GameState, mods: Modifiers, id: string, count = 1): boolean {
  if (count <= 0) return false;
  if (!spendQi(state, generatorCost(state, mods, id, count))) return false;
  state.generators[id] = (state.generators[id] ?? 0) + count;
  return true;
}

/** Generators are revealed once you've nearly been able to afford one, or own the previous. */
export function isGeneratorVisible(state: GameState, index: number): boolean {
  const def = GENERATORS[index];
  if (index === 0 || (state.generators[def.id] ?? 0) > 0) return true;
  return (
    (state.generators[GENERATORS[index - 1].id] ?? 0) > 0 ||
    state.qiEarnedThisLoop >= def.baseCost * 0.5
  );
}

// --- Upgrades ---

export function availableUpgrades(state: GameState): UpgradeDef[] {
  return UPGRADES.filter((u) => !state.upgrades[u.id] && meetsCondition(state, u.unlock)).sort(
    (a, b) => a.cost - b.cost,
  );
}

export function buyUpgrade(state: GameState, id: string): boolean {
  const u = UPGRADES_BY_ID.get(id);
  if (!u || state.upgrades[id] || !meetsCondition(state, u.unlock)) return false;
  if (!spendQi(state, u.cost)) return false;
  state.upgrades[id] = true;
  log(`You master the ${u.name}.`, 'good');
  return true;
}

// --- Buffs & treasures ---

export function addBuff(state: GameState, id: string): void {
  const def = BUFFS_BY_ID.get(id);
  if (!def) throw new Error(`Unknown buff ${id}`);
  const existing = state.buffs.find((b) => b.id === id);
  if (existing) existing.remaining = Math.max(existing.remaining, def.duration);
  else state.buffs.push({ id, remaining: def.duration });
}

/** Treasures an encounter could give now: unfound ones, or owned ones below max level. */
export function findableTreasures(state: GameState): TreasureDef[] {
  return TREASURES.filter(
    (t) =>
      (state.treasures[t.id] ?? 0) < MAX_TREASURE_LEVEL &&
      state.stage >= firstStageOfRealm(t.minRealm),
  );
}

export function treasureWeight(state: GameState, t: TreasureDef): number {
  const owned = (state.treasures[t.id] ?? 0) > 0;
  return RARITIES[t.rarity].weight * (owned ? OWNED_TREASURE_WEIGHT_FACTOR : 1);
}

export function pickRandomTreasure(state: GameState, rng: Rng): string | null {
  const options = findableTreasures(state).map((t) => ({
    id: t.id,
    weight: treasureWeight(state, t),
  }));
  return options.length === 0 ? null : weightedPick(rng, options).id;
}

/** Grants a treasure, or refines it one level if already owned. */
export function grantTreasure(state: GameState, id: string): void {
  const def = TREASURES_BY_ID.get(id)!;
  const level = Math.min(MAX_TREASURE_LEVEL, (state.treasures[id] ?? 0) + 1);
  state.treasures[id] = level;
  if (level === 1) {
    log(`Obtained ${RARITIES[def.rarity].name.toLowerCase()} treasure: ${def.name}!`, 'epic');
  } else {
    log(`Your ${def.name} absorbs it and grows stronger. (Level ${level})`, 'epic');
  }
}
