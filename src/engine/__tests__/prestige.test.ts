import { describe, expect, it } from 'vitest';
import { firstStageOfRealm } from '../../content/realms';
import {
  availableMemories,
  buyPerk,
  pendingMemories,
  regress,
  regressionBlocker,
} from '../prestige';
import { newGame } from './helpers';

const CORE_FORMATION = firstStageOfRealm('coreFormation');

describe('regression', () => {
  it('is blocked before Core Formation', () => {
    expect(regressionBlocker(newGame({ stage: CORE_FORMATION - 1 }))).not.toBeNull();
    expect(regressionBlocker(newGame({ stage: CORE_FORMATION }))).toBeNull();
  });

  it('awards more memories for deeper cultivation', () => {
    const shallow = pendingMemories(newGame({ stage: CORE_FORMATION }));
    const deep = pendingMemories(newGame({ stage: CORE_FORMATION + 4 }));
    expect(shallow).toBeGreaterThan(0);
    expect(deep).toBeGreaterThan(shallow);
  });

  it('resets progress but keeps memories, perks, and lifetime stats', () => {
    const state = newGame({ stage: CORE_FORMATION, qi: 1e9, qiEarnedTotal: 1e12 });
    state.generators.herb = 50;
    state.treasures.ring = true;
    state.prestige.perks.meridians = 1;
    state.prestige.memories = 5;
    state.stats.totalClicks = 99;
    const gained = pendingMemories(state);

    const next = regress(state, 0);
    expect(next.stage).toBe(0);
    expect(next.qi).toBe(0);
    expect(next.generators.herb).toBe(0);
    expect(next.treasures).toEqual({});
    expect(next.prestige.memories).toBe(5 + gained);
    expect(next.prestige.loops).toBe(1);
    expect(next.prestige.perks.meridians).toBe(1);
    expect(next.stats.totalClicks).toBe(99);
    expect(next.qiEarnedTotal).toBe(1e12);
  });

  it('applies soul-bound treasures, buried stash, and Dao heart perks', () => {
    const state = newGame({ stage: CORE_FORMATION });
    state.treasures.ring = true;
    state.prestige.perks = { soulbound: 1, stash: 1, daoHeart: 1 };
    const next = regress(state, 0);
    expect(next.treasures.ring).toBe(true);
    expect(next.generators.cushion).toBe(10);
    expect(next.stage).toBe(3);
  });

  it('buys perks with unspent memories and respects prerequisites', () => {
    const state = newGame();
    state.prestige.memories = 10;
    expect(buyPerk(state, 'foresight')).toBe(false);
    expect(buyPerk(state, 'meridians')).toBe(true);
    expect(buyPerk(state, 'foresight')).toBe(true);
    expect(availableMemories(state)).toBe(10 - 1 - 3);
  });
});
