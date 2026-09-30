import { describe, expect, it } from 'vitest';
import { firstStageOfRealm } from '../../content/realms';
import { MAX_TREASURE_LEVEL, RARITIES, TREASURES_BY_ID } from '../../content/treasures';
import { findableTreasures, grantTreasure, pickRandomTreasure, treasureWeight } from '../economy';
import { scaleEffect } from '../effects';
import { computeStats } from '../stats';
import { newGame } from './helpers';

describe('treasures', () => {
  it('scales bonuses linearly and reductions multiplicatively', () => {
    expect(scaleEffect({ type: 'mult', stat: 'globalMult', value: 1.5 }, 3).value).toBe(2.5);
    expect(scaleEffect({ type: 'add', stat: 'tribulationAllowedHits', value: 1 }, 3).value).toBe(3);
    expect(scaleEffect({ type: 'mult', stat: 'coreCostMult', value: 0.5 }, 3).value).toBe(0.125);
  });

  it('refines a treasure you already own, up to the max level', () => {
    const state = newGame({ stage: firstStageOfRealm('foundation') });
    const base = computeStats(state).mods.globalMult;
    grantTreasure(state, 'ring');
    expect(computeStats(state).mods.globalMult).toBeCloseTo(base * 1.5);
    grantTreasure(state, 'ring');
    expect(state.treasures.ring).toBe(2);
    expect(computeStats(state).mods.globalMult).toBeCloseTo(base * 2);
    for (let i = 0; i < 10; i++) grantTreasure(state, 'ring');
    expect(state.treasures.ring).toBe(MAX_TREASURE_LEVEL);
    expect(findableTreasures(state).map((t) => t.id)).not.toContain('ring');
  });

  it('only offers treasures from realms you have reached', () => {
    const state = newGame({ stage: firstStageOfRealm('qiCondensation') });
    const realms = new Set(findableTreasures(state).map((t) => t.minRealm));
    expect([...realms]).toEqual(['qiCondensation']);
  });

  it('weights picks by rarity, favouring treasures you do not have yet', () => {
    const state = newGame();
    const ring = TREASURES_BY_ID.get('ring')!;
    expect(treasureWeight(state, ring)).toBe(RARITIES.rare.weight);
    state.treasures.ring = 1;
    expect(treasureWeight(state, ring)).toBeLessThan(RARITIES.rare.weight);

    const counts: Record<string, number> = {};
    let seed = 1;
    const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const early = newGame({ stage: firstStageOfRealm('qiCondensation') });
    for (let i = 0; i < 5000; i++) {
      const id = pickRandomTreasure(early, rng)!;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    // Common (weight 10) should come up about twice as often as uncommon (weight 5).
    expect(counts.jadeSlip / counts.bottle).toBeGreaterThan(1.6);
    expect(counts.jadeSlip / counts.bottle).toBeLessThan(2.4);
  });
});
