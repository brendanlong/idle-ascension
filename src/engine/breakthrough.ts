import { FINAL_STAGE, REALMS, STAGES, stageName, type StageDef } from '../content/realms';
import { describeCondition, meetsCondition } from './conditions';
import { addBuff, spendQi } from './economy';
import type { Modifiers } from './effects';
import { log } from './events';
import { randomBetween, type Rng } from './rng';
import type { GameState } from './state';

const BASE_BOLT_DURATION = 1.6;
/** Fraction of the breakthrough cost returned when a tribulation fails. */
const FAILURE_REFUND = 0.7;

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

export function attemptBreakthrough(state: GameState, mods: Modifiers): BreakthroughResult {
  const next = nextStage(state);
  if (!next || breakthroughBlocker(state) !== null) return 'blocked';
  spendQi(state, next.cost);
  const trib = REALMS[next.realmIndex].tribulation;
  if (next.isMajor && trib) {
    state.tribulation = {
      targetStage: next.index,
      boltsToSpawn: trib.bolts,
      totalBolts: trib.bolts,
      spawnTimer: 1.5,
      interval: trib.interval,
      bolts: [],
      hits: 0,
      allowedHits: mods.tribulationAllowedHits,
      nextBoltId: 1,
    };
    log(`Dark clouds gather overhead. The ${trib.name} descends! Disperse the lightning!`, 'bad');
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

export function tickTribulation(state: GameState, mods: Modifiers, dt: number, rng: Rng): void {
  const t = state.tribulation;
  if (!t) return;

  for (const bolt of t.bolts) bolt.remaining -= dt;
  const landed = t.bolts.filter((b) => b.remaining <= 0);
  if (landed.length > 0) {
    t.hits += landed.length;
    t.bolts = t.bolts.filter((b) => b.remaining > 0);
    log(`Lightning strikes you! (${t.hits}/${t.allowedHits} you can endure)`, 'bad');
  }

  t.spawnTimer -= dt;
  while (t.boltsToSpawn > 0 && t.spawnTimer <= 0) {
    const duration = BASE_BOLT_DURATION * mods.tribulationBoltTimeMult;
    t.bolts.push({
      id: t.nextBoltId++,
      x: randomBetween(rng, 0.1, 0.9),
      y: randomBetween(rng, 0.1, 0.9),
      remaining: duration,
      duration,
    });
    t.boltsToSpawn--;
    t.spawnTimer += t.interval;
  }

  if (t.boltsToSpawn === 0 && t.bolts.length === 0) finishTribulation(state);
}

export function disperseBolt(state: GameState, boltId: number): boolean {
  const t = state.tribulation;
  if (!t) return false;
  const before = t.bolts.length;
  t.bolts = t.bolts.filter((b) => b.id !== boltId);
  return t.bolts.length < before;
}

/** Walking away mid-tribulation counts as being overwhelmed by it. */
export function abandonTribulation(state: GameState): void {
  if (!state.tribulation) return;
  state.tribulation.hits = Infinity;
  finishTribulation(state);
}

function finishTribulation(state: GameState): void {
  const t = state.tribulation!;
  state.tribulation = null;
  if (t.hits <= t.allowedHits) {
    state.stats.tribulationsSurvived++;
    log('The clouds part. You have survived the tribulation!', 'good');
    advanceTo(state, t.targetStage);
  } else {
    state.stats.tribulationsFailed++;
    // Refunds shouldn't count as newly earned qi.
    state.qi += STAGES[t.targetStage].cost * FAILURE_REFUND;
    addBuff(state, 'injured');
    log(
      'The lightning overwhelms you. Your breakthrough fails and your meridians are scorched.',
      'bad',
    );
  }
}

/** For tests and headless simulation: disperse every bolt as soon as it appears. */
export function autoDisperse(state: GameState): void {
  if (state.tribulation) state.tribulation.bolts = [];
}
