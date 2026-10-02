import { CORE_GRADES, ELEMENTS_BY_ID, type ElementId } from '../content/cores';
import { coreSchedule } from '../content/progress';
import { FINAL_STAGE, REALMS, STAGES, STAGE_LAYOUT } from '../content/realms';
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

const schedule = coreSchedule(STAGE_LAYOUT);
export const formPosition = schedule.form;
export const refinePosition = schedule.refine;

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
