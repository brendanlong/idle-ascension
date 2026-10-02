import { describe, expect, it } from 'vitest';
import { PERKS, PERKS_BY_ID } from '../../content/perks';
import { REALMS, firstStageOfRealm } from '../../content/realms';
import {
  availableMemories,
  buyPerk,
  describeSpecialPerk,
  MEMORY_SETTLE_SECONDS,
  memoriesForStage,
  pendingMemories,
  perkCost,
  perkStatus,
  regress,
  regressionBlocker,
  stashGenerators,
} from '../prestige';
import { diminishingEffect } from '../effects';
import { perkEffects } from '../stats';
import { newGame } from './helpers';

const CORE_FORMATION = firstStageOfRealm('coreFormation');

/** A game whose current life is long enough for Memories to have fully settled. */
function settledGame(overrides: Parameters<typeof newGame>[0] = {}) {
  const state = newGame(overrides);
  state.stats.loopTime = MEMORY_SETTLE_SECONDS;
  return state;
}

describe('regression', () => {
  it('is blocked before Core Formation', () => {
    expect(regressionBlocker(newGame({ stage: CORE_FORMATION - 1 }))).not.toBeNull();
    expect(regressionBlocker(settledGame({ stage: CORE_FORMATION }))).toBeNull();
  });

  it('refuses to regress when blocked', () => {
    expect(regress(newGame({ stage: CORE_FORMATION - 1 }), 0)).toBeNull();
  });

  it('awards Memories by realm as tuned, so changing the Memory curve is a deliberate choice', () => {
    // MEMORIES (content/memories.ts) sets these; re-run scripts/balance/spec.py if they move.
    const byRealm = Object.fromEntries(
      REALMS.filter((r) => firstStageOfRealm(r.id) >= CORE_FORMATION).map((r) => [
        r.id,
        memoriesForStage(firstStageOfRealm(r.id)),
      ]),
    );
    expect(byRealm).toEqual({
      coreFormation: 10,
      nascentSoul: 810,
      spiritSevering: 65_610,
      daoSeeking: 5_314_410,
      immortalAscension: 430_467_210,
      godhood: 34_867_844_010,
    });
  });

  it('settles Memories over the start of each life', () => {
    const state = newGame({ stage: CORE_FORMATION + 4 });
    state.stats.loopTime = MEMORY_SETTLE_SECONDS / 2;
    expect(pendingMemories(state)).toBe(Math.floor(memoriesForStage(CORE_FORMATION + 4) / 2));
  });

  it('awards more memories for deeper cultivation', () => {
    const shallow = pendingMemories(settledGame({ stage: CORE_FORMATION }));
    const deep = pendingMemories(settledGame({ stage: CORE_FORMATION + 4 }));
    expect(shallow).toBeGreaterThan(0);
    expect(deep).toBeGreaterThan(shallow);
  });

  it('resets progress but keeps memories, perks, and lifetime stats', () => {
    const state = settledGame({ stage: CORE_FORMATION, qi: 1e9, qiEarnedTotal: 1e12 });
    state.generators.herb = 50;
    state.treasures.ring = 3;
    state.prestige.perks.meridians = 1;
    state.prestige.memories = 5;
    state.stats.totalClicks = 99;
    const gained = pendingMemories(state);

    const next = regress(state, 0)!;
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
    const state = settledGame({ stage: CORE_FORMATION });
    state.treasures = { ring: 3, pendant: 1 };
    state.prestige.perks = { soulbound: 2, stash: 2, daoHeart: 1 };
    const next = regress(state, 0)!;
    // Soul-Bound level 2 keeps treasures at up to level 2.
    expect(next.treasures).toEqual({ ring: 2, pendant: 1 });
    expect(next.generators.cushion).toBe(10);
    expect(next.generators.array).toBe(10);
    expect(next.stage).toBe(3);
  });

  it('describes what special perks give', () => {
    const stash = PERKS_BY_ID.get('stash')!;
    expect(describeSpecialPerk(stash, 1)).toBe(
      'Start each loop with 10 Meditation Cushions, 5 Spirit Herb Patches',
    );
    expect(stashGenerators(3)).toEqual({
      cushion: 10,
      herb: 5,
      array: 10,
      furnace: 11,
      disciple: 5,
    });
    expect(describeSpecialPerk(PERKS_BY_ID.get('soulbound')!, 3)).toMatch(/level 3/);
  });

  it('scales diminishing perks logarithmically, rounding whole-number stats down', () => {
    const rate = (level: number) => perkEffects(PERKS_BY_ID.get('foresight')!, level)[0].value;
    expect([1, 3, 7, 15].map(rate)).toEqual([1.5, 2, 2.5, 3]);
    const slots = (level: number) =>
      diminishingEffect({ type: 'add', stat: 'coreSlots', value: 1 }, level).value;
    expect([1, 2, 3, 6, 7].map(slots)).toEqual([1, 1, 2, 2, 3]);
  });

  it('compounds ordinary perks', () => {
    expect(perkEffects(PERKS_BY_ID.get('bargain')!, 3)[0].value).toBeCloseTo(0.95 ** 3);
    expect(perkEffects(PERKS_BY_ID.get('bargain')!, 0)).toEqual([]);
    // Remembered Meridian Paths grows logarithmically instead: x2, x3 at level 3, x4 at 7.
    expect(perkEffects(PERKS_BY_ID.get('meridians')!, 3)[0].value).toBe(3);
  });

  it('lets uncapped perks be bought past their old caps', () => {
    const state = newGame();
    state.prestige.memories = 1e30;
    for (let i = 0; i < 10; i++) expect(buyPerk(state, 'meridians')).toBe(true);
    expect(perkStatus(state, 'meridians')).toBe('available');
  });

  it('buys perks with unspent memories and respects prerequisites', () => {
    const state = newGame();
    state.prestige.memories = 10;
    expect(buyPerk(state, 'foresight')).toBe(false);
    expect(buyPerk(state, 'meridians')).toBe(true);
    expect(buyPerk(state, 'foresight')).toBe(true);
    const firstLevel = (id: string) => perkCost(PERKS_BY_ID.get(id)!, 0);
    expect(availableMemories(state)).toBe(10 - firstLevel('meridians') - firstLevel('foresight'));
  });

  it('prices insights so one regression buys a few of them, not all', () => {
    // At each realm, with a level of each perk per realm since its first: no single
    // insight costs more than regressing from there, and all of them cost a few regressions.
    const index = (id: string) => REALMS.findIndex((r) => r.id === id);
    for (const realm of REALMS.slice(index('coreFormation'), index('godhood'))) {
      const regression = memoriesForStage(firstStageOfRealm(realm.id));
      const costs = PERKS.filter((p) => index(p.firstRealm) <= index(realm.id))
        .map((p) => ({ p, level: index(realm.id) - index(p.firstRealm) }))
        .filter(({ p, level }) => level < p.maxLevel)
        .map(({ p, level }) => perkCost(p, level));
      for (const cost of costs) expect(cost).toBeLessThan(regression);
      const total = costs.reduce((a, b) => a + b, 0);
      expect(total).toBeGreaterThan(2 * regression);
      expect(total).toBeLessThan(6 * regression);
    }
  });

  it('keeps realm-gated insights locked until you have reached the realm', () => {
    const state = newGame();
    state.prestige.memories = 1e9;
    state.prestige.perks.lightning = 1;
    expect(perkStatus(state, 'echoCore')).toBe('locked');
    state.stats.bestStage = firstStageOfRealm('spiritSevering');
    expect(perkStatus(state, 'echoCore')).toBe('available');
  });
});
