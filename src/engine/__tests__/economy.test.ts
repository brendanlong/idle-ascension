import { describe, expect, it } from 'vitest';
import { onLog } from '../events';
import { GENERATORS, GENERATORS_BY_ID } from '../../content/generators';
import { firstStageOfRealm } from '../../content/realms';
import { UPGRADES_BY_ID } from '../../content/upgrades';
import {
  affordableUpgrades,
  buyAllUpgrades,
  buyGenerator,
  buyUpgrade,
  grantTreasure,
  drawInMote,
  generatorCost,
  isGeneratorVisible,
  maxAffordable,
  nextLockedGenerator,
} from '../economy';
import { MAX_MOTES, computeStats, moteSpawnRate } from '../stats';
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
    const n = maxAffordable(state, mods, 'herb');
    expect(generatorCost(state, mods, 'herb', n)).toBeLessThanOrEqual(state.qi);
    expect(generatorCost(state, mods, 'herb', n + 1)).toBeGreaterThan(state.qi);
  });

  it('spends qi and adds generators, refusing when too poor', () => {
    const state = newGame({ qi: GENERATORS_BY_ID.get('herb')!.baseCost + 5 });
    const { mods } = computeStats(state);
    expect(buyGenerator(state, mods, 'herb')).toBe(true);
    expect(state.generators.herb).toBe(1);
    expect(state.qi).toBeCloseTo(5);
    expect(buyGenerator(state, mods, 'herb')).toBe(false);
  });

  it('locks realm-gated generators until their realm', () => {
    const state = newGame({ qi: 1e30, qiEarnedThisLoop: 1e30 });
    const { mods } = computeStats(state);
    const index = GENERATORS.findIndex((g) => g.id === 'sect');
    expect(isGeneratorVisible(state, index)).toBe(false);
    expect(nextLockedGenerator(state)?.id).toBe('sect');
    expect(buyGenerator(state, mods, 'sect')).toBe(false);
    state.stage = firstStageOfRealm('nascentSoul');
    expect(isGeneratorVisible(state, index)).toBe(true);
    expect(buyGenerator(state, mods, 'sect')).toBe(true);
    expect(nextLockedGenerator(state)?.id).toBe('dragon');
  });

  it('produces qi from generators', () => {
    const state = newGame();
    state.generators.herb = 3;
    expect(computeStats(state).qps).toBeCloseTo(3 * GENERATORS_BY_ID.get('herb')!.baseQps);
  });
});

describe('qi motes', () => {
  it('spawns motes faster on an emptier field, fading to none at the cap', () => {
    expect(moteSpawnRate(2, 0)).toBeCloseTo(6);
    expect(moteSpawnRate(2, 10)).toBeCloseTo(2.5, 1);
    expect(moteSpawnRate(2, 30)).toBeLessThan(moteSpawnRate(2, 20));
    expect(moteSpawnRate(2, MAX_MOTES)).toBe(0);
  });

  it('adds automatically gathered motes to passive qi/s', () => {
    const state = newGame();
    state.generators.herb = 10;
    const before = computeStats(state);
    state.upgrades['sense-3'] = true;
    const after = computeStats(state);
    expect(after.autoMoteQps).toBeCloseTo(
      after.moteSpawnPerSecond * after.mods.moteAutoCollect * after.moteValue,
    );
    expect(after.qps).toBeCloseTo(before.qps + after.autoMoteQps);
  });
});

describe('gathering and upgrades', () => {
  it('draws in a mote worth the base mote value at the start', () => {
    const state = newGame();
    const stats = computeStats(state);
    expect(drawInMote(state, stats)).toBe(stats.moteValue);
    expect(state.qi).toBe(stats.moteValue);
    expect(state.stats.motesAbsorbed).toBe(1);
  });

  it('buys all affordable techniques, cheapest first', () => {
    const cost = (id: string) => UPGRADES_BY_ID.get(id)!.cost;
    const [cheap, dear] = ['palm-1', 'sense-1'].sort((a, b) => cost(a) - cost(b));
    const qi = cost(cheap) + cost(dear) + 1;
    const state = newGame({ stage: firstStageOfRealm('qiCondensation'), qi });
    state.stats.motesAbsorbed = 10;
    expect(affordableUpgrades(state).map((u) => u.id)).toEqual([cheap, dear]);
    expect(buyAllUpgrades(state)).toBe(2);
    expect(state.qi).toBe(1);
    expect(buyAllUpgrades(state)).toBe(0);
  });

  it('only sells unlocked upgrades', () => {
    const state = newGame({ qi: 1e6 });
    expect(buyUpgrade(state, 'palm-1')).toBe(false);
    const before = computeStats(state).moteValue;
    state.stats.motesAbsorbed = 10;
    expect(buyUpgrade(state, 'palm-1')).toBe(true);
    expect(computeStats(state).moteValue).toBe(before * 2);
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
    state.stats.motesAbsorbed = 10;
    expect(logs(() => buyUpgrade(state, 'palm-1'))).toEqual([
      'You master the Iron Palm technique (×2 base qi mote value).',
    ]);
    expect(logs(() => buyUpgrade(state, 'scripture-5'))).toEqual([
      'You master the Wordless Sutra technique (×3 all qi gain).',
    ]);
  });

  it('lists each technique bought with Buy all', () => {
    const cost = (id: string) => UPGRADES_BY_ID.get(id)!.cost;
    const qi = cost('palm-1') + cost('sense-1');
    const state = newGame({ stage: firstStageOfRealm('qiCondensation'), qi });
    state.stats.motesAbsorbed = 10;
    const [log] = logs(() => buyAllUpgrades(state));
    expect(log).toMatch(/^You master 2 techniques: /);
    expect(log).toContain('Iron Palm (×2 base qi mote value)');
    expect(log).toContain('Spiritual Sense (×1.5 qi mote frequency, ×1.5 qi mote value)');
  });

  it('describes treasures when found and when refined', () => {
    const state = newGame();
    expect(logs(() => grantTreasure(state, 'ring'))[0]).toBe(
      'Obtained rare treasure: Ring of the Old Master! (×1.3 all qi gain)',
    );
    expect(logs(() => grantTreasure(state, 'ring'))[0]).toBe(
      'Your Ring of the Old Master absorbs it and grows stronger. Level 2: ×1.45 all qi gain.',
    );
  });

  it('sizes a revival when learned so its resource leads the best one by half again', () => {
    const state = newGame({ qi: 1e12 });
    Object.assign(state.generators, { herb: 20, array: 40, furnace: 30 });
    expect(buyUpgrade(state, 'herb-5')).toBe(true);
    const stats = computeStats(state, false);
    const total = (id: string) => stats.generatorUnitQps[id] * state.generators[id];
    expect(total('herb') / Math.max(total('array'), total('furnace'))).toBeCloseTo(1.5, 1);
    // Later growth doesn't resize it.
    const mult = state.revivals.herb;
    state.generators.array = 300;
    expect(computeStats(state, false).mods.generatorMult.herb).toBe(mult);
  });
});
