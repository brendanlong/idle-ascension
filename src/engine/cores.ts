import {
  CORE_FORM_BASE_COST,
  CORE_GRADE_CAP_BY_REALM,
  CORE_FORM_COST_GROWTH,
  CORE_GRADES,
  CORE_REFINE_COST_GROWTH,
  ELEMENTS_BY_ID,
  type ElementId,
} from '../content/cores';
import { REALMS, STAGES } from '../content/realms';
import { spendQi } from './economy';
import type { Modifiers } from './effects';
import { log } from './events';
import type { GameState } from './state';
import { unlockedCoreSlots } from './stats';

export function coreFormCost(mods: Modifiers, coreIndex: number): number {
  return CORE_FORM_BASE_COST * CORE_FORM_COST_GROWTH ** coreIndex * mods.coreCostMult;
}

export function coreRefineCost(state: GameState, mods: Modifiers, coreIndex: number): number {
  const core = state.cores[coreIndex];
  return coreFormCost(mods, coreIndex) * CORE_REFINE_COST_GROWTH ** (core.grade + 1);
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
  const realmId = REALMS[STAGES[state.stage].realmIndex].id;
  return CORE_GRADE_CAP_BY_REALM[realmId] ?? 0;
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
