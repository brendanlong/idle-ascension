import { describe, expect, it } from 'vitest';
import { STAGES, firstStageOfRealm } from '../../content/realms';
import {
  attemptBreakthrough,
  beginTribulationTrial,
  breakthroughBlocker,
  forfeitInterruptedTrials,
} from '../breakthrough';
import { TRIAL_OFFER_LIFETIME } from '../../content/trials';
import { computeStats } from '../stats';
import { acceptTrial, completeTrial, tickTrials } from '../trials';
import { newGame, seqRng } from './helpers';

describe('elemental trials', () => {
  it('offers trials from Foundation Establishment, and they expire', () => {
    const early = newGame({ stage: firstStageOfRealm('foundation') - 1 });
    tickTrials(early, 10_000, seqRng(0.5));
    expect(early.trial.offer).toBeNull();

    const state = newGame({ stage: firstStageOfRealm('foundation') });
    tickTrials(state, 10_000, seqRng(0.5));
    expect(state.trial.offer).not.toBeNull();
    tickTrials(state, TRIAL_OFFER_LIFETIME + 1, seqRng(0.5));
    expect(state.trial.offer).toBeNull();
  });

  it('accepting takes the offer and makes it the active trial until completed', () => {
    const state = newGame({ stage: firstStageOfRealm('foundation') });
    state.trial.offer = { element: 'water', x: 0.5, y: 0.5, remaining: 5 };
    expect(acceptTrial(state)).toBe('water');
    expect(state.trial.offer).toBeNull();
    expect(state.trial.active).toBe('water');
    expect(acceptTrial(state)).toBeNull();
    // No new offers or breakthroughs while a trial is running.
    tickTrials(state, 10_000, seqRng(0.5));
    expect(state.trial.offer).toBeNull();
    state.qi = 1e30;
    expect(breakthroughBlocker(state)).toMatch(/Finish your trial/);
    completeTrial(state, computeStats(state), 'water', 0.5, seqRng(0.5));
    expect(state.trial.active).toBeNull();
  });

  it('treats a NaN score as zero', () => {
    const state = newGame({ stage: firstStageOfRealm('foundation') });
    const { qi } = completeTrial(state, computeStats(state), 'fire', NaN, seqRng(0.5));
    expect(Number.isFinite(qi)).toBe(true);
    expect(Number.isFinite(state.qi)).toBe(true);
  });

  it('forfeits trials interrupted by a reload', () => {
    const state = newGame({ stage: firstStageOfRealm('foundation') });
    state.trial.active = 'wood';
    const target = firstStageOfRealm('coreFormation');
    Object.assign(state, { stage: target - 1, qi: STAGES[target].cost });
    state.generators.furnace = 1;
    state.trial.active = null;
    attemptBreakthrough(state, computeStats(state).mods, seqRng(0.5));
    beginTribulationTrial(state);
    state.trial.active = 'wood';
    forfeitInterruptedTrials(state);
    expect(state.trial.active).toBeNull();
    // Core Formation is a single trial, so forfeiting it fails the tribulation.
    expect(state.tribulation).toBeNull();
    expect(state.stats.tribulationsFailed).toBe(1);
  });

  it("doesn't forfeit a tribulation trial that hadn't started", () => {
    const target = firstStageOfRealm('coreFormation');
    const state = newGame({ stage: target - 1, qi: STAGES[target].cost });
    state.generators.furnace = 1;
    attemptBreakthrough(state, computeStats(state).mods, seqRng(0.5));
    forfeitInterruptedTrials(state);
    expect(state.tribulation?.scores).toEqual([]);
  });

  it('scales rewards with score and affinity, adding a buff for good scores', () => {
    const reward = (score: number, affinity = false) => {
      const state = newGame({ stage: firstStageOfRealm('foundation') });
      state.generators.herb = 10;
      if (affinity) state.cores = [{ element: 'fire', grade: 0 }];
      const result = completeTrial(state, computeStats(state), 'fire', score, seqRng(0.99));
      return { ...result, buffs: state.buffs.map((b) => b.id) };
    };
    expect(reward(1).qi).toBeGreaterThan(reward(0.2).qi);
    expect(reward(0.5).buff).toBeNull();
    expect(reward(0.8).buffs).toContain('meridianSurge');
    expect(reward(0.8, true).qi).toBeGreaterThan(reward(0.8).qi);
  });
});
