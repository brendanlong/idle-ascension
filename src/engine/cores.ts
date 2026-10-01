import { CORE_GRADES, CORE_SLOT_REALMS, ELEMENTS_BY_ID, type ElementId } from '../content/cores';
import { REALMS, REALMS_BY_ID, STAGES } from '../content/realms';
import { spendQi } from './economy';
import type { Modifiers } from './effects';
import { log } from './events';
import type { GameState } from './state';
import { unlockedCoreSlots } from './stats';

/**
 * Cores are priced from realm breakthroughs, so they stay in step with the
 * realm they belong to: forming one costs the first breakthrough of the realm
 * that opens its slot.
 */
export function coreFormCost(mods: Modifiers, coreIndex: number): number {
  const realm = CORE_SLOT_REALMS[Math.min(coreIndex, CORE_SLOT_REALMS.length - 1)];
  return REALMS_BY_ID.get(realm)!.stageCosts[0] * mods.coreCostMult;
}

/** Base price of refining to a grade: a share of the first breakthrough of the realm allowing it. */
export function gradeRefinePrice(grade: number): number {
  const realm = REALMS.find((r) => (r.coreGradeCap ?? -1) >= grade)!;
  return realm.stageCosts[0] * CORE_GRADES[grade].refineShare;
}

/**
 * A grade's own price, but never less than forming this core: a core formed in
 * a later realm doesn't catch up to the grade cap for free.
 */
export function coreRefineCost(state: GameState, mods: Modifiers, coreIndex: number): number {
  const next = CORE_GRADES[state.cores[coreIndex].grade + 1];
  if (!next) return Infinity;
  const grade = state.cores[coreIndex].grade + 1;
  return Math.max(gradeRefinePrice(grade) * mods.coreCostMult, coreFormCost(mods, coreIndex));
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
