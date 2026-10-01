import type { ElementId } from '../content/cores';
import { firstStageOfRealm } from '../content/realms';
import {
  TRIALS,
  TRIALS_BY_ELEMENT,
  TRIAL_AFFINITY_MULT,
  TRIAL_BUFF_SCORE,
  TRIAL_INTERVAL_MAX,
  TRIAL_INTERVAL_MIN,
  TRIAL_MIN_REALM,
  TRIAL_OFFER_LIFETIME,
  TRIAL_REWARD_BASE_SECONDS,
  TRIAL_REWARD_SECONDS_PER_SCORE,
  TRIAL_TREASURE_CHANCE,
  TRIAL_TREASURE_SCORE,
} from '../content/trials';
import { qiEventCap } from './breakthrough';
import { addBuff, describeBuff, gainQi, grantTreasure, pickRandomTreasure } from './economy';
import { log } from './events';
import { formatNumber } from './format';
import { pick, randomBetween, type Rng } from './rng';
import type { GameState } from './state';
import type { Stats } from './stats';

export function trialsUnlocked(state: GameState): boolean {
  return state.stage >= firstStageOfRealm(TRIAL_MIN_REALM);
}

export function tickTrials(state: GameState, dt: number, rng: Rng): void {
  const trial = state.trial;
  if (trial.offer) {
    trial.offer.remaining -= dt;
    if (trial.offer.remaining <= 0) trial.offer = null;
    return;
  }
  if (state.tribulation || state.trial.active || !trialsUnlocked(state)) return;
  trial.nextIn -= dt;
  if (trial.nextIn <= 0) {
    trial.offer = {
      element: pick(rng, TRIALS).element,
      x: randomBetween(rng, 0.15, 0.85),
      y: randomBetween(rng, 0.15, 0.85),
      remaining: TRIAL_OFFER_LIFETIME,
    };
    trial.nextIn = randomBetween(rng, TRIAL_INTERVAL_MIN, TRIAL_INTERVAL_MAX);
  }
}

/** Starts the offered trial; the UI runs whatever is in `state.trial.active`. */
export function acceptTrial(state: GameState): ElementId | null {
  const offer = state.trial.offer;
  if (!offer || state.trial.active || state.tribulation) return null;
  state.trial.offer = null;
  state.trial.active = offer.element;
  return offer.element;
}

export function validScore(score: number): number {
  return Number.isFinite(score) ? Math.min(1, Math.max(0, score)) : 0;
}

export interface TrialResult {
  qi: number;
  buff: string | null;
  treasure: string | null;
}

/** Grants rewards for a finished trial. `score` is 0-1. */
export function completeTrial(
  state: GameState,
  stats: Stats,
  element: ElementId,
  score: number,
  rng: Rng,
): TrialResult {
  const def = TRIALS_BY_ELEMENT.get(element)!;
  const clamped = validScore(score);
  if (state.trial.active === element) state.trial.active = null;
  const affinity = state.cores.some((c) => c.element === element) ? TRIAL_AFFINITY_MULT : 1;
  const seconds = TRIAL_REWARD_BASE_SECONDS + TRIAL_REWARD_SECONDS_PER_SCORE * clamped;
  const qi = Math.min((stats.qps * seconds + stats.moteValue * 20) * affinity, qiEventCap(state));
  gainQi(state, qi);
  state.stats.trialsCompleted++;

  const percent = Math.round(clamped * 100);
  log(
    `${def.icon} ${def.name}: ${percent}%${affinity > 1 ? ' (elemental affinity!)' : ''}. +${formatNumber(qi, state.settings.numberFormat)} qi`,
    percent >= 95 ? 'epic' : 'good',
  );

  let buff: string | null = null;
  if (clamped >= TRIAL_BUFF_SCORE) {
    buff = def.buff;
    addBuff(state, buff);
    log(describeBuff(buff), 'good');
  }

  let treasure: string | null = null;
  if (clamped >= TRIAL_TREASURE_SCORE && rng() < TRIAL_TREASURE_CHANCE) {
    treasure = pickRandomTreasure(state, rng);
    if (treasure) grantTreasure(state, treasure);
  }
  return { qi, buff, treasure };
}
