import { OLD_MASTER_QUIPS } from '../content/lore';
import { STAGES } from '../content/realms';
import { tickTribulation } from './breakthrough';
import { gainQi } from './economy';
import { tickEncounters } from './encounters';
import { log } from './events';
import { pick, defaultRng, type Rng } from './rng';
import type { GameState } from './state';
import { computeStats } from './stats';

/** Gaps longer than this are treated as offline time rather than simulated live. */
export const OFFLINE_THRESHOLD_SECONDS = 60;
const QUIP_INTERVAL_SECONDS = 240;

export function tick(state: GameState, dt: number, rng: Rng = defaultRng): void {
  const stats = computeStats(state);
  gainQi(state, stats.qps * dt);
  state.stats.playTime += dt;
  state.stats.loopTime += dt;

  for (const b of state.buffs) b.remaining -= dt;
  state.buffs = state.buffs.filter((b) => b.remaining > 0);

  tickEncounters(state, stats, dt, rng);
  tickTribulation(state, stats.mods, dt, rng);

  if (state.treasures.ring && rng() < dt / QUIP_INTERVAL_SECONDS) {
    log(`The Old Master: ${pick(rng, OLD_MASTER_QUIPS)}`, 'lore');
  }
}

export interface OfflineReport {
  seconds: number;
  cappedSeconds: number;
  qi: number;
}

export function applyOfflineProgress(state: GameState, seconds: number): OfflineReport {
  // Buffs are excluded: an Epiphany shouldn't last through an 8 hour nap.
  const stats = computeStats(state, false);
  const cappedSeconds = Math.min(seconds, stats.mods.offlineCapHours * 3600);
  const qi = stats.qps * cappedSeconds * Math.min(1, stats.mods.offlineEfficiency);
  gainQi(state, qi);
  state.stats.playTime += seconds;
  state.stats.loopTime += seconds;
  state.buffs = state.buffs.filter((b) => (b.remaining -= seconds) > 0);
  state.encounter.active = null;
  if (state.tribulation) {
    // Abandoning a tribulation midway is treated as never having started it.
    state.qi += STAGES[state.tribulation.targetStage].cost;
    state.tribulation = null;
  }
  return { seconds, cappedSeconds, qi };
}

/** Advances the game to wall-clock time `now`. Returns an offline report for long gaps. */
export function advanceClock(
  state: GameState,
  now: number,
  rng: Rng = defaultRng,
): OfflineReport | null {
  const seconds = Math.max(0, (now - state.lastTick) / 1000);
  state.lastTick = now;
  if (seconds > OFFLINE_THRESHOLD_SECONDS) return applyOfflineProgress(state, seconds);
  tick(state, seconds, rng);
  return null;
}
