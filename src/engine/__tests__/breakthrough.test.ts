import { describe, expect, it } from 'vitest';
import { STAGES, firstStageOfRealm } from '../../content/realms';
import {
  attemptBreakthrough,
  breakthroughBlocker,
  disperseBolt,
  tickTribulation,
} from '../breakthrough';
import { computeStats } from '../stats';
import { newGame, seqRng } from './helpers';

describe('breakthroughs', () => {
  it('advances a minor stage by paying its cost', () => {
    const state = newGame({ qi: 100 });
    expect(attemptBreakthrough(state, computeStats(state).mods)).toBe('advanced');
    expect(state.stage).toBe(1);
    expect(state.qi).toBe(100 - STAGES[1].cost);
  });

  it('requires a pill furnace for Foundation Establishment', () => {
    const state = newGame({ qi: 1e12, stage: firstStageOfRealm('foundation') - 1 });
    expect(breakthroughBlocker(state)).toMatch(/Pill Furnace/);
    state.generators.furnace = 1;
    expect(breakthroughBlocker(state)).toBeNull();
  });

  function startTribulation() {
    const target = firstStageOfRealm('coreFormation');
    const state = newGame({ qi: STAGES[target].cost, stage: target - 1 });
    const mods = computeStats(state).mods;
    expect(attemptBreakthrough(state, mods)).toBe('tribulation');
    expect(state.qi).toBe(0);
    return { state, mods, target };
  }

  it('succeeds if every bolt is dispersed', () => {
    const { state, mods, target } = startTribulation();
    for (let i = 0; i < 200 && state.tribulation; i++) {
      tickTribulation(state, mods, 0.1, seqRng(0.5));
      for (const b of state.tribulation?.bolts ?? []) disperseBolt(state, b.id);
    }
    expect(state.tribulation).toBeNull();
    expect(state.stage).toBe(target);
    expect(state.stats.tribulationsSurvived).toBe(1);
  });

  it('fails, refunds most of the cost and injures you if too many bolts land', () => {
    const { state, mods, target } = startTribulation();
    for (let i = 0; i < 200 && state.tribulation; i++)
      tickTribulation(state, mods, 0.1, seqRng(0.5));
    expect(state.stage).toBe(target - 1);
    expect(state.qi).toBeCloseTo(STAGES[target].cost * 0.7);
    expect(state.buffs.map((b) => b.id)).toContain('injured');
  });
});
