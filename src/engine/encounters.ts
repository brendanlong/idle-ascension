import { BUFFS_BY_ID } from '../content/buffs';
import {
  ENCOUNTERS,
  ENCOUNTERS_BY_ID,
  ENCOUNTER_INTERVAL_MAX,
  ENCOUNTER_INTERVAL_MIN,
  ENCOUNTER_LIFETIME,
  type EncounterOutcome,
} from '../content/encounters';
import { firstStageOfRealm } from '../content/realms';
import { addBuff, gainQi, grantRandomTreasure } from './economy';
import { log } from './events';
import { formatNumber } from './format';
import { pick, randomBetween, weightedPick, type Rng } from './rng';
import type { GameState } from './state';
import type { Stats } from './stats';

export function tickEncounters(state: GameState, stats: Stats, dt: number, rng: Rng): void {
  const enc = state.encounter;
  if (enc.active) {
    enc.active.remaining -= dt;
    if (enc.active.remaining <= 0) {
      enc.active = null;
      log('The opportunity slips away...', 'info');
    }
    return;
  }
  if (state.tribulation) return;
  enc.nextIn -= dt * stats.mods.encounterRateMult;
  if (enc.nextIn <= 0) spawnEncounter(state, rng);
}

export function spawnEncounter(state: GameState, rng: Rng): void {
  const eligible = ENCOUNTERS.filter(
    (e) => !e.minRealm || state.stage >= firstStageOfRealm(e.minRealm),
  );
  const def = weightedPick(rng, eligible);
  state.encounter.active = {
    id: def.id,
    x: randomBetween(rng, 0.12, 0.88),
    y: randomBetween(rng, 0.12, 0.88),
    remaining: ENCOUNTER_LIFETIME,
  };
  state.encounter.nextIn = randomBetween(rng, ENCOUNTER_INTERVAL_MIN, ENCOUNTER_INTERVAL_MAX);
}

export function claimEncounter(state: GameState, stats: Stats, rng: Rng): boolean {
  const active = state.encounter.active;
  if (!active) return false;
  const def = ENCOUNTERS_BY_ID.get(active.id)!;
  state.encounter.active = null;
  state.stats.encountersClaimed++;
  log(pick(rng, def.flavor), 'lore');
  resolveOutcome(state, stats, def.outcome, rng);
  return true;
}

function resolveOutcome(state: GameState, stats: Stats, outcome: EncounterOutcome, rng: Rng): void {
  switch (outcome.type) {
    case 'windfall': {
      const amount =
        Math.min(state.qi * outcome.bankFraction, stats.qps * outcome.qpsSeconds) +
        stats.clickPower * 10;
      gainQi(state, amount);
      log(`+${formatNumber(amount, state.settings.numberFormat)} qi`, 'good');
      break;
    }
    case 'buff':
      addBuff(state, outcome.buff);
      log(`${BUFFS_BY_ID.get(outcome.buff)!.name}!`, 'good');
      break;
    case 'treasure':
      if (!grantRandomTreasure(state, rng)) resolveOutcome(state, stats, outcome.fallback, rng);
      break;
  }
}
