import { describe, expect, it } from 'vitest';
import { GENERATORS } from '../../content/generators';
import { firstStageOfRealm } from '../../content/realms';
import {
  buyGenerator,
  buyUpgrade,
  click,
  generatorCost,
  isGeneratorVisible,
  maxAffordable,
  nextLockedGenerator,
} from '../economy';
import { computeStats } from '../stats';
import { newGame } from './helpers';

describe('generators', () => {
  it('prices bulk purchases as the sum of individual purchases', () => {
    const state = newGame();
    const { mods } = computeStats(state);
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += generatorCost(state, mods, 'herb');
      state.generators.herb++;
    }
    state.generators.herb = 0;
    expect(generatorCost(state, mods, 'herb', 10)).toBeCloseTo(sum);
  });

  it('computes the max affordable count exactly', () => {
    const state = newGame({ qi: 12_345 });
    const { mods } = computeStats(state);
    const n = maxAffordable(state, mods, 'cushion');
    expect(generatorCost(state, mods, 'cushion', n)).toBeLessThanOrEqual(state.qi);
    expect(generatorCost(state, mods, 'cushion', n + 1)).toBeGreaterThan(state.qi);
  });

  it('spends qi and adds generators, refusing when too poor', () => {
    const state = newGame({ qi: 20 });
    const { mods } = computeStats(state);
    expect(buyGenerator(state, mods, 'cushion')).toBe(true);
    expect(state.generators.cushion).toBe(1);
    expect(state.qi).toBeCloseTo(5);
    expect(buyGenerator(state, mods, 'cushion')).toBe(false);
  });

  it('locks realm-gated generators until their realm', () => {
    const state = newGame({ qi: 1e30, qiEarnedThisLoop: 1e30 });
    const { mods } = computeStats(state);
    const index = GENERATORS.findIndex((g) => g.id === 'sect');
    expect(isGeneratorVisible(state, index)).toBe(false);
    expect(nextLockedGenerator(state)?.id).toBe('sect');
    expect(buyGenerator(state, mods, 'sect')).toBe(false);
    state.stage = firstStageOfRealm('spiritSevering');
    expect(isGeneratorVisible(state, index)).toBe(true);
    expect(buyGenerator(state, mods, 'sect')).toBe(true);
    expect(nextLockedGenerator(state)?.id).toBe('smallWorld');
  });

  it('produces qi from generators', () => {
    const state = newGame();
    state.generators.herb = 3;
    expect(computeStats(state).qps).toBeCloseTo(3);
  });
});

describe('clicking and upgrades', () => {
  it('clicks for click power and counts clicks', () => {
    const state = newGame();
    expect(click(state, computeStats(state))).toBe(1);
    expect(state.qi).toBe(1);
    expect(state.stats.loopClicks).toBe(1);
  });

  it('only sells unlocked upgrades', () => {
    const state = newGame({ qi: 1e6 });
    expect(buyUpgrade(state, 'palm-1')).toBe(false);
    state.stats.loopClicks = 15;
    expect(buyUpgrade(state, 'palm-1')).toBe(true);
    expect(computeStats(state).clickPower).toBe(2);
  });
});
