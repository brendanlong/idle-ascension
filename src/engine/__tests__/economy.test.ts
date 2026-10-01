import { describe, expect, it } from 'vitest';
import { onLog } from '../events';
import { GENERATORS } from '../../content/generators';
import { firstStageOfRealm } from '../../content/realms';
import {
  affordableUpgrades,
  buyAllUpgrades,
  buyGenerator,
  buyUpgrade,
  grantTreasure,
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

  it('buys all affordable techniques, cheapest first', () => {
    const state = newGame({ stage: firstStageOfRealm('qiCondensation'), qi: 8_500 });
    state.stats.totalClicks = 150;
    // Available: Iron Palm 100, Spiritual Sense 300, Cloud-Parting Palm 5,000, Sunflower Manual 7,777.
    expect(affordableUpgrades(state).map((u) => u.id)).toEqual(['palm-1', 'sense-1', 'palm-2']);
    expect(buyAllUpgrades(state)).toBe(3);
    expect(state.qi).toBe(8_500 - 100 - 300 - 5_000);
    expect(state.upgrades.sunflower).toBeUndefined();
    expect(buyAllUpgrades(state)).toBe(0);
  });

  it('only sells unlocked upgrades', () => {
    const state = newGame({ qi: 1e6 });
    expect(buyUpgrade(state, 'palm-1')).toBe(false);
    state.stats.totalClicks = 15;
    expect(buyUpgrade(state, 'palm-1')).toBe(true);
    expect(computeStats(state).clickPower).toBe(2);
  });
});

describe('log messages', () => {
  function logs(fn: () => void): string[] {
    const out: string[] = [];
    const off = onLog((e) => out.push(e.text));
    fn();
    off();
    return out;
  }

  it('describes what a technique does when you master it', () => {
    const state = newGame({ qi: 1e30, stage: firstStageOfRealm('daoSeeking') });
    state.stats.totalClicks = 15;
    expect(logs(() => buyUpgrade(state, 'palm-1'))).toEqual([
      'You master the Iron Palm technique (×2 cultivation (click) power).',
    ]);
    expect(logs(() => buyUpgrade(state, 'scripture-5'))).toEqual([
      'You master the Wordless Sutra technique (×3 all qi gain).',
    ]);
  });

  it('lists each technique bought with Buy all', () => {
    const state = newGame({ stage: firstStageOfRealm('qiCondensation'), qi: 500 });
    state.stats.totalClicks = 15;
    expect(logs(() => buyAllUpgrades(state))).toEqual([
      'You master 2 techniques: Iron Palm (×2 cultivation (click) power); Spiritual Sense (×1.5 qi mote frequency, ×1.5 qi mote value).',
    ]);
  });

  it('describes treasures when found and when refined', () => {
    const state = newGame();
    expect(logs(() => grantTreasure(state, 'ring'))[0]).toBe(
      'Obtained rare treasure: Ring of the Old Master! (×1.5 all qi gain, +1% of qi/s added to each click)',
    );
    expect(logs(() => grantTreasure(state, 'ring'))[0]).toBe(
      'Your Ring of the Old Master absorbs it and grows stronger. Level 2: ×1.75 all qi gain, +1.5% of qi/s added to each click.',
    );
  });
});
