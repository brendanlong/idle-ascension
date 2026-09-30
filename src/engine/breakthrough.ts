import { ELEMENTS, type ElementId } from '../content/cores';
import {
  FINAL_STAGE,
  REALMS,
  STAGES,
  stageName,
  type StageDef,
  type TribulationDef,
} from '../content/realms';
import { describeCondition, meetsCondition } from './conditions';
import { addBuff, spendQi } from './economy';
import type { Modifiers } from './effects';
import { log } from './events';
import { defaultRng, type Rng } from './rng';
import type { GameState } from './state';

/** Fraction of the breakthrough cost returned when a tribulation fails. */
const FAILURE_REFUND = 0.7;
/** Leniency can't push a pass mark below this. */
const MIN_PASS_SCORE = 0.25;
/** Slowdown can't make trials slower than this speed. */
const MIN_TRIAL_SPEED = 0.5;

export function nextStage(state: GameState): StageDef | null {
  return state.stage < FINAL_STAGE ? STAGES[state.stage + 1] : null;
}

/** Why the player can't break through right now, or null if they can. */
export function breakthroughBlocker(state: GameState): string | null {
  const next = nextStage(state);
  if (!next) return 'You stand at the peak of all cultivation.';
  if (state.tribulation) return 'The tribulation is underway!';
  const requirement = REALMS[next.realmIndex].requirement;
  if (next.isMajor && requirement && !meetsCondition(state, requirement)) {
    return describeCondition(requirement);
  }
  if (state.qi < next.cost) return 'Not enough qi.';
  return null;
}

export type BreakthroughResult = 'advanced' | 'tribulation' | 'blocked';

export function tribulationPassScore(def: TribulationDef, mods: Modifiers): number {
  return Math.max(MIN_PASS_SCORE, def.passScore - mods.tribulationLeniency);
}

export function tribulationSpeed(mods: Modifiers): number {
  return Math.max(MIN_TRIAL_SPEED, 1 / mods.tribulationSlowMult);
}

/** `count` different elements in random order. */
function randomElements(rng: Rng, count: number): ElementId[] {
  const pool = ELEMENTS.map((e) => e.id);
  const picked: ElementId[] = [];
  while (picked.length < count && pool.length > 0) {
    picked.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return picked;
}

export function attemptBreakthrough(
  state: GameState,
  mods: Modifiers,
  rng: Rng = defaultRng,
): BreakthroughResult {
  const next = nextStage(state);
  if (!next || breakthroughBlocker(state) !== null) return 'blocked';
  spendQi(state, next.cost);
  const trib = REALMS[next.realmIndex].tribulation;
  if (next.isMajor && trib) {
    state.tribulation = {
      targetStage: next.index,
      trials: randomElements(rng, trib.trials),
      scores: [],
      passScore: tribulationPassScore(trib, mods),
      speed: tribulationSpeed(mods),
    };
    log(`Dark clouds gather overhead. The ${trib.name} descends!`, 'bad');
    return 'tribulation';
  }
  advanceTo(state, next.index);
  return 'advanced';
}

export function advanceTo(state: GameState, stage: number): void {
  state.stage = stage;
  state.stats.bestStage = Math.max(state.stats.bestStage, stage);
  const s = STAGES[stage];
  if (stage === FINAL_STAGE) {
    state.flags.ascended = true;
    log('The Gate of Heaven opens. You have ascended to Godhood!', 'epic');
  } else if (s.isMajor) {
    log(`Breakthrough! You enter ${stageName(stage)}. ${REALMS[s.realmIndex].description}`, 'epic');
  } else {
    log(`You break through to ${stageName(stage)}.`, 'good');
  }
}

/** The element of the trial to face next, or null if there's no tribulation. */
export function currentTribulationTrial(state: GameState): ElementId | null {
  const t = state.tribulation;
  return t ? (t.trials[t.scores.length] ?? null) : null;
}

export function tribulationAverage(scores: readonly number[]): number {
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
}

/** Records a finished trial's score (0-1), resolving the tribulation after the last one. */
export function recordTribulationTrial(state: GameState, score: number): void {
  const t = state.tribulation;
  if (!t) return;
  t.scores.push(Math.min(1, Math.max(0, score)));
  if (t.scores.length < t.trials.length) {
    log(
      `Trial ${t.scores.length} of ${t.trials.length}: ${Math.round(score * 100)}%. The heavens are not finished with you.`,
      'info',
    );
    return;
  }
  finishTribulation(state, tribulationAverage(t.scores) >= t.passScore);
}

/** Walking away mid-tribulation counts as being overwhelmed by it. */
export function abandonTribulation(state: GameState): void {
  if (state.tribulation) finishTribulation(state, false);
}

function finishTribulation(state: GameState, passed: boolean): void {
  const t = state.tribulation!;
  state.tribulation = null;
  const average = Math.round(tribulationAverage(t.scores) * 100);
  const needed = Math.round(t.passScore * 100);
  if (passed) {
    state.stats.tribulationsSurvived++;
    log(
      `The clouds part (${average}%, needed ${needed}%). You have survived the tribulation!`,
      'good',
    );
    advanceTo(state, t.targetStage);
  } else {
    state.stats.tribulationsFailed++;
    // Refunds shouldn't count as newly earned qi.
    state.qi += STAGES[t.targetStage].cost * FAILURE_REFUND;
    addBuff(state, 'injured');
    log(
      `The tribulation overwhelms you (${average}%, needed ${needed}%). Your breakthrough fails and your meridians are scorched.`,
      'bad',
    );
  }
}
