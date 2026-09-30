import { describe, expect, it } from 'vitest';
import { firstStageOfRealm } from '../../content/realms';
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

  it('accepting takes the offer', () => {
    const state = newGame({ stage: firstStageOfRealm('foundation') });
    state.trial.offer = { element: 'water', x: 0.5, y: 0.5, remaining: 5 };
    expect(acceptTrial(state)).toBe('water');
    expect(state.trial.offer).toBeNull();
    expect(acceptTrial(state)).toBeNull();
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
