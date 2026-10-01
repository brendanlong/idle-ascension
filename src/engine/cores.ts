import { CORE_GRADES, CORE_SLOT_REALMS, ELEMENTS_BY_ID, type ElementId } from '../content/cores';
import { FINAL_STAGE, REALMS, STAGES, firstStageOfRealm } from '../content/realms';
import { spendQi } from './economy';
import type { Modifiers } from './effects';
import { log } from './events';
import type { GameState } from './state';
import { unlockedCoreSlots } from './stats';

/** Core purchases cost this share of the breakthrough cost where they're scheduled. */
const CORE_PRICE_SHARE = 0.5;

/**
 * The breakthrough cost at a point on the stage axis, with fractional stages
 * interpolated along the curve (geometrically).
 */
function costAt(position: number): number {
  const p = Math.min(Math.max(position, 1), FINAL_STAGE);
  const lo = Math.floor(p);
  const hi = Math.min(lo + 1, FINAL_STAGE);
  return STAGES[lo].cost * (STAGES[hi].cost / STAGES[lo].cost) ** (p - lo);
}

function slotRealmIndex(coreIndex: number): number {
  const id = CORE_SLOT_REALMS[Math.min(coreIndex, CORE_SLOT_REALMS.length - 1)];
  return REALMS.findIndex((r) => r.id === id);
}

/** How far through a realm (0 to 1) lands at that point on the stage axis. */
function inRealm(realmIndex: number, fraction: number): number {
  const realm = REALMS[Math.min(realmIndex, REALMS.length - 1)];
  return firstStageOfRealm(realm.id) + fraction * realm.stageNames.length;
}

/**
 * Where on the stage axis each core purchase is priced, so the cores spread
 * through the game: each realm's new core forms a third of the way through
 * its realm, and every core gains a grade per realm after that. In a realm,
 * the newest core's refine comes two thirds of the way through, and the older
 * cores' refines are spread over the rest of the realm after the new core.
 */
export function formPosition(coreIndex: number): number {
  return inRealm(slotRealmIndex(coreIndex), 1 / 3);
}

export function refinePosition(coreIndex: number, grade: number): number {
  const realm = slotRealmIndex(coreIndex) + grade - 1;
  // Cores already formed by this realm, newest first: the newest refines first.
  const cores = CORE_SLOT_REALMS.filter(
    (id) => REALMS.findIndex((r) => r.id === id) <= realm,
  ).length;
  const newest = Math.min(cores, CORE_SLOT_REALMS.length) - 1;
  const order = coreIndex >= newest ? 1 : coreIndex + 2;
  return inRealm(realm, 1 / 3 + ((2 / 3) * order) / (cores + 1));
}

export function coreFormCost(mods: Modifiers, coreIndex: number): number {
  return costAt(formPosition(coreIndex)) * CORE_PRICE_SHARE * mods.coreCostMult;
}

export function coreRefineCost(state: GameState, mods: Modifiers, coreIndex: number): number {
  const grade = state.cores[coreIndex].grade + 1;
  if (!CORE_GRADES[grade]) return Infinity;
  return costAt(refinePosition(coreIndex, grade)) * CORE_PRICE_SHARE * mods.coreCostMult;
}

export function canFormCore(state: GameState, mods: Modifiers, element: ElementId): boolean {
  return (
    state.cores.length < unlockedCoreSlots(state, mods) &&
    !state.cores.some((c) => c.element === element)
  );
}

export function formCore(state: GameState, mods: Modifiers, element: ElementId): boolean {
  if (!canFormCore(state, mods, element)) return false;
  if (!spendQi(state, coreFormCost(mods, state.cores.length))) return false;
  state.cores.push({ element, grade: 0 });
  const name = ELEMENTS_BY_ID.get(element)!.name;
  log(
    state.cores.length === 1
      ? `A ${name} core condenses in your dantian. It is made of... mud. The elders snicker.`
      : `Another core forms beside the first: a ${name} core. Onlookers faint.`,
    'epic',
  );
  return true;
}

export function maxCoreGrade(state: GameState): number {
  return REALMS[STAGES[state.stage].realmIndex].coreGradeCap ?? 0;
}

export function canRefineCore(state: GameState, coreIndex: number): boolean {
  const core = state.cores[coreIndex];
  return !!core && core.grade < Math.min(maxCoreGrade(state), CORE_GRADES.length - 1);
}

export function refineCore(state: GameState, mods: Modifiers, coreIndex: number): boolean {
  if (!canRefineCore(state, coreIndex)) return false;
  if (!spendQi(state, coreRefineCost(state, mods, coreIndex))) return false;
  const core = state.cores[coreIndex];
  core.grade++;
  const element = ELEMENTS_BY_ID.get(core.element)!.name;
  log(`Your ${element} core is refined to ${CORE_GRADES[core.grade].name} grade.`, 'good');
  return true;
}
