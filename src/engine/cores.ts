import { CORE_GRADES, CORE_SLOT_REALMS, ELEMENTS_BY_ID, type ElementId } from '../content/cores';
import { FINAL_STAGE, REALMS, REALMS_BY_ID, STAGES, firstStageOfRealm } from '../content/realms';
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

/** Refining costs this share of the breakthrough at the stage it's priced at (see refineStage). */
const REFINE_SHARE = 0.5;

/**
 * The stage whose breakthrough prices refining a core to a grade. A realm's
 * new grade comes to each core one stage after the core before it, and a core
 * formed in a later realm catches up one grade per stage, so a realm's core
 * upgrades spread across it instead of all arriving at its first breakthrough.
 */
export function refineStage(coreIndex: number, grade: number): number {
  const gradeRealm = REALMS.find((r) => (r.coreGradeCap ?? -1) >= grade)!;
  const slotRealm = CORE_SLOT_REALMS[Math.min(coreIndex, CORE_SLOT_REALMS.length - 1)];
  const stage = Math.max(
    firstStageOfRealm(gradeRealm.id) + Math.min(coreIndex, 3),
    firstStageOfRealm(slotRealm) + grade - 1,
  );
  return Math.min(stage, FINAL_STAGE);
}

export function coreRefineCost(state: GameState, mods: Modifiers, coreIndex: number): number {
  const grade = state.cores[coreIndex].grade + 1;
  if (!CORE_GRADES[grade]) return Infinity;
  return STAGES[refineStage(coreIndex, grade)].cost * REFINE_SHARE * mods.coreCostMult;
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
