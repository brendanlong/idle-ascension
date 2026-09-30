import { BUFFS_BY_ID } from '../content/buffs';
import {
  ENCOUNTERS,
  ENCOUNTERS_BY_ID,
  ENCOUNTER_INTERVAL_MAX,
  ENCOUNTER_INTERVAL_MIN,
  ENCOUNTER_LIFETIME,
  type EncounterDef,
  type RewardKind,
  type WindfallReward,
} from '../content/encounters';
import { firstStageOfRealm } from '../content/realms';
import { TREASURES_BY_ID } from '../content/treasures';
import { addBuff, gainQi, grantTreasure, pickRandomTreasure } from './economy';
import { describeEffects } from './effects';
import { log } from './events';
import { formatNumber } from './format';
import { pick, randomBetween, weightedPick, type Rng } from './rng';
import type { GameState } from './state';
import type { Stats } from './stats';
import { fillTemplate } from './text';

export function tickEncounters(state: GameState, stats: Stats, dt: number, rng: Rng): void {
  const enc = state.encounter;
  // Encounters would be hidden under a trial, so they wait until it's over.
  if (state.tribulation || state.trial.active) return;
  if (enc.active) {
    enc.active.remaining -= dt;
    if (enc.active.remaining <= 0) {
      enc.active = null;
      log('The opportunity slips away...', 'info');
    }
    return;
  }
  enc.nextIn -= dt * stats.mods.encounterRateMult;
  if (enc.nextIn <= 0) spawnEncounter(state, rng);
}

export function eligibleEncounters(state: GameState): EncounterDef[] {
  return ENCOUNTERS.filter((e) => !e.minRealm || state.stage >= firstStageOfRealm(e.minRealm));
}

export function spawnEncounter(state: GameState, rng: Rng): void {
  const def = weightedPick(rng, eligibleEncounters(state));
  state.encounter.active = {
    id: def.id,
    x: randomBetween(rng, 0.12, 0.88),
    y: randomBetween(rng, 0.12, 0.88),
    remaining: ENCOUNTER_LIFETIME,
  };
  state.encounter.nextIn = randomBetween(rng, ENCOUNTER_INTERVAL_MIN, ENCOUNTER_INTERVAL_MAX);
}

/** Reward kinds this encounter can give, with their weights. */
export function rewardOdds(
  def: EncounterDef,
  treasureAvailable: boolean,
): { kind: RewardKind; weight: number }[] {
  return (['windfall', 'buff', 'treasure'] as const)
    .filter((kind) => def.rewards[kind] && (kind !== 'treasure' || treasureAvailable))
    .map((kind) => ({ kind, weight: def.rewards[kind]!.weight }));
}

export function windfallAmount(
  state: GameState,
  stats: Stats,
  reward: WindfallReward,
  rng: Rng,
): number {
  const seconds = randomBetween(rng, reward.qpsSeconds[0], reward.qpsSeconds[1]);
  return Math.min(state.qi * reward.bankFraction, stats.qps * seconds) + stats.clickPower * 10;
}

export function claimEncounter(state: GameState, stats: Stats, rng: Rng): boolean {
  const active = state.encounter.active;
  if (!active) return false;
  const def = ENCOUNTERS_BY_ID.get(active.id)!;
  state.encounter.active = null;
  state.stats.encountersClaimed++;

  const vars: Record<string, string> = {};
  const intro = fillTemplate(pick(rng, def.intros), vars, rng);
  const story = (text: string) => log(`${intro} ${fillTemplate(text, vars, rng)}`, 'lore');
  const fmt = (n: number) => formatNumber(n, state.settings.numberFormat);

  const treasureId = pickRandomTreasure(state, rng);
  const { kind } = weightedPick(rng, rewardOdds(def, treasureId !== null));
  switch (kind) {
    case 'windfall': {
      const reward = def.rewards.windfall!;
      const amount = windfallAmount(state, stats, reward, rng);
      story(pick(rng, reward.texts));
      gainQi(state, amount);
      log(`+${fmt(amount)} qi`, 'good');
      break;
    }
    case 'buff': {
      const option = weightedPick(rng, def.rewards.buff!.options);
      const buff = BUFFS_BY_ID.get(option.buff)!;
      story(pick(rng, option.texts));
      addBuff(state, buff.id);
      const effects = describeEffects(buff.effects);
      log(`${buff.name}: ${effects} for ${buff.duration}s`, 'good');
      break;
    }
    case 'treasure': {
      const name = TREASURES_BY_ID.get(treasureId!)!.name;
      vars.treasure = state.treasures[treasureId!] ? `another ${name}` : `the ${name}`;
      story(pick(rng, def.rewards.treasure!.texts));
      grantTreasure(state, treasureId!);
      break;
    }
  }
  return true;
}
